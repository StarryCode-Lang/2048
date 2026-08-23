import { emptyBoard, hasMoves, moveBoard } from "../game/engine.ts";
import { nextSeededRandom, spawnRandomTile } from "../game/random.ts";
import { decide, resetAiCaches } from "./worker.ts";

type Corner = 0 | 1 | 2 | 3;

export type AiSimulationResult = {
  seed: number;
  board: number[][];
  score: number;
  moves: number;
  maxTile: number;
  rngState: number;
};

export function simulateAiGame({
  seed,
  size = 4,
  maxMoves = 600,
  nodeBudget = 256,
  anchor = 0,
}: {
  seed: number;
  size?: number;
  maxMoves?: number;
  nodeBudget?: number;
  anchor?: Corner;
}): AiSimulationResult {
  resetAiCaches();
  let rngState = seed >>> 0 || 1;
  const random = () => {
    const generated = nextSeededRandom(rngState);
    rngState = generated.state;
    return generated.value;
  };
  let board = emptyBoard(size);
  board = spawnRandomTile(board, random).board;
  board = spawnRandomTile(board, random).board;
  let score = 0;
  let moves = 0;

  while (moves < maxMoves && hasMoves(board)) {
    const decision = decide({
      id: moves + 1,
      board,
      anchor,
      budgetMs: 30,
      nodeBudget,
    });
    if (!decision.direction) break;
    const shifted = moveBoard(board, decision.direction, moves + 1);
    board = spawnRandomTile(shifted.board, random).board;
    score += shifted.gained;
    moves += 1;
  }

  return {
    seed: seed >>> 0,
    board,
    score,
    moves,
    maxTile: Math.max(...board.flat()),
    rngState,
  };
}
