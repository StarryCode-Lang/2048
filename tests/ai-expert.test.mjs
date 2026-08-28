import test from "node:test";
import assert from "node:assert/strict";
import { decideExpert } from "../app/ai/expert.ts";

test("expert afterstate engine is deterministic and returns a legal direction", () => {
  const board = [
    [128, 64, 32, 16],
    [2, 4, 8, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const first = decideExpert(board, 0, 80, 1);
  const second = decideExpert(board, 0, 80, 1);
  assert.equal(first.direction, second.direction);
  assert.equal(first.nodes, second.nodes);
  assert.equal(first.depth, second.depth);
  assert.ok(first.direction);
  assert.ok(["left", "up", "right", "down"].includes(first.direction));
  assert.equal(first.depth, 2);
});

test("expert engine works on larger boards without reading RNG state", () => {
  const board = Array.from({ length: 5 }, (_, row) => Array.from({ length: 5 }, (_, col) => (row + col) % 3 === 0 ? 2 ** ((row + col) % 5 + 1) : 0));
  const decision = decideExpert(board, 0, 60, 7);
  assert.ok(decision.direction);
  assert.equal(decision.id, 7);
  assert.ok(decision.nodes > 0);
  assert.ok(decision.elapsedMs >= 0);
});
