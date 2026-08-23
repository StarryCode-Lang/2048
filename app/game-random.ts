export type GameBoard = number[][];
export type SpawnPoint = { row: number; col: number };

export type SpawnResult = {
  board: GameBoard;
  point: SpawnPoint | null;
  value: 0 | 2 | 4;
};

/** Official 2048 order: choose 2/4 first, then choose uniformly from empty cells. */
export function spawnRandomTile(board: GameBoard, random: () => number = Math.random): SpawnResult {
  const open: SpawnPoint[] = [];
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      if (board[row][col] === 0) open.push({ row, col });
    }
  }
  if (!open.length) return { board, point: null, value: 0 };

  const value = random() < 0.9 ? 2 : 4;
  const positionRoll = Math.min(Math.max(random(), 0), 1 - Number.EPSILON);
  const point = open[Math.floor(positionRoll * open.length)];
  const next = board.map((line) => [...line]);
  next[point.row][point.col] = value;
  return { board: next, point, value };
}
