import { moveBoard, sameBoard, type Board, type Direction } from "../game/engine.ts";

/** A compact afterstate evaluator inspired by N-tuple 2048 agents.
 * It deliberately contains no learned weights or random-state access, so it is
 * safe to run as an on-demand comparison engine beside the established search.
 */
export type ExpertCorner = 0 | 1 | 2 | 3;
export type ExpertDecision = {
  direction: Direction | null;
  anchor: ExpertCorner;
  strategy: "lock" | "recover";
  depth: number;
  nodes: number;
  elapsedMs: number;
  movableTiles: number;
  confidence: number;
};

const DIRECTIONS: Direction[] = ["left", "up", "right", "down"];
const ROUTE_DECAY = Array.from({ length: 36 }, (_, index) => Math.pow(0.86, index));

function power(value: number) {
  return value ? Math.log2(value) : 0;
}

function route(size: number, anchor: ExpertCorner) {
  const top = anchor < 2;
  const left = anchor % 2 === 0;
  const output: number[] = [];
  for (let rowStep = 0; rowStep < size; rowStep += 1) {
    const row = top ? rowStep : size - 1 - rowStep;
    const startsLeft = rowStep % 2 === 0 ? left : !left;
    for (let colStep = 0; colStep < size; colStep += 1) {
      const col = startsLeft ? colStep : size - 1 - colStep;
      output.push(row * size + col);
    }
  }
  return output;
}

function tuplePatterns(size: number, anchor: ExpertCorner) {
  const patterns: number[][] = [];
  const addLine = (start: number, stride: number) => {
    const tuple: number[] = [];
    for (let offset = 0; offset < size; offset += 1) tuple.push(start + offset * stride);
    patterns.push(tuple);
  };
  for (let row = 0; row < size; row += 1) addLine(row * size, 1);
  for (let col = 0; col < size; col += 1) addLine(col, size);
  const corner = anchor === 0 ? 0 : anchor === 1 ? size - 1 : anchor === 2 ? (size - 1) * size : size * size - 1;
  const cornerRow = Math.floor(corner / size);
  const cornerCol = corner % size;
  for (const rowDelta of [0, cornerRow === 0 ? 1 : -1]) {
    for (const colDelta of [0, cornerCol === 0 ? 1 : -1]) {
      if (rowDelta === 0 || colDelta === 0) continue;
      const tuple: number[] = [];
      for (let row = 0; row < 2; row += 1) {
        for (let col = 0; col < 2; col += 1) tuple.push((cornerRow + row * rowDelta) * size + cornerCol + col * colDelta);
      }
      patterns.push(tuple);
    }
  }
  return patterns;
}

function emptyCells(board: Board) {
  const output: number[] = [];
  board.forEach((row, rowIndex) => row.forEach((value, colIndex) => { if (!value) output.push(rowIndex * board.length + colIndex); }));
  return output;
}

function put(board: Board, index: number, value: number) {
  const next = board.map((row) => [...row]);
  next[Math.floor(index / board.length)][index % board.length] = value;
  return next;
}

function nTupleScore(board: Board, anchor: ExpertCorner) {
  const size = board.length;
  const flattened = board.flat();
  const powers = flattened.map(power);
  const maxPower = Math.max(...powers);
  const patterns = tuplePatterns(size, anchor);
  let score = 0;
  for (const tuple of patterns) {
    let total = 0;
    let monotonic = 0;
    for (let index = 0; index < tuple.length; index += 1) {
      const current = powers[tuple[index]];
      const next = index + 1 < tuple.length ? powers[tuple[index + 1]] : 0;
      total += current * current * (1 + index / tuple.length);
      if (current >= next) monotonic += (current - next) * (index + 1);
      else monotonic -= (next - current) * (index + 1) * 1.45;
    }
    score += total * 1.8 + monotonic * 16;
  }
  const snake = route(size, anchor);
  let chain = 0;
  let routeScore = 0;
  snake.forEach((index, position) => {
    const current = powers[index];
    const next = position + 1 < snake.length ? powers[snake[position + 1]] : 0;
    routeScore += current * current * ROUTE_DECAY[position];
    if (current && (position === 0 || powers[snake[position - 1]] >= current) && chain === position) chain += 1;
    if (next > current) routeScore -= (next - current) * (position + 1) * 8;
  });
  const empties = powers.reduce((count, value) => count + (value ? 0 : 1), 0);
  const cornerPower = powers[snake[0]];
  score += routeScore * 22 + chain * chain * 48 + empties * 120;
  score += cornerPower === maxPower ? Math.pow(maxPower, 4) * 12 : -Math.abs(maxPower - cornerPower) * 90;
  return score;
}

