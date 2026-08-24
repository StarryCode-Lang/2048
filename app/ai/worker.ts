export {};

import { BITBOARD_OVERFLOW, decideBitboard, resetBitboardCaches, supportsBitboard } from "./bitboard.ts";

type Direction = "up" | "down" | "left" | "right";
type Corner = 0 | 1 | 2 | 3;
type MoveResult = {
  direction: Direction;
  board: number[];
  gained: number;
  movableTiles: number;
  disturbance: number;
};
type RequestMessage = {
  id: number;
  board: number[][];
  anchor: Corner;
  budgetMs: number;
  /** Offline regression harness only; the browser always uses a wall-clock budget. */
  nodeBudget?: number;
};
type ResponseMessage = {
  id: number;
  direction: Direction | null;
  anchor: Corner;
  strategy: "lock" | "recover";
  depth: number;
  nodes: number;
  elapsedMs: number;
  movableTiles: number;
  confidence: number;
};

const DIRECTIONS: Direction[] = ["down", "left", "right", "up"];
const TIMEOUT = Symbol("timeout");
const moveCache = new Map<string, MoveResult[]>();
const routeCache = new Map<string, number[]>();
const searchCache = new Map<string, number>();
const lineScoreCache = new Map<string, number>();
const evaluationCache = new Map<string, number>();
const principalMoveCache = new Map<string, Direction>();
const POW_3_5 = Array.from({ length: 32 }, (_, power) => Math.pow(power, 3.5));
const POW_4 = Array.from({ length: 32 }, (_, power) => Math.pow(power, 4));
const ROUTE_DECAY = Array.from({ length: 36 }, (_, rank) => Math.pow(.84, rank));
let deadline = 0;
let nodes = 0;
let nodeLimit = Number.POSITIVE_INFINITY;

/** Isolates deterministic benchmarks from decisions cached by an earlier game. */
export function resetAiCaches() {
  moveCache.clear();
  routeCache.clear();
  searchCache.clear();
  lineScoreCache.clear();
  evaluationCache.clear();
  principalMoveCache.clear();
  resetBitboardCaches();
}

function boardKey(board: number[]) {
  let key = "";
  for (const power of board) key += String.fromCharCode(65 + power);
  return key;
}

function lineIndex(direction: Direction, line: number, offset: number, size: number) {
  if (direction === "left") return line * size + offset;
  if (direction === "right") return line * size + size - 1 - offset;
  if (direction === "up") return offset * size + line;
  return (size - 1 - offset) * size + line;
}

function move(board: number[], size: number, direction: Direction): MoveResult | null {
  const next = new Array<number>(board.length).fill(0);
  let gained = 0;
  let disturbance = 0;
  const activeSources = new Uint8Array(board.length);
  let movableTiles = 0;
  const markActive = (source: number, power: number) => {
    if (activeSources[source]) return;
    activeSources[source] = 1;
    movableTiles += 1;
    disturbance += power * power;
  };

  for (let line = 0; line < size; line += 1) {
    const slots: Array<{ power: number; merged: boolean; source: number }> = [];
    for (let offset = 0; offset < size; offset += 1) {
      const source = lineIndex(direction, line, offset, size);
      const power = board[source];
      if (!power) continue;
      const last = slots.length - 1;
      let targetOffset: number;
      let merged = false;
      if (last >= 0 && slots[last].power === power && !slots[last].merged) {
        markActive(slots[last].source, power);
        slots[last].power += 1;
        slots[last].merged = true;
        targetOffset = last;
        merged = true;
        gained += 2 ** (power + 1);
      } else {
        slots.push({ power, merged: false, source });
        targetOffset = slots.length - 1;
      }
      const target = lineIndex(direction, line, targetOffset, size);
      if (source !== target || merged) {
        markActive(source, power);
      }
    }
    slots.forEach((slot, offset) => {
      next[lineIndex(direction, line, offset, size)] = slot.power;
    });
  }

  for (let index = 0; index < board.length; index += 1) {
    if (board[index] !== next[index]) return { direction, board: next, gained, movableTiles, disturbance };
  }
  return null;
}

function legalMoves(board: number[], size: number) {
  const key = `${size}|${boardKey(board)}`;
  const cached = moveCache.get(key);
  if (cached) return cached;
  const results = DIRECTIONS.flatMap((direction) => {
    const result = move(board, size, direction);
    return result ? [result] : [];
  });
  if (moveCache.size > 16000) {
    let remaining = 4000;
    for (const staleKey of moveCache.keys()) {
      moveCache.delete(staleKey);
      if (--remaining === 0) break;
    }
  }
  moveCache.set(key, results);
  return results;
}

