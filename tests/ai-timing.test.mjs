import test from "node:test";
import assert from "node:assert/strict";
import { aiBudgetFor, isEndgameSearch, legalMoveCount } from "../app/ai/timing.ts";

test("keeps early play fast and reallocates time to a crowded 4096+ endgame", () => {
  const early = [[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 2]];
  const endgame = [[8192, 2048, 64, 2], [4096, 1024, 512, 4], [128, 32, 16, 0], [8, 4, 0, 0]];
  const critical = [[16384, 8192, 64, 2], [4096, 1024, 512, 4], [128, 32, 16, 8], [8, 4, 2, 0]];
  assert.equal(isEndgameSearch(early), false);
  assert.equal(aiBudgetFor(early, 0), 30);
  assert.ok(legalMoveCount(early) >= 3);
  assert.equal(isEndgameSearch(endgame), true);
  assert.deepEqual([0, 1, 2].map((speed) => aiBudgetFor(endgame, speed)), [82, 120, 180]);
  assert.deepEqual([0, 1, 2].map((speed) => aiBudgetFor(critical, speed)), [120, 180, 240]);
});
