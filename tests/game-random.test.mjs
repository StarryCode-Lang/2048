import test from "node:test";
import assert from "node:assert/strict";
import { spawnRandomTile } from "../app/game/random.ts";

const emptyBoard = (size) => Array.from({ length: size }, () => Array(size).fill(0));

test("classic 2048 spawn boundaries and full-board behavior", () => {
  const firstTwo = [0.899999, 0];
  const lastFour = [0.9, 0.999999];
  const first = spawnRandomTile(emptyBoard(4), () => firstTwo.shift());
  const last = spawnRandomTile(emptyBoard(4), () => lastFour.shift());
  assert.deepEqual(first.point, { row: 0, col: 0 });
  assert.equal(first.value, 2);
  assert.deepEqual(last.point, { row: 3, col: 3 });
  assert.equal(last.value, 4);

  const full = Array.from({ length: 4 }, () => Array(4).fill(2));
  const result = spawnRandomTile(full, () => 0);
  assert.equal(result.board, full);
  assert.equal(result.point, null);
  assert.equal(result.value, 0);
});

test("100k seeded spawns keep the 90/10 value split and uniform empty-cell placement", () => {
  let state = 0x2048cafe;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const cells = new Array(16).fill(0);
  let twos = 0;
  const samples = 100000;
  for (let index = 0; index < samples; index += 1) {
    const result = spawnRandomTile(emptyBoard(4), random);
    cells[result.point.row * 4 + result.point.col] += 1;
    if (result.value === 2) twos += 1;
  }
  assert.ok(Math.abs(twos / samples - 0.9) < 0.005);
  const expected = samples / cells.length;
  const chiSquared = cells.reduce((sum, observed) => sum + (observed - expected) ** 2 / expected, 0);
  assert.ok(chiSquared < 45, `cell distribution chi-squared was ${chiSquared}`);
});
