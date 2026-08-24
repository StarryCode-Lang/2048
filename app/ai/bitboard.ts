type Direction = "up" | "down" | "left" | "right";
type Corner = 0 | 1 | 2 | 3;

export const BITBOARD_OVERFLOW = Symbol("bitboard-overflow");

export type BitboardRequest = {
  id: number;
  board: number[][];
  anchor: Corner;
  budgetMs: number;
  nodeBudget?: number;
};

export type BitboardResponse = {
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

type PackedMove = {
  direction: Direction;
  lo: number;
  hi: number;
  gained: number;
  movableTiles: number;
  disturbance: number;
};

const DIRECTIONS: Direction[] = ["down", "left", "right", "up"];
const TIMEOUT = Symbol("bitboard-timeout");
const ROW_STATES = 1 << 16;
const ROUTE_DECAY = Array.from({ length: 16 }, (_, rank) => Math.pow(.84, rank));
const moveCache = new Map<string, PackedMove[]>();
const searchCache = new Map<string, number>();
const evaluationCache = new Map<string, number>();
const principalMoveCache = new Map<string, Direction>();
let deadline = 0;
let nodes = 0;
let nodeLimit = Number.POSITIVE_INFINITY;

function lineTransition(code: number, reverse: boolean) {
  const input = [code & 15, (code >>> 4) & 15, (code >>> 8) & 15, (code >>> 12) & 15];
  const powers = reverse ? [...input].reverse() : input;
  const slots: Array<{ power: number; merged: boolean; source: number }> = [];
  const active = new Uint8Array(4);
  let gained = 0;
  let movableTiles = 0;
  let disturbance = 0;
  const markActive = (source: number) => {
    if (active[source]) return;
    active[source] = 1;
    movableTiles += 1;
    disturbance += powers[source] * powers[source];
  };
  for (let source = 0; source < 4; source += 1) {
    const power = powers[source];
    if (!power) continue;
    const last = slots.length - 1;
    let target = last + 1;
    let merged = false;
    if (last >= 0 && slots[last].power === power && !slots[last].merged) {
      markActive(slots[last].source);
      slots[last].power += 1;
      slots[last].merged = true;
      target = last;
      merged = true;
      gained += 2 ** (power + 1);
    } else slots.push({ power, merged: false, source });
    if (source !== target || merged) markActive(source);
  }
  const output = [0, 0, 0, 0];
  slots.forEach((slot, index) => { output[index] = slot.power; });
  if (reverse) output.reverse();
  let packed = 0;
  let overflow = false;
  for (let index = 0; index < 4; index += 1) {
    overflow ||= output[index] > 15;
    packed |= (output[index] & 15) << (index * 4);
  }
  return {
    output: packed >>> 0,
    gained,
    movableTiles,
    disturbance,
    changed: output.some((power, index) => power !== input[index]),
    overflow,
  };
}

function lineScore(code: number) {
  const powers = [code & 15, (code >>> 4) & 15, (code >>> 8) & 15, (code >>> 12) & 15];
  let empty = 0;
  let sum = 0;
  let merges = 0;
  let monotonicLeft = 0;
  let monotonicRight = 0;
  let previousCompact = 0;
  for (let index = 0; index < 4; index += 1) {
    const power = powers[index];
    if (!power) empty += 1;
    else {
      if (previousCompact === power) merges += 1;
      previousCompact = power;
    }
    const next = index < 3 ? powers[index + 1] : 0;
    sum += Math.pow(power, 3.5);
    if (power > next) monotonicLeft += Math.pow(power, 4) - Math.pow(next, 4);
    else monotonicRight += Math.pow(next, 4) - Math.pow(power, 4);
  }
  return empty * 270 + merges * 700 - Math.min(monotonicLeft, monotonicRight) * 47 - sum * 11;
}

function buildRowTables() {
  const left = new Uint16Array(ROW_STATES);
  const right = new Uint16Array(ROW_STATES);
  const leftGained = new Uint32Array(ROW_STATES);
  const rightGained = new Uint32Array(ROW_STATES);
  const leftMovable = new Uint8Array(ROW_STATES);
  const rightMovable = new Uint8Array(ROW_STATES);
  const leftDisturbance = new Uint16Array(ROW_STATES);
  const rightDisturbance = new Uint16Array(ROW_STATES);
  const leftChanged = new Uint8Array(ROW_STATES);
  const rightChanged = new Uint8Array(ROW_STATES);
  const leftOverflow = new Uint8Array(ROW_STATES);
  const rightOverflow = new Uint8Array(ROW_STATES);
  const score = new Float64Array(ROW_STATES);
  for (let code = 0; code < ROW_STATES; code += 1) {
    const toLeft = lineTransition(code, false);
    const toRight = lineTransition(code, true);
    left[code] = toLeft.output;
    right[code] = toRight.output;
    leftGained[code] = toLeft.gained;
    rightGained[code] = toRight.gained;
    leftMovable[code] = toLeft.movableTiles;
    rightMovable[code] = toRight.movableTiles;
    leftDisturbance[code] = toLeft.disturbance;
    rightDisturbance[code] = toRight.disturbance;
    leftChanged[code] = Number(toLeft.changed);
    rightChanged[code] = Number(toRight.changed);
    leftOverflow[code] = Number(toLeft.overflow);
    rightOverflow[code] = Number(toRight.overflow);
    score[code] = lineScore(code);
  }
  return {
    left, right, leftGained, rightGained, leftMovable, rightMovable,
    leftDisturbance, rightDisturbance, leftChanged, rightChanged,
    leftOverflow, rightOverflow, score,
  };
}

const rows = buildRowTables();

function routeFor(corner: Corner) {
  const top = corner < 2;
  const left = corner % 2 === 0;
  const route: number[] = [];
  for (let rowStep = 0; rowStep < 4; rowStep += 1) {
    const row = top ? rowStep : 3 - rowStep;
    const startsLeft = rowStep % 2 === 0 ? left : !left;
    for (let colStep = 0; colStep < 4; colStep += 1) {
      const col = startsLeft ? colStep : 3 - colStep;
      route.push(row * 4 + col);
    }
  }
  return route;
}

const ROUTES = [routeFor(0), routeFor(1), routeFor(2), routeFor(3)];

function getPower(lo: number, hi: number, index: number) {
  const word = index < 8 ? lo : hi;
  return (word >>> ((index & 7) * 4)) & 15;
}

function packedBoardKey(lo: number, hi: number) {
  return String.fromCharCode(lo & 0xffff, lo >>> 16, hi & 0xffff, hi >>> 16);
}

function treeKey(lo: number, hi: number, anchor: Corner, depth: number, kind: number) {
  return String.fromCharCode(depth | (anchor << 5) | (kind << 7), lo & 0xffff, lo >>> 16, hi & 0xffff, hi >>> 16);
}

function packBoard(board: number[][]) {
  let lo = 0;
  let hi = 0;
  const flat = board.flat();
  for (let index = 0; index < 16; index += 1) {
    const power = flat[index] ? Math.log2(flat[index]) : 0;
    if (index < 8) lo |= power << (index * 4);
    else hi |= power << ((index - 8) * 4);
  }
  return { lo: lo >>> 0, hi: hi >>> 0 };
}

function columnCode(lo: number, hi: number, col: number) {
  return getPower(lo, hi, col)
    | (getPower(lo, hi, col + 4) << 4)
    | (getPower(lo, hi, col + 8) << 8)
    | (getPower(lo, hi, col + 12) << 12);
}

function horizontalMove(lo: number, hi: number, direction: "left" | "right"): PackedMove | null {
  const table = direction === "left" ? rows.left : rows.right;
  const gainedTable = direction === "left" ? rows.leftGained : rows.rightGained;
  const movableTable = direction === "left" ? rows.leftMovable : rows.rightMovable;
  const disturbanceTable = direction === "left" ? rows.leftDisturbance : rows.rightDisturbance;
  const overflowTable = direction === "left" ? rows.leftOverflow : rows.rightOverflow;
  const row0 = lo & 0xffff;
  const row1 = lo >>> 16;
  const row2 = hi & 0xffff;
  const row3 = hi >>> 16;
  if (overflowTable[row0] || overflowTable[row1] || overflowTable[row2] || overflowTable[row3]) throw BITBOARD_OVERFLOW;
  const nextLo = (table[row0] | (table[row1] << 16)) >>> 0;
  const nextHi = (table[row2] | (table[row3] << 16)) >>> 0;
  if (nextLo === lo && nextHi === hi) return null;
  return {
    direction,
    lo: nextLo,
    hi: nextHi,
    gained: gainedTable[row0] + gainedTable[row1] + gainedTable[row2] + gainedTable[row3],
    movableTiles: movableTable[row0] + movableTable[row1] + movableTable[row2] + movableTable[row3],
    disturbance: disturbanceTable[row0] + disturbanceTable[row1] + disturbanceTable[row2] + disturbanceTable[row3],
  };
}

function verticalMove(lo: number, hi: number, direction: "up" | "down"): PackedMove | null {
  const table = direction === "up" ? rows.left : rows.right;
  const gainedTable = direction === "up" ? rows.leftGained : rows.rightGained;
  const movableTable = direction === "up" ? rows.leftMovable : rows.rightMovable;
  const disturbanceTable = direction === "up" ? rows.leftDisturbance : rows.rightDisturbance;
  const overflowTable = direction === "up" ? rows.leftOverflow : rows.rightOverflow;
  let nextLo = 0;
  let nextHi = 0;
  let gained = 0;
  let movableTiles = 0;
  let disturbance = 0;
  for (let col = 0; col < 4; col += 1) {
    const code = columnCode(lo, hi, col);
    if (overflowTable[code]) throw BITBOARD_OVERFLOW;
    let output = table[code];
    for (let row = 0; row < 4; row += 1) {
      const index = row * 4 + col;
      const power = output & 15;
      if (index < 8) nextLo |= power << (index * 4);
      else nextHi |= power << ((index - 8) * 4);
      output >>>= 4;
    }
    gained += gainedTable[code];
    movableTiles += movableTable[code];
    disturbance += disturbanceTable[code];
  }
  nextLo >>>= 0;
  nextHi >>>= 0;
  if (nextLo === lo && nextHi === hi) return null;
  return { direction, lo: nextLo, hi: nextHi, gained, movableTiles, disturbance };
}

function packedMove(lo: number, hi: number, direction: Direction) {
  return direction === "left" || direction === "right"
    ? horizontalMove(lo, hi, direction)
    : verticalMove(lo, hi, direction);
}

function legalMoves(lo: number, hi: number) {
  const key = packedBoardKey(lo, hi);
  const cached = moveCache.get(key);
  if (cached) return cached;
  const moves = DIRECTIONS.flatMap((direction) => {
    const result = packedMove(lo, hi, direction);
    return result ? [result] : [];
  });
  if (moveCache.size > 16000) {
    let remaining = 4000;
    for (const staleKey of moveCache.keys()) {
      moveCache.delete(staleKey);
      if (--remaining === 0) break;
    }
  }
  moveCache.set(key, moves);
  return moves;
}

function maxPowerOf(lo: number, hi: number) {
  let maxPower = 0;
  for (let index = 0; index < 16; index += 1) maxPower = Math.max(maxPower, getPower(lo, hi, index));
  return maxPower;
}

function cornerIndex(corner: Corner) {
  return [0, 3, 12, 15][corner];
}

function strategicMoves(lo: number, hi: number, anchor: Corner) {
  const moves = legalMoves(lo, hi);
  const maxPower = maxPowerOf(lo, hi);
  const anchorPosition = cornerIndex(anchor);
  if (maxPower < 7 || getPower(lo, hi, anchorPosition) !== maxPower) return moves;
  const preserving = moves.filter((result) => getPower(result.lo, result.hi, anchorPosition) >= maxPower);
  return preserving.length ? preserving : moves;
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

function hasLegalMove(lo: number, hi: number) {
  for (let index = 0; index < 16; index += 1) {
    const power = getPower(lo, hi, index);
    if (!power) return true;
    const row = Math.floor(index / 4);
    const col = index % 4;
    if (col < 3 && getPower(lo, hi, index + 1) === power) return true;
    if (row < 3 && getPower(lo, hi, index + 4) === power) return true;
  }
  return false;
}

function evaluate(lo: number, hi: number, anchor: Corner) {
  const key = treeKey(lo, hi, anchor, 0, 0);
  const cached = evaluationCache.get(key);
  if (cached !== undefined) return cached;
  let score = rows.score[lo & 0xffff] + rows.score[lo >>> 16]
    + rows.score[hi & 0xffff] + rows.score[hi >>> 16];
  for (let col = 0; col < 4; col += 1) score += rows.score[columnCode(lo, hi, col)];
  const maxPower = maxPowerOf(lo, hi);
  const route = ROUTES[anchor];
  const anchorPosition = route[0];
  let nearestMaxDistance = 8;
  let inversion = 0;
  let chainLength = 0;
  for (let index = 0; index < 16; index += 1) {
    if (getPower(lo, hi, index) === maxPower) {
      const distance = Math.abs(Math.floor(index / 4) - Math.floor(anchorPosition / 4))
        + Math.abs(index % 4 - anchorPosition % 4);
      nearestMaxDistance = Math.min(nearestMaxDistance, distance);
    }
    const routePower = getPower(lo, hi, route[index]);
    const next = index < 15 ? getPower(lo, hi, route[index + 1]) : 0;
    if (next > routePower) inversion += (next - routePower) * ROUTE_DECAY[index];
    if (routePower && (index === 0 || getPower(lo, hi, route[index - 1]) >= routePower) && chainLength === index) chainLength += 1;
  }
  const cornerScore = nearestMaxDistance === 0
    ? Math.pow(maxPower, 4) * 28
    : -nearestMaxDistance * Math.pow(maxPower, 4) * 18;
  const lateStructure = Math.max(0, maxPower - 10);
  score += cornerScore + chainLength * chainLength * 120 - inversion * 420 * (1 + lateStructure * .6);
  if (!hasLegalMove(lo, hi)) score = -1e9 + score;
  if (evaluationCache.size > 120000) {
    let remaining = 40000;
    for (const staleKey of evaluationCache.keys()) {
      evaluationCache.delete(staleKey);
      if (--remaining === 0) break;
    }
  }
  evaluationCache.set(key, score);
  return score;
}

function checkTime() {
  nodes += 1;
  if (nodes >= nodeLimit || ((nodes & 31) === 0 && performance.now() >= deadline)) throw TIMEOUT;
}

function sampledEmptyIndices(lo: number, hi: number, anchor: Corner, limit: number) {
  const empties: number[] = [];
  for (const index of ROUTES[anchor]) if (!getPower(lo, hi, index)) empties.push(index);
  if (empties.length <= limit) return empties;
  let hash = 2166136261;
  for (let index = 0; index < 16; index += 1) hash = Math.imul(hash ^ getPower(lo, hi, index), 16777619);
  const offset = (hash >>> 0) % empties.length;
  const sampled: number[] = [];
  for (let index = 0; index < limit; index += 1) {
    sampled.push(empties[(offset + Math.floor(index * empties.length / limit)) % empties.length]);
  }
  return sampled;
}

function emptyIndices(lo: number, hi: number) {
  const empties: number[] = [];
  for (let index = 0; index < 16; index += 1) if (!getPower(lo, hi, index)) empties.push(index);
  return empties;
}

function chanceSearch(lo: number, hi: number, anchor: Corner, depth: number, exact = false): number {
  checkTime();
  const key = treeKey(lo, hi, anchor, depth, exact ? 2 : 1);
  const cached = searchCache.get(key);
  if (cached !== undefined) return cached;
  const spawnIndices = exact ? emptyIndices(lo, hi) : sampledEmptyIndices(lo, hi, anchor, 6);
  if (!spawnIndices.length) return maxSearch(lo, hi, anchor, depth);
  let total = 0;
  let worst = Number.POSITIVE_INFINITY;
  for (const index of spawnIndices) {
    const shift = (index & 7) * 4;
    const twoLo = index < 8 ? (lo | (1 << shift)) >>> 0 : lo;
    const twoHi = index < 8 ? hi : (hi | (1 << shift)) >>> 0;
    const fourLo = index < 8 ? (lo | (2 << shift)) >>> 0 : lo;
    const fourHi = index < 8 ? hi : (hi | (2 << shift)) >>> 0;
    const outcome = .9 * maxSearch(twoLo, twoHi, anchor, depth)
      + .1 * maxSearch(fourLo, fourHi, anchor, depth);
    total += outcome;
    if (outcome < worst) worst = outcome;
  }
  const average = total / spawnIndices.length;
  const riskWeight = spawnIndices.length <= 3 ? .24 : spawnIndices.length <= 5 ? .06 : 0;
  const score = average * (1 - riskWeight) + worst * riskWeight;
  searchCache.set(key, score);
  return score;
}

function maxSearch(lo: number, hi: number, anchor: Corner, depth: number): number {
  checkTime();
  if (depth <= 0) return evaluate(lo, hi, anchor);
  const key = treeKey(lo, hi, anchor, depth, 3);
  const cached = searchCache.get(key);
  if (cached !== undefined) return cached;
  const moves = strategicMoves(lo, hi, anchor);
  if (!moves.length) return -1e9;
  let best = Number.NEGATIVE_INFINITY;
  for (const result of moves) {
    const score = result.gained * 7 - result.disturbance * 9
      + chanceSearch(result.lo, result.hi, anchor, depth - 1);
    if (score > best) best = score;
  }
  searchCache.set(key, best);
  return best;
}

export function resetBitboardCaches() {
  moveCache.clear();
  searchCache.clear();
  evaluationCache.clear();
  principalMoveCache.clear();
}

/** Uses four-bit cells only while total board mass proves a 65536 tile cannot appear in this search. */
export function supportsBitboard(board: number[][]) {
  if (board.length !== 4 || board.some((row) => row.length !== 4)) return false;
  const values = board.flat();
  return values.every((value) => value === 0 || (Number.isSafeInteger(value) && value > 0 && Number.isInteger(Math.log2(value)) && value <= 32768))
    && values.reduce((sum, value) => sum + value, 0) + 48 < 65536;
}

export function decideBitboard(message: BitboardRequest): BitboardResponse {
  const started = performance.now();
  const deterministicNodeBudget = Number.isFinite(message.nodeBudget) ? Math.max(256, Math.floor(message.nodeBudget!)) : 0;
  deadline = deterministicNodeBudget ? Number.POSITIVE_INFINITY : started + Math.max(30, Math.min(240, message.budgetMs));
  nodes = 0;
  const { lo, hi } = packBoard(message.board);
  let empty = 0;
  for (let index = 0; index < 16; index += 1) if (!getPower(lo, hi, index)) empty += 1;
  const maxPower = maxPowerOf(lo, hi);
  const budgetScale = message.budgetMs >= 90 ? 1.7 : message.budgetMs >= 45 ? 1 : .65;
  // The packed engine is roughly four times faster than the general array
  // path, so early play can search more nodes without changing UI pacing.
  const searchBase = maxPower >= 11 || empty <= 5 ? 60000 : 48000;
  nodeLimit = deterministicNodeBudget || Math.floor(searchBase * budgetScale);
  const anchor = message.anchor;
  const principalKey = String.fromCharCode(anchor, ...[lo & 0xffff, lo >>> 16, hi & 0xffff, hi >>> 16]);
  const strategy = getPower(lo, hi, cornerIndex(anchor)) === maxPower ? "lock" : "recover";
  const rootMoves = strategicMoves(lo, hi, anchor);
  if (!rootMoves.length) return { id: message.id, direction: null, anchor, strategy, depth: 0, nodes, elapsedMs: 0, movableTiles: 0, confidence: 0 };
  const rememberedDirection = principalMoveCache.get(principalKey);
  let chosen = rootMoves.find((move) => move.direction === rememberedDirection)
    ?? [...rootMoves].sort((a, b) => directionRank(a.direction, anchor) - directionRank(b.direction, anchor))[0];
  let completedDepth = 0;
  let confidence = 0;
  const baseDepth = empty <= 2 ? 10 : empty <= 5 ? 7 : 5;
  const maxDepth = rootMoves.length <= 2 ? Math.min(11, baseDepth + 1) : baseDepth;
  if (searchCache.size > 120000) {
    let remaining = 40000;
    for (const staleKey of searchCache.keys()) {
      searchCache.delete(staleKey);
      if (--remaining === 0) break;
    }
  }
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
          + chanceSearch(result.lo, result.hi, anchor, depth - 1, true);
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

/** Exact bitboard transition exposed only for rule-equivalence regression tests. */
export function moveBitboardForTesting(board: number[][], direction: Direction) {
  const { lo, hi } = packBoard(board);
  const result = packedMove(lo, hi, direction);
  if (!result) return null;
  return {
    board: Array.from({ length: 4 }, (_, row) => Array.from({ length: 4 }, (_, col) => {
      const power = getPower(result.lo, result.hi, row * 4 + col);
      return power ? 2 ** power : 0;
    })),
    gained: result.gained,
    movableTiles: result.movableTiles,
    disturbance: result.disturbance,
  };
}
