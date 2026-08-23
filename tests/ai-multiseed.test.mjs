import assert from "node:assert/strict";
import test from "node:test";
import { simulateAiGame } from "../app/ai/simulate.ts";

const releaseSeeds = [131556, 2048, 0x2048cafe, 0x5eed1234, 0xf00dcafe, 0x89abcdef, 65537, 0xabcdef01];

test("fixed-budget AI quality is stable across a deterministic multi-seed release set", () => {
  const results = releaseSeeds.map((seed) => simulateAiGame({ seed, maxMoves: 600, nodeBudget: 1024 }));
  const averageScore = results.reduce((sum, result) => sum + result.score, 0) / results.length;
  const reached512 = results.filter((result) => result.maxTile >= 512).length;

  assert.ok(results.every((result) => result.moves === 600), JSON.stringify(results));
  assert.ok(Math.min(...results.map((result) => result.score)) >= 8000, JSON.stringify(results));
  assert.ok(averageScore >= 9400, `average score ${averageScore}; ${JSON.stringify(results)}`);
  assert.equal(reached512, results.length, `${reached512}/${results.length} runs reached 512; ${JSON.stringify(results)}`);
});

test("the multi-seed harness is exactly repeatable", () => {
  const options = { seed: 0x2048cafe, maxMoves: 120, nodeBudget: 1024 };
  assert.deepEqual(simulateAiGame(options), simulateAiGame(options));
});
