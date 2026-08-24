import assert from "node:assert/strict";
import test from "node:test";
import { decideArray, resetAiCaches } from "../app/ai/worker.ts";
import { decideBitboard, moveBitboardForTesting, supportsBitboard } from "../app/ai/bitboard.ts";
import { moveBoard, sameBoard } from "../app/game/engine.ts";

const DIRECTIONS = ["up", "right", "down", "left"];

function compareMove(board, direction, label) {
  const official = moveBoard(board, direction);
  const packed = moveBitboardForTesting(board, direction);
  if (sameBoard(board, official.board)) {
    assert.equal(packed, null, label);
    return;
  }
  assert.deepEqual(packed.board, official.board, label);
  assert.equal(packed.gained, official.gained, `${label} score`);
  assert.ok(packed.movableTiles >= 1 && packed.movableTiles <= 16, `${label} movable tiles`);
  assert.ok(packed.disturbance >= packed.movableTiles, `${label} disturbance`);
}

test("packed rows exhaustively match classic left and right movement", () => {
  for (let code = 0; code < 15 ** 4; code += 1) {
    let state = code;
    const powers = Array.from({ length: 4 }, () => {
      const power = state % 15;
      state = Math.floor(state / 15);
      return power;
    });
    const board = [powers.map((power) => power ? 2 ** power : 0), [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    compareMove(board, "left", `left row ${code}`);
    compareMove(board, "right", `right row ${code}`);
  }
});

test("packed columns and rows match the official engine on randomized safe boards", () => {
  let state = 0x2048cafe;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  for (let sample = 0; sample < 1800; sample += 1) {
    const board = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => (
      random() < 0.38 ? 0 : 2 ** (1 + Math.floor(random() * 10))
    )));
    assert.equal(supportsBitboard(board), true);
    for (const direction of DIRECTIONS) compareMove(board, direction, `${direction} sample ${sample}`);
  }
});

test("packed expectimax makes the same fixed-node decisions as the array reference", () => {
  let state = 0x51a7e204;
  const random = () => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return state / 0x100000000;
  };
  const boards = [
    [[2, 4, 8, 16], [32, 64, 128, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    [[1024, 512, 128, 16], [256, 64, 32, 8], [4, 16, 8, 2], [0, 2, 0, 0]],
    ...Array.from({ length: 18 }, () => Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => (
      random() < 0.32 ? 0 : 2 ** (1 + Math.floor(random() * 9))
    )))),
  ];
  boards.forEach((board, index) => {
    resetAiCaches();
    const reference = decideArray({ id: index, board, anchor: 0, budgetMs: 46, nodeBudget: 2048 });
    resetAiCaches();
    const packed = decideBitboard({ id: index, board, anchor: 0, budgetMs: 46, nodeBudget: 2048 });
    assert.deepEqual(
      { direction: packed.direction, strategy: packed.strategy, depth: packed.depth, nodes: packed.nodes },
      { direction: reference.direction, strategy: reference.strategy, depth: reference.depth, nodes: reference.nodes },
      `board ${index}`,
    );
  });
});

test("unsafe high-mass boards stay on the general exact representation", () => {
  const board = [
    [32768, 32768, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  assert.equal(supportsBitboard(board), false);
});