/** Preserve the established maximum-tile corner while at least one such move remains. */
function strategicMoves(board: number[], size: number, anchor: Corner) {
  const moves = legalMoves(board, size);
  const maxPower = maxPowerOf(board);
  const anchorPosition = cornerIndex(size, anchor);
  if (maxPower < 7 || board[anchorPosition] !== maxPower) return moves;
  const preserving = moves.filter((result) => result.board[anchorPosition] >= maxPower);
  return preserving.length ? preserving : moves;
}

function snakeRoute(size: number, corner: Corner) {
  const cacheKey = `${size}-${corner}`;
  const cached = routeCache.get(cacheKey);
  if (cached) return cached;
  const top = corner < 2;
  const left = corner % 2 === 0;
  const route: number[] = [];
  for (let rowStep = 0; rowStep < size; rowStep += 1) {
    const row = top ? rowStep : size - 1 - rowStep;
    const startsLeft = rowStep % 2 === 0 ? left : !left;
    for (let colStep = 0; colStep < size; colStep += 1) {
      const col = startsLeft ? colStep : size - 1 - colStep;
      route.push(row * size + col);
    }
  }
  routeCache.set(cacheKey, route);
  return route;
}

function maxPowerOf(board: number[]) {
  let maxPower = 0;
  for (const power of board) if (power > maxPower) maxPower = power;
  return maxPower;
}

function cornerIndex(size: number, corner: Corner) {
  if (corner === 0) return 0;
  if (corner === 1) return size - 1;
  if (corner === 2) return (size - 1) * size;
  return size * size - 1;
}

function directionRank(direction: Direction, anchor: Corner) {
  const order: Record<Corner, Direction[]> = {
    0: ["left", "up", "right", "down"],
    1: ["right", "up", "left", "down"],
    2: ["left", "down", "right", "up"],
    3: ["right", "down", "left", "up"],
  };
  return order[anchor].indexOf(direction);
}

function scoreLine(board: number[], start: number, stride: number, size: number) {
  let lineKey = `${size}|`;
  for (let index = 0; index < size; index += 1) lineKey += String.fromCharCode(65 + board[start + index * stride]);
  const cached = lineScoreCache.get(lineKey);
  if (cached !== undefined) return cached;
  let empty = 0;
  let sum = 0;
  let merges = 0;
  let monotonicLeft = 0;
  let monotonicRight = 0;
  let previousCompact = 0;
  for (let index = 0; index < size; index += 1) {
    const power = board[start + index * stride];
    if (!power) empty += 1;
    else {
      if (previousCompact === power) merges += 1;
      previousCompact = power;
    }
    const power4 = POW_4[power] ?? Math.pow(power, 4);
    const power35 = POW_3_5[power] ?? Math.pow(power, 3.5);
    const next = index + 1 < size ? board[start + (index + 1) * stride] : 0;
    const next4 = POW_4[next] ?? Math.pow(next, 4);
    sum += power35;
    if (power > next) monotonicLeft += power4 - next4;
    else monotonicRight += next4 - power4;
  }
  const score = empty * 270 + merges * 700 - Math.min(monotonicLeft, monotonicRight) * 47 - sum * 11;
  if (lineScoreCache.size > 90000) lineScoreCache.clear();
  lineScoreCache.set(lineKey, score);
  return score;
}

function hasLegalMove(board: number[], size: number) {
  for (let index = 0; index < board.length; index += 1) {
    if (!board[index]) return true;
    const row = Math.floor(index / size);
    const col = index % size;
    if (col + 1 < size && board[index + 1] === board[index]) return true;
    if (row + 1 < size && board[index + size] === board[index]) return true;
  }
  return false;
}

