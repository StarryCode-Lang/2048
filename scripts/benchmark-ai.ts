import { decide } from "../app/ai/worker.ts";
import { aiBudgetFor } from "../app/ai/timing.ts";
import { emptyBoard, hasMoves, moveBoard } from "../app/game/engine.ts";
import { nextSeededRandom, spawnRandomTile } from "../app/game/random.ts";
import { readFileSync } from "node:fs";

type State = { board: number[][]; score: number; moves: number; rng: number };

function spawn(board: number[][], state: number) {
  let nextState = state;
  const random = () => {
    const generated = nextSeededRandom(nextState);
    nextState = generated.state;
    return generated.value;
  };
  return { board: spawnRandomTile(board, random).board, state: nextState };
}

const seed = Number(process.argv[2] ?? 131556) >>> 0;
const speedIndex = Math.min(2, Math.max(0, Number(process.argv[3] ?? 0)));
const targetScore = Number(process.argv[4] ?? 324000);
const maxActions = Number(process.argv[5] ?? 100000);
const fixedBudget = Number(process.argv[6] ?? 0);
const nodeBudget = Number(process.argv[7] ?? 0);
const resumePath = process.argv[8];
let state: State;
if (resumePath) {
  state = JSON.parse(readFileSync(resumePath, "utf8")) as State;
} else {
  state = { board: emptyBoard(4), score: 0, moves: 0, rng: seed };
  for (let count = 0; count < 2; count += 1) {
    const added = spawn(state.board, state.rng);
    state = { ...state, board: added.board, rng: added.state };
  }
}

let actions = 0;
const started = performance.now();

while (actions < maxActions) {
  actions += 1;
  const decision = decide({
    id: actions,
    board: state.board,
    anchor: 0,
    budgetMs: fixedBudget || aiBudgetFor(state.board, speedIndex),
    nodeBudget: nodeBudget || undefined,
  });

  if (!decision.direction) break;

  const shifted = moveBoard(state.board, decision.direction);
  const added = spawn(shifted.board, state.rng);
  state = { board: added.board, score: state.score + shifted.gained, moves: state.moves + 1, rng: added.state };
  if (state.moves % 2000 === 0) {
    console.log(JSON.stringify({ seed, moves: state.moves, score: state.score, maxTile: Math.max(...state.board.flat()), actions }));
  }
  if (state.score >= targetScore) break;
  if (!hasMoves(state.board)) break;
}

const counts = new Map<number, number>();
for (const value of state.board.flat()) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
console.log(JSON.stringify({
  done: true,
  seed,
  score: state.score,
  maxTile: Math.max(...state.board.flat()),
  highTiles: [...counts].filter(([value]) => value >= 1024).sort((a, b) => b[0] - a[0]),
  moves: state.moves,
  actions,
  elapsedMs: Math.round(performance.now() - started),
  board: state.board,
}));
