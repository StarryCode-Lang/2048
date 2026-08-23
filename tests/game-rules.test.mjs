import test from "node:test";
import assert from "node:assert/strict";
import { hasMoves, moveBoard, sameBoard } from "../app/game-engine.ts";

test("official merge order allows each resulting tile to merge only once", () => {
  const fourTwos = moveBoard([[2, 2, 2, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], "left");
  assert.deepEqual(fourTwos.board[0], [4, 4, 0, 0]);
  assert.equal(fourTwos.gained, 8);

  const blockedChain = moveBoard([[2, 2, 4, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], "left");
  assert.deepEqual(blockedChain.board[0], [4, 4, 0, 0]);
  assert.equal(blockedChain.gained, 4);
});

test("score is exactly the sum of newly merged tiles", () => {
  const result = moveBoard([[2, 2, 4, 4], [8, 0, 8, 0], [0, 0, 0, 0], [0, 0, 0, 0]], "left");
  assert.deepEqual(result.board.slice(0, 2), [[4, 8, 0, 0], [16, 0, 0, 0]]);
  assert.equal(result.gained, 28);
});

test("invalid moves change nothing and game over requires no empty cell or adjacent equal pair", () => {
  const immovable = [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]];
  assert.equal(hasMoves(immovable), false);
  assert.equal(sameBoard(immovable, moveBoard(immovable, "left").board), true);
  assert.equal(hasMoves([[2, 2, 4, 8], [16, 32, 64, 128], [256, 512, 1024, 2048], [4, 8, 16, 32]]), true);
});
