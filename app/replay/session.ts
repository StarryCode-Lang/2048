import { AI_SPEEDS } from "../ai/timing.ts";
import { copyBoard, isValidBoard, sameBoard, type Board } from "../game/engine.ts";
import { reconstructReplay } from "./reconstruct.ts";
import { packEvents, packTrace, unpackEvents, unpackTrace, type ReplayEvent, type ReplayTrace } from "./log.ts";

export const AI_ALGORITHM = "search-adaptive-v2";
export const GAME_RULES = "official-2048-v1";

export type ActiveGameReplay = {
  algorithm: string;
  rules: string;
  size: number;
  seed: number;
  speedIndex: number;
  initialBoard: Board;
  initialRngState: number;
  initialScore: number;
  initialMoves: number;
  events: ReplayEvent[];
  trace: ReplayTrace[];
};

type ReplaySnapshot = { board: Board; score: number; moves: number; rngState: number };

export function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: unknown) {
  if (typeof value !== "string") return new Uint8Array();
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function createGameReplay(
  size: number,
  seed: number,
  speedIndex: number,
  board: Board,
  rngState: number,
  score = 0,
  moves = 0,
): ActiveGameReplay {
  return {
    algorithm: AI_ALGORITHM,
    rules: GAME_RULES,
    size,
    seed,
    speedIndex,
    initialBoard: copyBoard(board),
    initialRngState: rngState >>> 0,
    initialScore: score,
    initialMoves: moves,
    events: [],
    trace: [],
  };
}

export function serializeGameReplay(replay: ActiveGameReplay | null) {
  if (!replay) return null;
  return {
    algorithm: replay.algorithm,
    rules: replay.rules,
    size: replay.size,
    seed: replay.seed,
    speedIndex: replay.speedIndex,
    initialBoard: replay.initialBoard,
    initialRngState: replay.initialRngState,
    initialScore: replay.initialScore,
    initialMoves: replay.initialMoves,
    eventCount: replay.events.length,
    events: bytesToBase64(packEvents(replay.events)),
    trace: bytesToBase64(packTrace(replay.trace)),
  };
}

export function restoreGameReplay(value: unknown): ActiveGameReplay | null {
  try {
    if (!value || typeof value !== "object") return null;
    const saved = value as Record<string, unknown>;
    const savedSize = Number(saved.size);
    const initialScore = Number(saved.initialScore);
    const initialMoves = Number(saved.initialMoves);
    const seed = Number(saved.seed);
    const initialRngState = Number(saved.initialRngState);
    const speedIndex = Number(saved.speedIndex);
    if (![4, 5, 6].includes(savedSize)
      || !isValidBoard(saved.initialBoard, savedSize)
      || !Number.isSafeInteger(initialScore) || initialScore < 0
      || !Number.isSafeInteger(initialMoves) || initialMoves < 0
      || !Number.isSafeInteger(seed) || seed <= 0 || seed > 0xffffffff
      || !Number.isSafeInteger(initialRngState) || initialRngState <= 0 || initialRngState > 0xffffffff
      || typeof saved.events !== "string"
      || typeof saved.trace !== "string") return null;
    const events = unpackEvents(base64ToBytes(saved.events));
    const trace = unpackTrace(base64ToBytes(saved.trace));
    if (events.length !== Number(saved.eventCount) || trace.length !== events.length) return null;
    return {
      algorithm: typeof saved.algorithm === "string" ? saved.algorithm : AI_ALGORITHM,
      rules: typeof saved.rules === "string" ? saved.rules : GAME_RULES,
      size: savedSize,
      seed: seed >>> 0,
      speedIndex: Number.isInteger(speedIndex) ? Math.min(AI_SPEEDS.length - 1, Math.max(0, speedIndex)) : 0,
      initialBoard: (saved.initialBoard as Board).map((row) => [...row]),
      initialRngState: initialRngState >>> 0,
      initialScore,
      initialMoves,
      events,
      trace,
    };
  } catch {
    return null;
  }
}

export function replayMatchesSnapshot(replay: ActiveGameReplay, snapshot: ReplaySnapshot) {
  try {
    const reconstructed = reconstructReplay({
      board: replay.initialBoard,
      score: replay.initialScore,
      moves: replay.initialMoves,
      rngState: replay.initialRngState,
    }, replay.events);
    return replay.size === snapshot.board.length
      && sameBoard(reconstructed.board, snapshot.board)
      && reconstructed.score === snapshot.score
      && reconstructed.moves === snapshot.moves
      && reconstructed.rngState === (snapshot.rngState >>> 0);
  } catch {
    return false;
  }
}
