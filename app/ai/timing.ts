import { moveBoard, sameBoard, type Direction } from "../game/engine.ts";

export const AI_SPEEDS = [
  { label: "极速", target: 32, budget: 30, animation: 14, settle: 18 },
  { label: "100ms", target: 100, budget: 46, animation: 30, settle: 46 },
  { label: "500ms", target: 500, budget: 100, animation: 56, settle: 76 },
] as const;

const DIRECTIONS: Direction[] = ["up", "right", "down", "left"];

export function legalMoveCount(board: number[][]) {
  let total = 0;
  for (const direction of DIRECTIONS) {
    if (!sameBoard(board, moveBoard(board, direction).board)) total += 1;
  }
  return total;
}

export function isEndgameSearch(board: number[][]) {
  if (board.length !== 4) return false;
  const values = board.flat();
  const maxTile = Math.max(...values);
  const empty = values.filter((value) => value === 0).length;
  return (maxTile >= 2048 && empty <= 4) || legalMoveCount(board) <= 2;
}

/** Spend saved early-game time only where deeper search materially changes survival odds. */
export function aiBudgetFor(board: number[][], speedIndex: number) {
  const safeIndex = Math.min(AI_SPEEDS.length - 1, Math.max(0, speedIndex));
  const base = AI_SPEEDS[safeIndex].budget;
  if (!isEndgameSearch(board)) return base;
  const values = board.flat();
  const maxTile = Math.max(...values);
  const empty = values.filter((value) => value === 0).length;
  const legal = legalMoveCount(board);
  const critical = empty <= 1 || legal <= 1 || (maxTile >= 8192 && empty <= 2);
  return Math.max(base, (critical ? [120, 180, 240] : [82, 120, 180])[safeIndex]);
}
