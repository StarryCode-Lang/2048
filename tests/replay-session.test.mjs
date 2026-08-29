import assert from "node:assert/strict";
import test from "node:test";
import { reconstructReplay } from "../app/replay/reconstruct.ts";
import {
  createGameReplay,
  replayMatchesSnapshot,
  restoreGameReplay,
  serializeGameReplay,
} from "../app/replay/session.ts";

test("active replay sessions round-trip and bind to the exact saved snapshot", () => {
  const initialBoard = [
    [2, 2, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const replay = createGameReplay(4, 1, 1, initialBoard, 1);
  replay.events.push({ kind: "move", direction: 3, source: "human", speedIndex: 0 });
  replay.trace.push({ depth: 0, elapsedMs: 0, nodes: 0, confidence: 0, empty: 14, locked: false });
  const final = reconstructReplay({ board: initialBoard, score: 0, moves: 0, rngState: 1 }, replay.events);
  const restored = restoreGameReplay(serializeGameReplay(replay));

  assert.ok(restored);
  assert.deepEqual(restored.events, replay.events);
  assert.ok(replayMatchesSnapshot(restored, final));
  assert.equal(replayMatchesSnapshot(restored, { ...final, score: final.score + 4 }), false);
});

test("active replay restoration rejects mismatched event and trace lengths", () => {
  const replay = createGameReplay(4, 7, 1, [
    [2, 2, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], 7);
  const serialized = serializeGameReplay(replay);
  assert.ok(serialized);
  assert.equal(restoreGameReplay({ ...serialized, eventCount: 1 }), null);
});
