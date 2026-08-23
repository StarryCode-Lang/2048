import test from "node:test";
import assert from "node:assert/strict";
import { decide } from "../app/ai/worker.ts";

const finalChampionBoard = [
  [8192, 2048, 64, 2],
  [1024, 512, 128, 16],
  [2, 64, 32, 4],
  [2, 4, 16, 4],
];

test("keeps an established largest tile in the top-left corner", () => {
  for (const budgetMs of [110, 160, 240]) {
    const decision = decide({ id: budgetMs, board: finalChampionBoard, anchor: 0, budgetMs });
    assert.equal(decision.direction, "up", `budget ${budgetMs}ms must reject the tempting down move`);
    assert.equal(decision.anchor, 0);
    assert.equal(decision.strategy, "lock");
  }
});

test("makes the same decision from identical information without reading future random tiles", () => {
  const first = decide({ id: 1, board: finalChampionBoard, anchor: 0, budgetMs: 46, nodeBudget: 8000 });
  const repeated = decide({ id: 2, board: finalChampionBoard, anchor: 0, budgetMs: 46, nodeBudget: 8000 });
  assert.equal(repeated.direction, first.direction);
});
