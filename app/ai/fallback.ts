import { countEmpty, moveBoard, sameBoard, type Board, type CellPoint, type Direction } from "../game/engine.ts";

export type AiCorner = 0 | 1 | 2 | 3;

const DIRECTIONS: Direction[] = ["down", "left", "right", "up"];

export const DIRECTION_ARROWS: Record<Direction, string> = {
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
};

export function snakePositions(size: number, corner: AiCorner): CellPoint[] {
  const top = corner < 2;
  const left = corner % 2 === 0;
  const positions: CellPoint[] = [];
  for (let rowStep = 0; rowStep < size; rowStep += 1) {
    const row = top ? rowStep : size - 1 - rowStep;
    const startsFromLeft = rowStep % 2 === 0 ? left : !left;
    for (let colStep = 0; colStep < size; colStep += 1) {
      positions.push({ row, col: startsFromLeft ? colStep : size - 1 - colStep });
    }
  }
  return positions;
}

/** Legal deterministic fallback used only if the AI Worker cannot answer. */
export function chooseFallbackMove(board: Board, anchor: AiCorner): Direction | null {
  const legal = DIRECTIONS.flatMap((direction, order) => {
    const moved = moveBoard(board, direction, 0);
    return sameBoard(board, moved.board) ? [] : [{ direction, order, moved }];
  });
  const anchorPoint = snakePositions(board.length, anchor)[0];
  const maxValue = Math.max(...board.flat());
  const anchored = maxValue >= 128 && board[anchorPoint.row][anchorPoint.col] === maxValue;
  const preserving = anchored
    ? legal.filter(({ moved }) => moved.board[anchorPoint.row][anchorPoint.col] >= maxValue)
    : [];
  const candidates = preserving.length ? preserving : legal;
  let bestDirection: Direction | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  candidates.forEach(({ direction, order, moved }) => {
    const routeScore = snakePositions(board.length, anchor).reduce((total, point, index) => {
      const power = moved.board[point.row][point.col] ? Math.log2(moved.board[point.row][point.col]) : 0;
      return total + power * power * Math.pow(0.78, index) * 100;
    }, 0);
    const score = routeScore + countEmpty(moved.board) * 500 + moved.gained * 8 - order * 0.001;
    if (score > bestScore) {
      bestScore = score;
      bestDirection = direction;
    }
  });
  return bestDirection;
}
