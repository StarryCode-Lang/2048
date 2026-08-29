import assert from "node:assert/strict";
import test from "node:test";
import { simulateAiGame } from "../app/ai/simulate.ts";

const seeds = [131556, 2048, 0x2048cafe, 0x5eed1234, 17, 4096, 8675309, 0xf00dcafe];

test("adaptive AI reaches the 512 early-game gate on every release seed", () => {
  const results = seeds.map((seed) => simulateAiGame({ seed, maxMoves: 300, nodeBudget: 1024, engine: "adaptive" }));
  assert.ok(results.every((result) => result.moves === 300), JSON.stringify(results));
  assert.ok(results.every((result) => result.maxTile >= 512), JSON.stringify(results));
  const average = results.reduce((sum, result) => sum + result.score, 0) / results.length;
  assert.ok(average >= 4500, `average score ${average}; ${JSON.stringify(results)}`);
});

test("adaptive AI hands congested boards to search and survives the 600-move gate", () => {
  const results = seeds.map((seed) => simulateAiGame({ seed, maxMoves: 600, nodeBudget: 1024, engine: "adaptive" }));
  assert.ok(results.every((result) => result.moves === 600), JSON.stringify(results));
  assert.ok(results.every((result) => result.maxTile >= 1024), JSON.stringify(results));
  assert.ok(Math.min(...results.map((result) => result.score)) >= 10000, JSON.stringify(results));
});
