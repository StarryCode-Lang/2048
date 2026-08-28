import test from "node:test";
import assert from "node:assert/strict";
import { emptyBoard, moveBoard } from "../app/game/engine.ts";
import { nextSeededRandom, spawnRandomTile } from "../app/game/random.ts";
import { packEvents, packTrace } from "../app/replay/log.ts";
import { parseReplayPayload } from "../app/replay/import.ts";

function base64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

test("full replay imports only after exact event reconstruction", () => {
  let rngState = 123;
  const initial = emptyBoard(4);
  initial[0][0] = 2;
  initial[1][1] = 2;
  const shifted = moveBoard(initial, "left");
  const spawned = spawnRandomTile(shifted.board, () => {
    const value = nextSeededRandom(rngState);
    rngState = value.state;
    return value.value;
  });
  const events = [{ kind: "move", direction: 3, source: "human", speedIndex: 1 }];
  const trace = [{ depth: 1, elapsedMs: 3, nodes: 120, confidence: 2, empty: 13, locked: false }];
  const parsed = parseReplayPayload(JSON.stringify({
    format: "2048-full-replay-v3",
    rules: "official-2048-v1",
    algorithm: "test",
    size: 4,
    seed: 123,
    speedIndex: 1,
    initialBoard: initial,
    initialRngState: 123,
    initialScore: 0,
    initialMoves: 0,
    score: shifted.gained,
    maxTile: Math.max(...spawned.board.flat()),
    moves: 1,
    actions: 1,
    events: base64(packEvents(events)),
    trace: base64(packTrace(trace)),
  }));
  assert.equal(parsed.events.length, 1);
  assert.equal(parsed.finalBoard.length, 4);
  assert.equal(parsed.moves, 1);
});

test("impossible replay actions are rejected", () => {
  const board = emptyBoard(4);
  assert.throws(() => parseReplayPayload(JSON.stringify({
    format: "2048-full-replay-v3", size: 4, seed: 1, initialBoard: board,
    initialRngState: 1, initialScore: 0, initialMoves: 0, actions: 1,
    events: base64(packEvents([{ kind: "move", direction: 0, source: "ai", speedIndex: 0 }])),
    trace: base64(packTrace([{ depth: 1, elapsedMs: 1, nodes: 1, confidence: 1, empty: 16, locked: false }])),
  })));
});
