import { copyBoard, moveBoard, sameBoard, type Board, type Direction } from "../game/engine.ts";
import { nextSeededRandom, spawnRandomTile } from "../game/random.ts";
import type { DirectionCode, ReplayEvent } from "./log.ts";

type ReplayState = {
  board: Board;
  score: number;
  moves: number;
  rngState: number;
};

const DIRECTIONS: Record<DirectionCode, Direction> = {
  0: "up",
  1: "right",
  2: "down",
  3: "left",
};

/** Rebuild an exact session, including random spawns and human undo events. */
export function reconstructReplay(
  initial: ReplayState,
  events: ReplayEvent[],
): ReplayState {
  let current: ReplayState = {
    board: copyBoard(initial.board),
    score: initial.score,
    moves: initial.moves,
    rngState: initial.rngState >>> 0,
  };
  const history: ReplayState[] = [];

  events.forEach((event, index) => {
    if (event.kind === "undo") {
      const snapshot = history.pop();
      if (!snapshot) throw new Error(`Replay action ${index} cannot undo an empty history`);
      current = snapshot;
      return;
    }

    const moved = moveBoard(current.board, DIRECTIONS[event.direction], current.moves + 1);
    if (sameBoard(current.board, moved.board)) {
      throw new Error(`Replay action ${index} contains an invalid move`);
    }
    history.push({ ...current, board: copyBoard(current.board) });
    let rngState = current.rngState;
    const random = () => {
      const generated = nextSeededRandom(rngState);
      rngState = generated.state;
      return generated.value;
    };
    const spawned = spawnRandomTile(moved.board, random);
    current = {
      board: spawned.board,
      score: current.score + moved.gained,
      moves: current.moves + 1,
      rngState,
    };
  });

  return current;
}
