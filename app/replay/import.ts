import { isValidBoard, type Board } from "../game/engine.ts";
import { reconstructReplay } from "./reconstruct.ts";
import { unpackDirections, unpackEvents, unpackTrace, type ReplayEvent, type ReplayTrace } from "./log.ts";

export type ImportedReplay = {
  format: string;
  algorithm: string;
  rules: string;
  size: 4 | 5 | 6;
  seed: number;
  speedIndex: number;
  initialBoard: Board;
  initialRngState: number;
  initialScore: number;
  initialMoves: number;
  score: number;
  maxTile: number;
  moves: number;
  events: ReplayEvent[];
  trace: ReplayTrace[];
  finalBoard: Board;
  finalRngState: number;
};

function decode(value: unknown) {
  if (typeof value !== "string") throw new Error("Replay payload is not base64");
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function safeUint32(value: unknown) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 0xffffffff) throw new Error("Replay seed is invalid");
  return parsed >>> 0;
}

function safeCounter(value: unknown, label: string) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${label} is invalid`);
  return parsed;
}

/** Parse v1-v4 exported logs and verify every action before exposing them to playback. */
export function parseReplayPayload(raw: string): ImportedReplay {
  const payload = JSON.parse(raw) as Record<string, unknown>;
  const size = Number(payload.size);
  if (![4, 5, 6].includes(size) || !isValidBoard(payload.initialBoard, size)) throw new Error("Replay board is invalid");
  const initialBoard = payload.initialBoard as Board;
  const initialRngState = safeUint32(payload.initialRngState);
  const initialScore = safeCounter(payload.initialScore, "Replay score");
  const initialMoves = safeCounter(payload.initialMoves, "Replay moves");
  const seed = safeUint32(payload.seed);
  const eventCount = safeCounter(payload.actions ?? payload.eventCount ?? payload.moves ?? 0, "Replay action count");
  const format = typeof payload.format === "string" ? payload.format : "2048-full-replay-v3";
  const events: ReplayEvent[] = typeof payload.events === "string"
    ? unpackEvents(decode(payload.events))
    : unpackDirections(decode(payload.directions), eventCount).map((direction): ReplayEvent => ({ kind: "move", direction, source: "ai", speedIndex: Number(payload.speedIndex) || 0 }));
  if (events.length !== eventCount) throw new Error("Replay action count does not match payload");
  const trace = typeof payload.trace === "string" ? unpackTrace(decode(payload.trace)) : [];
  if (trace.length && trace.length !== events.length) throw new Error("Replay trace length does not match payload");
  const final = reconstructReplay({ board: initialBoard, score: initialScore, moves: initialMoves, rngState: initialRngState }, events);
  const score = safeCounter(payload.score ?? final.score, "Replay score");
  const moves = safeCounter(payload.moves ?? final.moves, "Replay moves");
  const maxTile = safeCounter(payload.maxTile ?? Math.max(...final.board.flat()), "Replay max tile");
  if (score !== final.score || moves !== final.moves || maxTile !== Math.max(...final.board.flat())) throw new Error("Replay summary does not match reconstructed state");
  return {
    format,
    algorithm: typeof payload.algorithm === "string" ? payload.algorithm : "unknown",
    rules: typeof payload.rules === "string" ? payload.rules : "classic-2048-distribution-v1",
    size: size as 4 | 5 | 6,
    seed,
    speedIndex: Number.isInteger(Number(payload.speedIndex)) ? Math.max(0, Math.min(2, Number(payload.speedIndex))) : 0,
    initialBoard: initialBoard.map((row) => [...row]),
    initialRngState,
    initialScore,
    initialMoves,
    score,
    maxTile,
    moves,
    events,
    trace,
    finalBoard: final.board,
    finalRngState: final.rngState,
  };
}
