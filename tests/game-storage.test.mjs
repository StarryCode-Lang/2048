import test from "node:test";
import assert from "node:assert/strict";
import { parseStoredGame, serializeStoredGame } from "../app/game/storage.ts";

const board = [
  [2, 0, 0, 0],
  [0, 4, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
];

test("versioned save envelopes round-trip and migrate v2 records", () => {
  const encoded = JSON.stringify(serializeStoredGame({
    size: 4,
    board,
    score: 12,
    moves: 3,
    continued: false,
    rngSeed: 7,
    rngState: 9,
    replay: null,
  }));
  const restored = parseStoredGame(encoded);
  assert.equal(restored?.version, 3);
  assert.deepEqual(restored?.board, board);
  assert.equal(restored?.rngState, 9);
  const legacy = parseStoredGame(encoded.replace('"version":3', '"version":2'));
  assert.equal(legacy?.version, 3);
});

test("malformed saves fail closed", () => {
  assert.equal(parseStoredGame("not json"), null);
  assert.equal(parseStoredGame(JSON.stringify({ version: 3, size: 4, board, score: -1, moves: 0, rngSeed: 1, rngState: 1 })), null);
  assert.equal(parseStoredGame(JSON.stringify({ version: 3, size: 4, board: [[2]], score: 0, moves: 0, rngSeed: 1, rngState: 1 })), null);
  assert.equal(parseStoredGame(JSON.stringify({ version: 99, size: 4, board, score: 0, moves: 0, rngSeed: 1, rngState: 1 })), null);
});