function evaluate(board: number[], size: number, anchor: Corner) {
  const evaluationKey = `${size}${anchor}|${boardKey(board)}`;
  const cached = evaluationCache.get(evaluationKey);
  if (cached !== undefined) return cached;
  let score = 0;
  for (let index = 0; index < size; index += 1) {
    score += scoreLine(board, index * size, 1, size) + scoreLine(board, index, size, size);
  }

  const maxPower = maxPowerOf(board);
  const route = snakeRoute(size, anchor);
  const anchorIndex = route[0];
  let nearestMaxDistance = size * 2;
  let inversion = 0;
  let chainLength = 0;
  for (let index = 0; index < board.length; index += 1) {
    if (board[index] === maxPower) {
      const distance = Math.abs(Math.floor(index / size) - Math.floor(anchorIndex / size))
        + Math.abs(index % size - anchorIndex % size);
      nearestMaxDistance = Math.min(nearestMaxDistance, distance);
    }
    const routePower = board[route[index]];
    const next = index + 1 < route.length ? board[route[index + 1]] : 0;
    if (next > routePower) inversion += (next - routePower) * ROUTE_DECAY[index];
    if (routePower && (index === 0 || board[route[index - 1]] >= routePower) && chainLength === index) chainLength += 1;
  }
  const cornerScore = nearestMaxDistance === 0
    ? Math.pow(maxPower, 4) * 28
    : -nearestMaxDistance * Math.pow(maxPower, 4) * 18;
  const lateStructure = Math.max(0, maxPower - 10);
  score += cornerScore + chainLength * chainLength * 120 - inversion * 420 * (1 + lateStructure * .6);
  if (!hasLegalMove(board, size)) score = -1e9 + score;
  if (evaluationCache.size > 120000) {
    let remaining = 40000;
    for (const staleKey of evaluationCache.keys()) {
      evaluationCache.delete(staleKey);
      if (--remaining === 0) break;
    }
  }
  evaluationCache.set(evaluationKey, score);
  return score;
}

function checkTime() {
  nodes += 1;
  if (nodes >= nodeLimit || ((nodes & 31) === 0 && performance.now() >= deadline)) throw TIMEOUT;
}

function emptyIndices(board: number[]) {
  const empties: number[] = [];
  for (let index = 0; index < board.length; index += 1) if (!board[index]) empties.push(index);
  return empties;
}

function sampledEmptyIndices(board: number[], size: number, anchor: Corner, limit: number) {
  const route = snakeRoute(size, anchor);
  const empties: number[] = [];
  for (const index of route) if (!board[index]) empties.push(index);
  if (empties.length <= limit) return empties;
  let hash = 2166136261;
  for (const power of board) hash = Math.imul(hash ^ power, 16777619);
  const offset = (hash >>> 0) % empties.length;
  const sampled: number[] = [];
  for (let index = 0; index < limit; index += 1) {
    sampled.push(empties[(offset + Math.floor(index * empties.length / limit)) % empties.length]);
  }
  return sampled;
}

function chanceSearch(board: number[], size: number, anchor: Corner, depth: number, cache: Map<string, number>, exact = false): number {
  checkTime();
  const key = `${size}${anchor}c${exact ? "e" : "s"}${depth}|${boardKey(board)}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const sampleLimit = size === 4 ? 6 : 5;
  const spawnIndices = exact ? emptyIndices(board) : sampledEmptyIndices(board, size, anchor, sampleLimit);
  if (!spawnIndices.length) return maxSearch(board, size, anchor, depth, cache);
  let total = 0;
  let worst = Number.POSITIVE_INFINITY;
  const spawned = board.slice();
  for (const index of spawnIndices) {
    spawned[index] = 1;
    const withTwo = maxSearch(spawned, size, anchor, depth, cache);
    spawned[index] = 2;
    const withFour = maxSearch(spawned, size, anchor, depth, cache);
    spawned[index] = 0;
    const outcome = .9 * withTwo + .1 * withFour;
    total += outcome;
    if (outcome < worst) worst = outcome;
  }
  const average = total / spawnIndices.length;
  const riskWeight = spawnIndices.length <= 3 ? .24 : spawnIndices.length <= 5 ? .06 : 0;
  const score = average * (1 - riskWeight) + worst * riskWeight;
  cache.set(key, score);
  return score;
}

function maxSearch(board: number[], size: number, anchor: Corner, depth: number, cache: Map<string, number>): number {
  checkTime();
  if (depth <= 0) return evaluate(board, size, anchor);
  const key = `${size}${anchor}m${depth}|${boardKey(board)}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const moves = strategicMoves(board, size, anchor);
  if (!moves.length) return -1e9;
  let best = Number.NEGATIVE_INFINITY;
  for (const result of moves) {
    const score = result.gained * 7 - result.disturbance * 9
      + chanceSearch(result.board, size, anchor, depth - 1, cache);
    if (score > best) best = score;
  }
  cache.set(key, best);
  return best;
}