function sampledEmptyCells(board: Board, anchor: ExpertCorner, limit: number) {
  const cells = emptyCells(board);
  if (cells.length <= limit) return cells;
  const ordered = route(board.length, anchor).filter((index) => !board[Math.floor(index / board.length)][index % board.length]);
  const selected: number[] = [];
  for (let index = 0; index < limit; index += 1) selected.push(ordered[Math.floor(index * ordered.length / limit)]);
  return selected;
}

function legalMoves(board: Board) {
  return DIRECTIONS.flatMap((direction) => {
    const moved = moveBoard(board, direction, 0);
    if (sameBoard(board, moved.board)) return [];
    const before = board.flat();
    const after = moved.board.flat();
    const movableTiles = before.reduce((count, value, index) => count + (value !== after[index] ? 1 : 0), 0);
    return [{ direction, moved, movableTiles }];
  });
}

/** Choose a move with shallow chance lookahead and an afterstate N-tuple score. */
export function decideExpert(
  board: Board,
  anchor: ExpertCorner,
  budgetMs: number,
  id = 0,
  deterministicNodeBudget?: number,
): ExpertDecision & { id: number } {
  const started = performance.now();
  // Convert the UI time budget into a deterministic work budget. This keeps
  // identical boards reproducible across browsers with different clocks.
  const nodeLimit = Number.isFinite(deterministicNodeBudget)
    ? Math.max(256, Math.floor(deterministicNodeBudget!))
    : Math.max(600, Math.floor(Math.max(20, Math.min(240, budgetMs)) * 48));
  let nodes = 0;
  const root = legalMoves(board);
  const maxTile = Math.max(...board.flat());
  const cornerIndex = anchor === 0 ? 0 : anchor === 1 ? board.length - 1 : anchor === 2 ? (board.length - 1) * board.length : board.length * board.length - 1;
  const strategy = board[Math.floor(cornerIndex / board.length)][cornerIndex % board.length] === maxTile ? "lock" : "recover";
  if (!root.length) return { id, direction: null, anchor, strategy, depth: 0, nodes, elapsedMs: 0, movableTiles: 0, confidence: 0 };
  // Divide deterministic work evenly between legal root moves so an early
  // direction cannot consume the whole budget and bias later directions.
  const perRootLimit = Math.max(32, Math.floor(nodeLimit / root.length));
  const sampleLimit = Math.min(board.length === 4 ? 8 : 5, Math.max(1, Math.floor(perRootLimit / 10)));
  const scored = root.map(({ direction, moved, movableTiles }, order) => {
    const base = moved.gained * 9 + nTupleScore(moved.board, anchor);
    const cells = sampledEmptyCells(moved.board, anchor, sampleLimit);
    let expected = 0;
    let worst = Number.POSITIVE_INFINITY;
    let rootNodes = 0;
    for (const cell of cells) {
      let spawnExpectation = 0;
      for (const tile of [2, 4]) {
        const spawned = put(moved.board, cell, tile);
        const followMoves = legalMoves(spawned);
        // A terminal spawn must never look attractive merely because the full
        // board contains large, well-ordered tiles.
        let bestFollow = followMoves.length ? nTupleScore(spawned, anchor) : -1e9;
        for (const follow of followMoves) {
          bestFollow = Math.max(bestFollow, nTupleScore(follow.moved.board, anchor) + follow.moved.gained * 8);
          nodes += 1;
          rootNodes += 1;
          if (rootNodes >= perRootLimit) break;
        }
        spawnExpectation += (tile === 2 ? 0.9 : 0.1) * bestFollow;
        nodes += 1;
        rootNodes += 1;
        if (rootNodes >= perRootLimit) break;
      }
      expected += spawnExpectation;
      worst = Math.min(worst, spawnExpectation);
      if (rootNodes >= perRootLimit) break;
    }
    const sampled = Math.max(1, Math.min(cells.length, Math.ceil(rootNodes / 2)));
    const average = expected / sampled;
    const riskWeight = cells.length <= 2 ? 0.26 : cells.length <= 4 ? 0.1 : 0;
    const chanceScore = Number.isFinite(worst)
      ? average * (1 - riskWeight) + worst * riskWeight
      : nTupleScore(moved.board, anchor);
    return { direction, score: base + chanceScore - order * 0.001, movableTiles };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const second = scored[1];
  return {
    id,
    direction: best.direction,
    anchor,
    strategy,
    depth: 2,
    nodes,
    elapsedMs: Math.round((performance.now() - started) * 10) / 10,
    movableTiles: best.movableTiles,
    confidence: second ? Math.max(0, best.score - second.score) : 0,
  };
}
