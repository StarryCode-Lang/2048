import { emptyBoard, type Board } from "./engine";
import { spawnRandomTile } from "./random";
import type { Language } from "../i18n/messages";

export function preferredLanguage(values: readonly string[], isLanguage: (value: unknown) => value is Language): Language {
  for (const value of values) {
    const language = value.toLowerCase().split("-")[0];
    if (isLanguage(language)) return language;
  }
  return "zh";
}

export function storedInteger(value: string | null, fallback: number, maximum: number) {
  if (value === null) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= maximum ? parsed : fallback;
}

export function safeScore(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export function storedRecord(key: string): Record<string, unknown> {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export function freshBoardOfSize(size: number, random: () => number = Math.random): Board {
  return spawnRandomTile(spawnRandomTile(emptyBoard(size), random).board, random).board;
}

export function createGameSeed() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) return crypto.getRandomValues(new Uint32Array(1))[0] || 1;
  return ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) || 1;
}
