import { decide } from "../app/ai/worker.ts";
import { aiBudgetFor } from "../app/ai/timing.ts";
import { readFileSync } from "node:fs";

type Direction = "up" | "down" | "left" | "right";
type State = { board: number[][]; score: number; moves: number; rng: number };

const DIRECTIONS: Direction[] = ["down", "left", "right", "up"];

function nextRandom(state: number) {
  const next = (state + 0x6d2b79f5) >>> 0;
  let value = next;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return { state: next, value: ((value ^ (value >>> 14)) >>> 0) / 4294967296 };
}

function spawn(board: number[][], state: number) {
  const empty: Array<[number, number]> = [];
  board.forEach((row, r) => row.forEach((value, c) => { if (!value) empty.push([r, c]); }));
  if (!empty.length) return { board, state };
  const value = nextRandom(state);
  const position = nextRandom(value.state);
  const [row, col] = empty[Math.floor(position.value * empty.length)];
  const next = board.map((line) => [...line]);
  next[row][col] = value.value < .9 ? 2 : 4;
  return { board: next, state: position.state };
}

function point(direction: Direction, line: number, offset: number, size: number) {
  if (direction === "left") return [line, offset];
  if (direction === "right") return [line, size - 1 - offset];
  if (direction === "up") return [offset, line];
  return [size - 1 - offset, line];
}

function move(board: number[][], direction: Direction) {
  const size = board.length;
  const next = Array.from({ length: size }, () => Array(size).fill(0));
  let gained = 0;
  for (let line = 0; line < size; line += 1) {
    const slots: Array<{ value: number; merged: boolean }> = [];
    for (let offset = 0; offset < size; offset += 1) {
      const [row, col] = point(direction, line, offset, size);
      const value = board[row][col];
      if (!value) continue;
      const last = slots.length - 1;
      if (last >= 0 && slots[last].value === value && !slots[last].merged) {
        slots[last] = { value: value * 2, merged: true };
        gained += value * 2;
      } else slots.push({ value, merged: false });
    }
    slots.forEach((slot, offset) => {
      const [row, col] = point(direction, line, offset, size);
      next[row][col] = slot.value;
    });
  }
  return { board: next, gained };
}

function same(a: number[][], b: number[][]) {
  return a.every((row, r) => row.every((value, c) => value === b[r][c]));
}

function hasMoves(board: number[][]) {
  return DIRECTIONS.some((direction) => !same(board, move(board, direction).board));
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
  state = { board: Array.from({ length: 4 }, () => Array(4).fill(0)), score: 0, moves: 0, rng: seed };
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

  const shifted = move(state.board, decision.direction);
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
