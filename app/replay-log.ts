export type DirectionCode = 0 | 1 | 2 | 3;

export type ReplayEvent =
  | { kind: "move"; direction: DirectionCode; source: "ai" | "human"; speedIndex: number }
  | { kind: "undo"; source: "human" };

export type ReplayTrace = {
  depth: number;
  elapsedMs: number;
  nodes: number;
  confidence: number;
  empty: number;
  locked: boolean;
};

export type ReplayCandidate = {
  algorithm: string;
  rules: string;
  size: number;
  seed: number;
  speedIndex: number;
  initialBoard: number[][];
  initialRngState: number;
  initialScore: number;
  initialMoves: number;
  score: number;
  maxTile: number;
  moves: number;
  events: ReplayEvent[];
  trace: ReplayTrace[];
};

export type ChampionReplay = {
  key: string;
  metric: "score" | "tile";
  algorithm: string;
  rules?: string;
  createdAt: number;
  size: number;
  seed: number;
  speedIndex: number;
  score: number;
  maxTile: number;
  moves: number;
  eventCount?: number;
  initialBoard?: number[][];
  initialRngState?: number;
  initialScore?: number;
  initialMoves?: number;
  directionBytes?: Uint8Array;
  eventBytes?: Uint8Array;
  traceBytes: Uint8Array;
};

export type ReplaySummary = {
  score: number;
  maxTile: number;
  bytes: number;
};

const DB_NAME = "2048-ai-replays-v1";
const STORE_NAME = "champions";

export function packDirections(directions: DirectionCode[]) {
  const packed = new Uint8Array(Math.ceil(directions.length / 4));
  directions.forEach((direction, index) => {
    packed[index >> 2] |= direction << ((index & 3) * 2);
  });
  return packed;
}

export function unpackDirections(packed: Uint8Array, count: number) {
  const directions: DirectionCode[] = [];
  for (let index = 0; index < count; index += 1) {
    directions.push(((packed[index >> 2] >> ((index & 3) * 2)) & 3) as DirectionCode);
  }
  return directions;
}

/** One byte per action: direction, input source, undo marker, and AI speed. */
export function packEvents(events: ReplayEvent[]) {
  return Uint8Array.from(events, (event) => {
    if (event.kind === "undo") return 8;
    const source = event.source === "human" ? 4 : 0;
    return event.direction | source | ((Math.min(3, Math.max(0, event.speedIndex)) & 3) << 4);
  });
}

export function unpackEvents(packed: Uint8Array) {
  return Array.from(packed, (value): ReplayEvent => {
    if (value & 8) return { kind: "undo", source: "human" };
    return {
      kind: "move",
      direction: (value & 3) as DirectionCode,
      source: value & 4 ? "human" : "ai",
      speedIndex: (value >> 4) & 3,
    };
  });
}

function logarithmicBucket(value: number) {
  return Math.max(0, Math.min(255, Math.round(Math.log2(Math.max(1, value)) * 16)));
}

/** Five diagnostic bytes per move; boards are reconstructed from seed + 2-bit directions. */
export function packTrace(trace: ReplayTrace[]) {
  const packed = new Uint8Array(trace.length * 5);
  trace.forEach((entry, index) => {
    const offset = index * 5;
    packed[offset] = Math.min(15, entry.depth) | (entry.locked ? 16 : 0);
    packed[offset + 1] = Math.min(255, Math.round(entry.elapsedMs * 2));
    packed[offset + 2] = logarithmicBucket(entry.nodes);
    packed[offset + 3] = logarithmicBucket(entry.confidence);
    packed[offset + 4] = Math.min(63, entry.empty);
  });
  return packed;
}

export function unpackTrace(packed: Uint8Array) {
  const trace: ReplayTrace[] = [];
  for (let offset = 0; offset + 4 < packed.length; offset += 5) {
    trace.push({
      depth: packed[offset] & 15,
      locked: Boolean(packed[offset] & 16),
      elapsedMs: packed[offset + 1] / 2,
      nodes: 2 ** (packed[offset + 2] / 16),
      confidence: 2 ** (packed[offset + 3] / 16),
      empty: packed[offset + 4],
    });
  }
  return trace;
}

function openReplayDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function isBetter(candidate: ChampionReplay, current: ChampionReplay | undefined, metric: "score" | "tile") {
  if (!current) return true;
  if (metric === "score") return candidate.score > current.score
    || (candidate.score === current.score && candidate.maxTile > current.maxTile);
  return candidate.maxTile > current.maxTile
    || (candidate.maxTile === current.maxTile && candidate.score > current.score);
}

export async function saveReplayChampions(candidate: ReplayCandidate) {
  if (typeof indexedDB === "undefined" || !candidate.moves) return false;
  const db = await openReplayDb();
  return new Promise<boolean>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    let changed = false;
    request.onsuccess = () => {
      const existing = request.result as ChampionReplay[];
      const eventBytes = packEvents(candidate.events);
      const traceBytes = packTrace(candidate.trace);
      (["score", "tile"] as const).forEach((metric) => {
        const replay: ChampionReplay = {
          key: `${candidate.size}:${metric}`,
          metric,
          algorithm: candidate.algorithm,
          rules: candidate.rules,
          createdAt: Date.now(),
          size: candidate.size,
          seed: candidate.seed >>> 0,
          speedIndex: candidate.speedIndex,
          score: candidate.score,
          maxTile: candidate.maxTile,
          moves: candidate.moves,
          eventCount: candidate.events.length,
          initialBoard: candidate.initialBoard,
          initialRngState: candidate.initialRngState >>> 0,
          initialScore: candidate.initialScore,
          initialMoves: candidate.initialMoves,
          eventBytes,
          traceBytes,
        };
        const current = existing.find((item) => item.key === replay.key);
        if (isBetter(replay, current, metric)) {
          store.put(replay);
          changed = true;
        }
      });
    };
    transaction.oncomplete = () => { db.close(); resolve(changed); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
    transaction.onabort = () => { db.close(); reject(transaction.error); };
  });
}

export async function getReplaySummary(size: number): Promise<ReplaySummary | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openReplayDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      const records = (request.result as ChampionReplay[]).filter((item) => item.size === size);
      db.close();
      if (!records.length) { resolve(null); return; }
      resolve({
        score: Math.max(...records.map((item) => item.score)),
        maxTile: Math.max(...records.map((item) => item.maxTile)),
        bytes: records.reduce((total, item) => total + (item.eventBytes?.byteLength ?? item.directionBytes?.byteLength ?? 0) + item.traceBytes.byteLength, 0),
      });
    };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export async function getPreferredReplay(size: number): Promise<ChampionReplay | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openReplayDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(`${size}:score`);
    request.onsuccess = () => { db.close(); resolve((request.result as ChampionReplay | undefined) ?? null); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}
