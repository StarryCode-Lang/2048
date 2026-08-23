export type Direction = "up" | "down" | "left" | "right";
export type Board = number[][];
export type CellPoint = { row: number; col: number };
export type TileMotion = {
  id: string;
  value: number;
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  merging: boolean;
  moving: boolean;
};

export function emptyBoard(size: number): Board {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

export function copyBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

function linePoint(direction: Direction, line: number, offset: number, size: number): CellPoint {
  if (direction === "left") return { row: line, col: offset };
  if (direction === "right") return { row: line, col: size - 1 - offset };
  if (direction === "up") return { row: offset, col: line };
  return { row: size - 1 - offset, col: line };
}

/** Official 2048 movement: slide fully, merge equal neighbors once, add merged values to score. */
export function moveBoard(board: Board, direction: Direction, moveNumber = 0) {
  const size = board.length;
  const next = emptyBoard(size);
  const motions: TileMotion[] = [];
  const mergedPoints: CellPoint[] = [];
  let gained = 0;
  for (let line = 0; line < size; line += 1) {
    const slots: Array<{ value: number; merged: boolean }> = [];
    for (let offset = 0; offset < size; offset += 1) {
      const from = linePoint(direction, line, offset, size);
      const value = board[from.row][from.col];
      if (!value) continue;
      const last = slots.length - 1;
      let targetOffset: number;
      let merging = false;
      if (last >= 0 && slots[last].value === value && !slots[last].merged) {
        slots[last] = { value: value * 2, merged: true };
        gained += value * 2;
        targetOffset = last;
        merging = true;
        mergedPoints.push(linePoint(direction, line, targetOffset, size));
      } else {
        slots.push({ value, merged: false });
        targetOffset = slots.length - 1;
      }
      const to = linePoint(direction, line, targetOffset, size);
      motions.push({
        id: `${moveNumber}-${from.row}-${from.col}`,
        value,
        fromRow: from.row,
        fromCol: from.col,
        toRow: to.row,
        toCol: to.col,
        merging,
        moving: from.row !== to.row || from.col !== to.col,
      });
    }
    slots.forEach((slot, offset) => {
      const point = linePoint(direction, line, offset, size);
      next[point.row][point.col] = slot.value;
    });
  }
  return { board: next, gained, motions, mergedPoints };
}

export function sameBoard(a: Board, b: Board) {
  return a.every((row, rowIndex) => row.every((value, colIndex) => value === b[rowIndex][colIndex]));
}

export function hasMoves(board: Board) {
  if (board.some((row) => row.some((value) => value === 0))) return true;
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      if (board[row][col] === board[row + 1]?.[col] || board[row][col] === board[row][col + 1]) return true;
    }
  }
  return false;
}

export function countEmpty(board: Board) {
  let total = 0;
  for (const row of board) for (const value of row) if (!value) total += 1;
  return total;
}