export function decideArray(message: RequestMessage): ResponseMessage {
  const started = performance.now();
  const deterministicNodeBudget = Number.isFinite(message.nodeBudget) ? Math.max(256, Math.floor(message.nodeBudget!)) : 0;
  deadline = deterministicNodeBudget ? Number.POSITIVE_INFINITY : started + Math.max(30, Math.min(240, message.budgetMs));
  nodes = 0;
  const size = message.board.length;
  const budgetScale = message.budgetMs >= 90 ? 1.7 : message.budgetMs >= 45 ? 1 : .65;
  const board = message.board.flat().map((value) => value ? Math.log2(value) : 0);
  const empty = board.filter((value) => !value).length;
  const maxPower = maxPowerOf(board);
  const searchBase = size === 4
    ? (maxPower >= 11 || empty <= 5 ? 60000 : 14000)
    : size === 5 ? 18000 : 10000;
  nodeLimit = deterministicNodeBudget || Math.floor(searchBase * budgetScale);
  const anchor = message.anchor;
  const principalKey = `${size}${anchor}|${boardKey(board)}`;
  const strategy = board[cornerIndex(size, anchor)] === maxPowerOf(board) ? "lock" : "recover";
  const rootMoves = strategicMoves(board, size, anchor);
  if (!rootMoves.length) return { id: message.id, direction: null, anchor, strategy, depth: 0, nodes, elapsedMs: 0, movableTiles: 0, confidence: 0 };

  const rememberedDirection = principalMoveCache.get(principalKey);
  let chosen = rootMoves.find((move) => move.direction === rememberedDirection)
    ?? [...rootMoves].sort((a, b) => directionRank(a.direction, anchor) - directionRank(b.direction, anchor))[0];
  let completedDepth = 0;
  let confidence = 0;
  const baseDepth = size === 4 ? (empty <= 2 ? 10 : empty <= 5 ? 7 : 5) : (empty <= 4 ? 5 : 4);
  const maxDepth = size === 4 && rootMoves.length <= 2 ? Math.min(11, baseDepth + 1) : baseDepth;
  if (searchCache.size > 120000) {
    let remaining = 40000;
    for (const staleKey of searchCache.keys()) {
      searchCache.delete(staleKey);
      if (--remaining === 0) break;
    }
  }
  const cache = searchCache;
  for (let depth = 1; depth <= maxDepth; depth += 1) {
    let depthBest = chosen;
    let depthBestScore = Number.NEGATIVE_INFINITY;
    let depthSecondScore = Number.NEGATIVE_INFINITY;
    const ordered = [...rootMoves].sort((a, b) => {
      if (a.direction === chosen.direction) return -1;
      if (b.direction === chosen.direction) return 1;
      return directionRank(a.direction, anchor) - directionRank(b.direction, anchor);
    });
    try {
      for (const result of ordered) {
        const score = result.gained * 8 - result.disturbance * 10
          + chanceSearch(result.board, size, anchor, depth - 1, cache, true);
        if (score > depthBestScore) {
          depthSecondScore = depthBestScore;
          depthBestScore = score;
          depthBest = result;
        } else if (score > depthSecondScore) depthSecondScore = score;
      }
      chosen = depthBest;
      principalMoveCache.set(principalKey, chosen.direction);
      completedDepth = depth;
      confidence = Number.isFinite(depthSecondScore) ? Math.max(0, depthBestScore - depthSecondScore) : 0;
    } catch (error) {
      if (error !== TIMEOUT) throw error;
      break;
    }
  }

  if (principalMoveCache.size > 24000) {
    let remaining = 8000;
    for (const staleKey of principalMoveCache.keys()) {
      principalMoveCache.delete(staleKey);
      if (--remaining === 0) break;
    }
  }

  return {
    id: message.id,
    direction: chosen.direction,
    anchor,
    strategy,
    depth: completedDepth || 1,
    nodes,
    elapsedMs: Math.round((performance.now() - started) * 10) / 10,
    movableTiles: chosen.movableTiles,
    confidence,
  };
}

export function decide(message: RequestMessage): ResponseMessage {
  if (supportsBitboard(message.board)) {
    try {
      return decideBitboard(message);
    } catch (error) {
      if (error !== BITBOARD_OVERFLOW) throw error;
      resetBitboardCaches();
    }
  }
  return decideArray(message);
}

if (typeof self !== "undefined") {
  const workerScope = self as unknown as {
    onmessage: ((event: MessageEvent<RequestMessage>) => void) | null;
    postMessage: (message: ResponseMessage) => void;
  };
  workerScope.onmessage = (event) => workerScope.postMessage(decide(event.data));
}
