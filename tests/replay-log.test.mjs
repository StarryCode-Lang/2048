import test from "node:test";
import assert from "node:assert/strict";
import { packDirections, packEvents, packTrace, unpackDirections, unpackEvents, unpackTrace } from "../app/replay/log.ts";

test("four AI directions are packed into one byte and round-trip exactly", () => {
  const directions = Array.from({ length: 2003 }, (_, index) => index % 4);
  const packed = packDirections(directions);
  assert.equal(packed.byteLength, Math.ceil(directions.length / 4));
  assert.deepEqual(unpackDirections(packed, directions.length), directions);
});

test("diagnostic trace stays at five bytes per move", () => {
  const trace = Array.from({ length: 2000 }, (_, index) => ({
    depth: index % 12,
    elapsedMs: 34.5,
    nodes: 30000 + index,
    confidence: index * 20,
    empty: index % 17,
    locked: index % 2 === 0,
  }));
  assert.equal(packTrace(trace).byteLength, 10000);
  assert.equal(packDirections(Array(2000).fill(0)).byteLength, 500);
});

test("full-session event stream preserves AI, human, speed, and undo actions", () => {
  const events = [
    { kind: "move", direction: 0, source: "ai", speedIndex: 0 },
    { kind: "move", direction: 3, source: "human", speedIndex: 0 },
    { kind: "undo", source: "human" },
    { kind: "move", direction: 2, source: "ai", speedIndex: 2 },
  ];
  const packed = packEvents(events);
  assert.equal(packed.byteLength, events.length);
  assert.deepEqual(unpackEvents(packed), events);
});

test("packed diagnostic trace can be restored and packed without size drift", () => {
  const trace = [
    { depth: 7, elapsedMs: 31.5, nodes: 45678, confidence: 128, empty: 2, locked: true },
    { depth: 0, elapsedMs: 0, nodes: 0, confidence: 0, empty: 3, locked: false },
  ];
  const packed = packTrace(trace);
  assert.equal(packTrace(unpackTrace(packed)).byteLength, packed.byteLength);
});
