import { isValidBoard, type Board } from "./engine.ts";

/** Versioned local save envelope. Version 2 is accepted for backwards compatibility. */
export const SAVE_SCHEMA_VERSION = 3;
export const VALID_SAVE_SIZES = [4, 5, 6] as const;
export type SaveSize = typeof VALID_SAVE_SIZES[number];

export type StoredGameRecord = {
  version: number;
  size: SaveSize;
  board: Board;
  score: number;
  moves: number;
  continued: boolean;
  rngSeed: number;
  rngState: number;
  replay: unknown;
};

function safeUint32(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 0xffffffff ? parsed >>> 0 : null;
}

function safeCounter(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

/** Parse and validate a local save without allowing malformed data into game state. */
export function parseStoredGame(raw: string | null): StoredGameRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const version = parsed.version === undefined ? 2 : Number(parsed.version);
    const size = Number(parsed.size);
    const score = safeCounter(parsed.score);
    const moves = safeCounter(parsed.moves);
    const rngSeed = safeUint32(parsed.rngSeed);
    const rngState = safeUint32(parsed.rngState) ?? rngSeed;
    if (![2, SAVE_SCHEMA_VERSION].includes(version)
      || !VALID_SAVE_SIZES.includes(size as SaveSize)
      || !isValidBoard(parsed.board, size)
      || score === null || moves === null || rngSeed === null || rngState === null) return null;
    return {
      version: SAVE_SCHEMA_VERSION,
      size: size as SaveSize,
      board: parsed.board as Board,
      score,
      moves,
      continued: Boolean(parsed.continued),
      rngSeed,
      rngState,
      replay: parsed.replay ?? null,
    };
  } catch {
    return null;
  }
}

export function serializeStoredGame(record: Omit<StoredGameRecord, "version">) {
  return {
    version: SAVE_SCHEMA_VERSION,
    size: record.size,
    board: record.board,
    score: record.score,
    moves: record.moves,
    continued: record.continued,
    rngSeed: record.rngSeed >>> 0,
    rngState: record.rngState >>> 0,
    replay: record.replay,
  };
}
