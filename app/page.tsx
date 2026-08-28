"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import { audioContextClass, beginAmbientLoop, playMergeTone, stopMusicEngine, type MusicEngine } from "./audio/ambient";
import { GlassMenu } from "./components/glass-menu";
import { nextSeededRandom, spawnRandomTile } from "./game/random";
import { copyBoard, countEmpty, emptyBoard, hasMoves, isValidBoard, moveBoard, sameBoard, type Board, type CellPoint, type Direction, type TileMotion } from "./game/engine";
import { parseStoredGame, serializeStoredGame } from "./game/storage";
import { AI_SPEEDS, aiBudgetFor, isEndgameSearch } from "./ai/timing";
import { LANGUAGES, TRANSLATIONS, isLanguage, type Language } from "./i18n/messages";
import { useModalFocus } from "./hooks/use-modal-focus";
import { reconstructReplay } from "./replay/reconstruct";
import { parseReplayPayload } from "./replay/import";
import {
  getPreferredReplay,
  getReplaySummary,
  packEvents,
  packTrace,
  saveReplayChampions,
  unpackEvents,
  unpackTrace,
  type DirectionCode,
  type ReplayCandidate,
  type ReplayEvent,
  type ReplaySummary,
  type ReplayTrace,
} from "./replay/log";

type Snapshot = { board: Board; score: number; moves: number; rngState: number };
type AiCorner = 0 | 1 | 2 | 3;

const DEFAULT_SIZE = 4;
const AI_ALGORITHM = "expectimax-v20-packed-bitboard";
const GAME_RULES = "official-2048-v1";
const VALID_SIZES = [4, 5, 6] as const;
const SAVE_KEY = "2048-save-v2";
const BESTS_KEY = "2048-bests-v1";
const DIRECTION_ARROWS: Record<Direction, string> = { up: "↑", down: "↓", left: "←", right: "→" };

function preferredLanguage(values: readonly string[]): Language {
  for (const value of values) {
    const language = value.toLowerCase().split("-")[0];
    if (isLanguage(language)) return language;
  }
  return "zh";
}

function storedInteger(value: string | null, fallback: number, maximum: number) {
  if (value === null) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= maximum ? parsed : fallback;
}

function safeScore(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function storedRecord(key: string): Record<string, unknown> {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function freshBoardOfSize(size: number, random: () => number = Math.random): Board {
  return spawnRandomTile(spawnRandomTile(emptyBoard(size), random).board, random).board;
}

function createGameSeed() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) return crypto.getRandomValues(new Uint32Array(1))[0] || 1;
  return ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) || 1;
}

const DIRECTIONS: Direction[] = ["down", "left", "right", "up"];

function snakePositions(size: number, corner: AiCorner): CellPoint[] {
  const top = corner < 2;
  const left = corner % 2 === 0;
  const positions: CellPoint[] = [];
  for (let rowStep = 0; rowStep < size; rowStep += 1) {
    const row = top ? rowStep : size - 1 - rowStep;
    const startsFromLeft = rowStep % 2 === 0 ? left : !left;
    for (let colStep = 0; colStep < size; colStep += 1) {
      positions.push({ row, col: startsFromLeft ? colStep : size - 1 - colStep });
    }
  }
  return positions;
}

function chooseFallbackMove(board: Board, anchor: AiCorner): Direction | null {
  const legal = DIRECTIONS.flatMap((direction, order) => {
    const moved = moveBoard(board, direction, 0);
    return sameBoard(board, moved.board) ? [] : [{ direction, order, moved }];
  });
  const anchorPoint = snakePositions(board.length, anchor)[0];
  const maxValue = Math.max(...board.flat());
  const anchored = maxValue >= 128 && board[anchorPoint.row][anchorPoint.col] === maxValue;
  const preserving = anchored
    ? legal.filter(({ moved }) => moved.board[anchorPoint.row][anchorPoint.col] >= maxValue)
    : [];
  const candidates = preserving.length ? preserving : legal;
  let bestDirection: Direction | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  candidates.forEach(({ direction, order, moved }) => {
    const routeScore = snakePositions(board.length, anchor).reduce((total, point, index) => {
      const power = moved.board[point.row][point.col] ? Math.log2(moved.board[point.row][point.col]) : 0;
      return total + power * power * Math.pow(.78, index) * 100;
    }, 0);
    const score = routeScore + countEmpty(moved.board) * 500 + moved.gained * 8 - order * .001;
    if (score > bestScore) { bestScore = score; bestDirection = direction; }
  });
  return bestDirection;
}

type AiDecision = { direction: Direction | null; anchor: AiCorner; strategy: "lock" | "recover"; depth: number; nodes: number; elapsedMs: number; movableTiles: number; confidence: number };
type AiEngine = "search" | "expert";
type AiPending = { id: number; resolve: (decision: AiDecision | null) => void };
type AiPrefetch = { key: string; promise: Promise<AiDecision | null> };
type ActiveGameReplay = {
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

const DIRECTION_CODES: Record<Direction, DirectionCode> = { up: 0, right: 1, down: 2, left: 3 };

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: unknown) {
  if (typeof value !== "string") return new Uint8Array();
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function createGameReplay(size: number, seed: number, speedIndex: number, board: Board, rngState: number, score = 0, moves = 0): ActiveGameReplay {
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

function serializeGameReplay(replay: ActiveGameReplay | null) {
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

function restoreGameReplay(value: unknown): ActiveGameReplay | null {
  try {
    if (!value || typeof value !== "object") return null;
    const saved = value as Record<string, unknown>;
    const savedSize = Number(saved.size);
    const initialScore = Number(saved.initialScore);
    const initialMoves = Number(saved.initialMoves);
    const seed = Number(saved.seed);
    const initialRngState = Number(saved.initialRngState);
    const speedIndex = Number(saved.speedIndex);
    if (!VALID_SIZES.includes(savedSize as 4 | 5 | 6)
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
      algorithm: typeof saved.algorithm === "string" ? saved.algorithm : "expectimax-v17-score-first-escape",
      rules: typeof saved.rules === "string" ? saved.rules : "classic-2048-distribution-v1",
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

function replayMatchesSnapshot(replay: ActiveGameReplay, snapshot: Snapshot) {
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

function tileClass(value: number) {
  return `${value > 2048 ? "tile-super" : `tile-${value}`} tile-digits-${String(value).length}`;
}

export default function Home() {
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [board, setBoard] = useState<Board>(() => emptyBoard(DEFAULT_SIZE));
  const [score, setScore] = useState(0);
  const [bests, setBests] = useState<Record<number, number>>({ 4: 0, 5: 0, 6: 0 });
  const [moves, setMoves] = useState(0);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [scoreBurst, setScoreBurst] = useState(0);
  const [winOpen, setWinOpen] = useState(false);
  const [continued, setContinued] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [pendingSize, setPendingSize] = useState<number | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  // Keep first visit silent. Existing explicit preferences are restored during hydration.
  const [soundOn, setSoundOn] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [needsAudioTap, setNeedsAudioTap] = useState(false);
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);
  const [motions, setMotions] = useState<TileMotion[]>([]);
  const [motionRunning, setMotionRunning] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [highlighted, setHighlighted] = useState<CellPoint[]>([]);
  const [motionMetrics, setMotionMetrics] = useState({ tile: 0, step: 0 });
  const [motionDuration, setMotionDuration] = useState(178);
  const [arrivalDuration, setArrivalDuration] = useState(150);
  const [aiRunning, setAiRunning] = useState(false);
  const [aiSpeedIndex, setAiSpeedIndex] = useState(1);
  const [aiEngine, setAiEngine] = useState<AiEngine>("search");
  const [aiThought, setAiThought] = useState("等待开始");
  const [aiCorner, setAiCorner] = useState<AiCorner>(0);
  const [aiMoveCount, setAiMoveCount] = useState(0);
  const [aiTrail, setAiTrail] = useState<Direction[]>([]);
  const [aiDepth, setAiDepth] = useState(2);
  const [aiStrategy, setAiStrategy] = useState<"lock" | "recover">("recover");
  const [aiStats, setAiStats] = useState({ nodes: 0, elapsedMs: 0, movableTiles: 0 });
  const [replaySummary, setReplaySummary] = useState<ReplaySummary | null>(null);
  const [language, setLanguage] = useState<Language>("zh");
  const [openMenu, setOpenMenu] = useState<"language" | "speed" | "engine" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const ui = TRANSLATIONS[language];
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const boardElementRef = useRef<HTMLDivElement | null>(null);
  const replayInputRef = useRef<HTMLInputElement | null>(null);
  const gestureLayerRef = useRef<HTMLDivElement | null>(null);
  const boardRef = useRef(board);
  const sizeRef = useRef(size);
  const scoreRef = useRef(score);
  const movesRef = useRef(moves);
  const animatingRef = useRef(false);
  const queuedDirection = useRef<Direction | null>(null);
  const moveTimer = useRef<number | null>(null);
  const musicRef = useRef<MusicEngine | null>(null);
  const aiRunningRef = useRef(false);
  const aiCornerRef = useRef<AiCorner>(0);
  const aiWorkerRef = useRef<Worker | null>(null);
  const aiRequestIdRef = useRef(0);
  const aiPendingRef = useRef<AiPending | null>(null);
  const aiPrefetchRef = useRef<AiPrefetch | null>(null);
  const lastAiMoveStartRef = useRef(0);
  const rngSeedRef = useRef(1);
  const rngStateRef = useRef(1);
  const activeGameReplayRef = useRef<ActiveGameReplay | null>(null);
  const lastAiDecisionRef = useRef<AiDecision | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const championSaveTimerRef = useRef<number | null>(null);
  const pendingReplayCandidateRef = useRef<ReplayCandidate | null>(null);
  const gameOver = ready && !hasMoves(board);

  useModalFocus(confirmNew || helpOpen || winOpen || gameOver);

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    const closeOnOutsidePress = (event: MouseEvent) => {
      if (!(event.target as Element | null)?.closest("[data-menu-root]")) setOpenMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("click", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("click", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openMenu]);

  const gameRandom = useCallback(() => {
    const generated = nextSeededRandom(rngStateRef.current);
    rngStateRef.current = generated.state;
    return generated.value;
  }, []);

  const applyState = useCallback((nextBoard: Board, nextScore: number, nextMoves: number) => {
    boardRef.current = nextBoard;
    scoreRef.current = nextScore;
    movesRef.current = nextMoves;
    setBoard(nextBoard);
    setScore(nextScore);
    setMoves(nextMoves);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const savedBests = storedRecord(BESTS_KEY);
        const legacyBest = safeScore(localStorage.getItem("2048-best-v1"));
        setBests({ 4: safeScore(savedBests[4], legacyBest), 5: safeScore(savedBests[5]), 6: safeScore(savedBests[6]) });
        setSoundOn(localStorage.getItem("2048-sound") === "on");
        const savedTheme = localStorage.getItem("2048-theme");
        setDark(savedTheme === "dark" || (savedTheme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches));
        const savedLanguage = localStorage.getItem("2048-language");
        setLanguage(isLanguage(savedLanguage) ? savedLanguage : preferredLanguage(navigator.languages));
        const savedSpeedIndex = storedInteger(localStorage.getItem("2048-ai-speed"), 1, AI_SPEEDS.length - 1);
        setAiSpeedIndex(savedSpeedIndex);
        setAiEngine(localStorage.getItem("2048-ai-engine") === "expert" ? "expert" : "search");
        const parsed = parseStoredGame(localStorage.getItem(SAVE_KEY));
        if (parsed) {
            const savedSize = parsed.size;
            const savedSeed = parsed.rngSeed;
            const savedScore = parsed.score;
            const savedMoves = parsed.moves;
            rngSeedRef.current = savedSeed;
            rngStateRef.current = parsed.rngState;
            sizeRef.current = savedSize;
            setSize(savedSize);
            applyState(parsed.board, savedScore, savedMoves);
            setContinued(Boolean(parsed.continued));
            const restoredReplay = restoreGameReplay(parsed.replay);
            activeGameReplayRef.current = restoredReplay && replayMatchesSnapshot(restoredReplay, {
              board: parsed.board,
              score: savedScore,
              moves: savedMoves,
              rngState: rngStateRef.current,
            })
              ? restoredReplay
              : createGameReplay(savedSize, savedSeed, savedSpeedIndex, parsed.board, rngStateRef.current, savedScore, savedMoves);
        } else {
          const seed = createGameSeed();
          rngSeedRef.current = seed;
          rngStateRef.current = seed;
          const fresh = freshBoardOfSize(DEFAULT_SIZE, gameRandom);
          applyState(fresh, 0, 0);
          activeGameReplayRef.current = createGameReplay(DEFAULT_SIZE, seed, savedSpeedIndex, fresh, rngStateRef.current);
        }
      } catch {
        const seed = createGameSeed();
        rngSeedRef.current = seed;
        rngStateRef.current = seed;
        const fresh = freshBoardOfSize(DEFAULT_SIZE, gameRandom);
        applyState(fresh, 0, 0);
        activeGameReplayRef.current = createGameReplay(DEFAULT_SIZE, seed, 1, fresh, rngStateRef.current);
      }
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [applyState, gameRandom]);

  useEffect(() => {
    if (!ready) return;
    const replayEventCount = activeGameReplayRef.current?.events.length ?? 0;
    if (aiRunning && replayEventCount % 64 !== 0) return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(serializeStoredGame({ size: size as 4 | 5 | 6, board, score, moves, continued, rngSeed: rngSeedRef.current, rngState: rngStateRef.current, replay: serializeGameReplay(activeGameReplayRef.current) })));
        localStorage.setItem(BESTS_KEY, JSON.stringify(bests));
        localStorage.setItem("2048-sound", soundOn ? "on" : "off");
        localStorage.setItem("2048-theme", dark ? "dark" : "light");
        localStorage.setItem("2048-ai-speed", String(aiSpeedIndex));
        localStorage.setItem("2048-ai-engine", aiEngine);
        localStorage.setItem("2048-language", language);
      } catch { /* gameplay remains available without storage */ }
    }, aiRunning ? 0 : 500);
    return () => window.clearTimeout(timer);
  }, [ready, size, board, score, moves, continued, bests, soundOn, dark, aiSpeedIndex, aiEngine, aiRunning, language]);

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    if (!aiRunningRef.current) setAiThought(ui.waiting);
  }, [language, ui.waiting]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", dark ? "#10151b" : "#edf2f7");
  }, [dark]);

  useEffect(() => {
    if (!ready) return;
    const flush = () => {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(serializeStoredGame({ size: sizeRef.current as 4 | 5 | 6, board: boardRef.current, score: scoreRef.current, moves: movesRef.current, continued, rngSeed: rngSeedRef.current, rngState: rngStateRef.current, replay: serializeGameReplay(activeGameReplayRef.current) })));
        localStorage.setItem("2048-ai-engine", aiEngine);
      } catch { /* gameplay remains available without storage */ }
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [aiEngine, continued, ready]);

  const refreshReplaySummary = useCallback((targetSize = sizeRef.current) => {
    void getReplaySummary(targetSize).then((summary) => {
      if (sizeRef.current === targetSize) setReplaySummary(summary);
    }).catch(() => setReplaySummary(null));
  }, []);

  useEffect(() => {
    if (ready) refreshReplaySummary(size);
  }, [ready, refreshReplaySummary, size]);

  useEffect(() => () => {
    if (moveTimer.current) window.clearTimeout(moveTimer.current);
  }, []);

  useEffect(() => {
    const worker = new Worker(new URL("./ai/worker.ts", import.meta.url), { type: "module" });
    aiWorkerRef.current = worker;
    worker.onmessage = (event: MessageEvent<AiDecision & { id: number }>) => {
      const pending = aiPendingRef.current;
      if (!pending || pending.id !== event.data.id) return;
      aiPendingRef.current = null;
      pending.resolve(event.data);
    };
    worker.onerror = () => {
      aiPendingRef.current?.resolve(null);
      aiPendingRef.current = null;
    };
    return () => {
      aiPendingRef.current?.resolve(null);
      aiPendingRef.current = null;
      worker.terminate();
      aiWorkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const element = boardElementRef.current;
    if (!element || !ready) return;
    const updateMetrics = () => {
      const style = getComputedStyle(element);
      const gap = Number.parseFloat(style.columnGap) || 0;
      const padding = Number.parseFloat(style.paddingLeft) || 0;
      const innerWidth = element.clientWidth - padding * 2;
      const tile = (innerWidth - gap * (size - 1)) / size;
      setMotionMetrics({ tile, step: tile + gap });
    };
    updateMetrics();
    const observer = new ResizeObserver(updateMetrics);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ready, size]);

  const requestAiDecision = useCallback((currentBoard: Board, anchor: AiCorner, budgetMs: number, engine: AiEngine) => {
    const worker = aiWorkerRef.current;
    if (!worker) return Promise.resolve(null as AiDecision | null);
    aiPendingRef.current?.resolve(null);
    const id = ++aiRequestIdRef.current;
    return new Promise<AiDecision | null>((resolve) => {
      aiPendingRef.current = { id, resolve };
      worker.postMessage({ id, board: currentBoard, anchor, budgetMs, engine });
    });
  }, []);

  const startMusic = useCallback(async (showPrompt = true) => {
    try {
      let engine = musicRef.current;
      if (!engine || engine.context.state === "closed") {
        const AudioContextClass = audioContextClass();
        if (!AudioContextClass) throw new Error("Web Audio unavailable");
        const context = new AudioContextClass();
        const master = context.createGain();
        const musicBus = context.createGain();
        const compressor = context.createDynamicsCompressor();
        const delay = context.createDelay(1.2);
        const feedbackGain = context.createGain();
        master.gain.setValueAtTime(0.11, context.currentTime);
        musicBus.gain.setValueAtTime(0.72, context.currentTime);
        delay.delayTime.setValueAtTime(0.31, context.currentTime);
        feedbackGain.gain.setValueAtTime(0.18, context.currentTime);
        compressor.threshold.setValueAtTime(-20, context.currentTime);
        compressor.knee.setValueAtTime(18, context.currentTime);
        compressor.ratio.setValueAtTime(4, context.currentTime);
        musicBus.connect(compressor);
        musicBus.connect(delay);
        delay.connect(feedbackGain).connect(delay);
        delay.connect(compressor);
        compressor.connect(master).connect(context.destination);
        engine = { context, master, musicBus, delay, timer: null, step: 0, nextNoteTime: 0 };
        musicRef.current = engine;
      }
      if (engine.context.state !== "running") {
        await Promise.race([
          engine.context.resume(),
          new Promise<void>((resolve) => window.setTimeout(resolve, 260)),
        ]);
      }
      if (engine.context.state !== "running") throw new Error("Audio playback needs a gesture");
      const now = engine.context.currentTime;
      engine.master.gain.cancelScheduledValues(now);
      engine.master.gain.setTargetAtTime(0.11, now, 0.05);
      beginAmbientLoop(engine);
      setMusicPlaying(true);
      setNeedsAudioTap(false);
      return true;
    } catch {
      setMusicPlaying(false);
      if (showPrompt) setNeedsAudioTap(true);
      return false;
    }
  }, []);

  const stopMusic = useCallback(() => {
    stopMusicEngine(musicRef.current);
    musicRef.current = null;
    setMusicPlaying(false);
    setNeedsAudioTap(false);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const frame = requestAnimationFrame(() => {
      if (soundOn) void startMusic(false);
      else stopMusic();
    });
    return () => cancelAnimationFrame(frame);
  }, [ready, soundOn, startMusic, stopMusic]);

  useEffect(() => {
    const onVisibility = () => {
      const engine = musicRef.current;
      if (!engine) return;
      if (document.hidden) void engine.context.suspend();
      else if (soundOn) void startMusic(false);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stopMusicEngine(musicRef.current);
      musicRef.current = null;
    };
  }, [soundOn, startMusic]);

  const toggleSound = useCallback(() => {
    if (musicPlaying) {
      setSoundOn(false);
      stopMusic();
    } else {
      setSoundOn(true);
      void startMusic(true);
    }
  }, [musicPlaying, startMusic, stopMusic]);

  const pauseAi = useCallback((message = ui.paused) => {
    aiRunningRef.current = false;
    aiRequestIdRef.current += 1;
    aiPendingRef.current?.resolve(null);
    aiPendingRef.current = null;
    aiPrefetchRef.current = null;
    setAiRunning(false);
    setAiThought(message);
  }, [ui.paused]);

  const aiBoardKey = useCallback((currentBoard: Board, speedIndex: number, engine: AiEngine) => (
    `${engine}|${speedIndex}|${currentBoard.map((row) => row.join(",")).join(";")}`
  ), []);

  const feedback = useCallback((gained: number) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(gained >= 64 ? [18, 22, 18] : 12);
    if (soundOn && gained) playMergeTone(gained, musicRef.current);
  }, [soundOn]);

  const triggerGestureEffect = useCallback((direction: Direction, gained: number) => {
    const layer = gestureLayerRef.current;
    if (!layer || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const vector = direction === "left" ? [-1, 0] : direction === "right" ? [1, 0] : direction === "up" ? [0, -1] : [0, 1];
    const strength = Math.min(1.35, 0.85 + Math.log2(Math.max(2, gained || 2)) * .035);
    layer.animate([
      { opacity: .12, transform: "scale(.96)" },
      { opacity: .72, transform: `translate3d(${vector[0] * 8}px,${vector[1] * 8}px,0) scale(${strength})`, offset: .3 },
      { opacity: 0, transform: `translate3d(${vector[0] * 18}px,${vector[1] * 18}px,0) scale(1.08)` },
    ], { duration: 360, easing: "cubic-bezier(.2,.82,.25,1)" });
    layer.querySelectorAll("i").forEach((particle, index) => {
      const spread = (index - 2.5) * 10;
      const crossX = vector[1] * spread;
      const crossY = vector[0] * -spread;
      particle.animate([
        { opacity: 0, transform: "translate3d(-50%,-50%,0) scale(.45)" },
        { opacity: .82, offset: .18 },
        { opacity: 0, transform: `translate3d(calc(-50% + ${vector[0] * (46 + index * 5) + crossX}px),calc(-50% + ${vector[1] * (46 + index * 5) + crossY}px),0) scale(1.15)` },
      ], { duration: 300 + index * 18, easing: "cubic-bezier(.17,.76,.3,1)" });
    });
  }, []);

  const persistReplaySnapshot = useCallback((replay: ActiveGameReplay, finalScore: number, finalBoard: Board, finalMoves = movesRef.current) => {
    const candidate: ReplayCandidate = {
      ...replay,
      initialBoard: copyBoard(replay.initialBoard),
      events: [...replay.events],
      trace: replay.trace.map((entry) => ({ ...entry })),
      score: finalScore,
      maxTile: Math.max(...finalBoard.flat()),
      moves: finalMoves,
    };
    void saveReplayChampions(candidate).then((changed) => {
      if (changed) refreshReplaySummary(replay.size);
    }).catch(() => { /* logging must never interrupt gameplay */ });
  }, [refreshReplaySummary]);

  const queueReplaySnapshot = useCallback((replay: ActiveGameReplay, finalScore: number, finalBoard: Board, finalMoves: number) => {
    pendingReplayCandidateRef.current = {
      ...replay,
      initialBoard: copyBoard(replay.initialBoard),
      events: [...replay.events],
      trace: replay.trace.map((entry) => ({ ...entry })),
      score: finalScore,
      maxTile: Math.max(...finalBoard.flat()),
      moves: finalMoves,
    };
    if (championSaveTimerRef.current) return;
    championSaveTimerRef.current = window.setTimeout(() => {
      championSaveTimerRef.current = null;
      const candidate = pendingReplayCandidateRef.current;
      pendingReplayCandidateRef.current = null;
      if (!candidate) return;
      void saveReplayChampions(candidate).then((changed) => {
        if (changed) refreshReplaySummary(candidate.size);
      }).catch(() => { /* logging must never interrupt gameplay */ });
    }, 1000);
  }, [refreshReplaySummary]);

  useEffect(() => () => {
    if (championSaveTimerRef.current) window.clearTimeout(championSaveTimerRef.current);
    const candidate = pendingReplayCandidateRef.current;
    if (candidate) void saveReplayChampions(candidate).catch(() => {});
  }, []);

  const move = useCallback((direction: Direction, source: "human" | "ai" = "human") => {
    if (source === "human" && aiRunningRef.current) pauseAi(ui.takeover);
    if (animatingRef.current) {
      queuedDirection.current = direction;
      return;
    }
    if (confirmNew || helpOpen || winOpen) return;
    const current = boardRef.current;
    const result = moveBoard(current, direction, movesRef.current + 1);
    if (sameBoard(current, result.board)) return;
    triggerGestureEffect(direction, result.gained);
    const previousSnapshot: Snapshot = {
      board: copyBoard(current),
      score: scoreRef.current,
      moves: movesRef.current,
      rngState: rngStateRef.current,
    };

    if (source === "ai") {
      setAiMoveCount((count) => count + 1);
      setAiTrail((trail) => [...trail.slice(-7), direction]);
    }

    setHistory((old) => [...old.slice(-9), previousSnapshot]);
    const added = spawnRandomTile(result.board, gameRandom);
    const nextBoard = added.board;
    const nextScore = scoreRef.current + result.gained;
    const nextMoves = movesRef.current + 1;
    const reachedDeadEnd = !hasMoves(nextBoard);

    if (!activeGameReplayRef.current) {
      activeGameReplayRef.current = createGameReplay(sizeRef.current, rngSeedRef.current, aiSpeedIndex, current, rngStateRef.current, scoreRef.current, movesRef.current);
    }
    if (activeGameReplayRef.current) {
      const replay = activeGameReplayRef.current;
      const decision = lastAiDecisionRef.current;
      replay.events.push({ kind: "move", direction: DIRECTION_CODES[direction], source, speedIndex: source === "ai" ? aiSpeedIndex : 0 });
      replay.trace.push({
        depth: source === "ai" ? decision?.depth ?? 0 : 0,
        elapsedMs: source === "ai" ? decision?.elapsedMs ?? 0 : 0,
        nodes: source === "ai" ? decision?.nodes ?? 0 : 0,
        confidence: source === "ai" ? decision?.confidence ?? 0 : 0,
        empty: countEmpty(nextBoard),
        locked: source === "ai" && decision?.strategy === "lock",
      });
      if (reachedDeadEnd) persistReplaySnapshot(replay, nextScore, nextBoard, nextMoves);
      else queueReplaySnapshot(replay, nextScore, nextBoard, nextMoves);
      lastAiDecisionRef.current = null;
    }
    animatingRef.current = true;
    setAnimating(true);
    setHighlighted([]);
    setMotions(result.motions);
    setMotionRunning(false);
    const aiTiming = AI_SPEEDS[aiSpeedIndex];
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animationMs = reduceMotion ? 0 : source === "ai" ? aiTiming.animation : 178;
    const settleMs = reduceMotion ? 8 : source === "ai" ? aiTiming.settle : 178;
    setMotionDuration(animationMs);
    setArrivalDuration(reduceMotion ? 0 : source === "ai" ? Math.max(36, Math.min(72, settleMs)) : 150);
    requestAnimationFrame(() => setMotionRunning(true));
    feedback(result.gained);

    if (source === "ai" && !reachedDeadEnd) {
      const key = aiBoardKey(nextBoard, aiSpeedIndex, aiEngine);
      aiPrefetchRef.current = {
        key,
        promise: requestAiDecision(nextBoard, aiCornerRef.current, aiBudgetFor(nextBoard, aiSpeedIndex), aiEngine),
      };
    }

    if (result.gained) {
      setScoreBurst(result.gained);
      window.setTimeout(() => setScoreBurst(0), 500);
    }
    const previousMax = Math.max(...current.flat());
    const nextMax = Math.max(...nextBoard.flat());
    moveTimer.current = window.setTimeout(() => {
      applyState(nextBoard, nextScore, nextMoves);
      setBests((oldBests) => ({ ...oldBests, [sizeRef.current]: Math.max(oldBests[sizeRef.current] || 0, nextScore) }));
      setHighlighted([...result.mergedPoints, ...(added.point ? [added.point] : [])]);
      setMotions([]);
      setMotionRunning(false);
      animatingRef.current = false;
      setAnimating(false);
      if (source === "ai" && reachedDeadEnd) pauseAi(ui.fairEnd);
      if (!continued && previousMax < 2048 && nextMax >= 2048) {
        if (aiRunningRef.current) {
          setContinued(true);
          setAiThought(ui.continued);
        } else setWinOpen(true);
      }
    }, settleMs);
  }, [aiBoardKey, aiEngine, aiSpeedIndex, applyState, confirmNew, continued, feedback, gameRandom, helpOpen, pauseAi, persistReplaySnapshot, queueReplaySnapshot, requestAiDecision, triggerGestureEffect, ui.continued, ui.fairEnd, ui.takeover, winOpen]);

  useEffect(() => {
    if (animating || !queuedDirection.current) return;
    const direction = queuedDirection.current;
    queuedDirection.current = null;
    const frame = requestAnimationFrame(() => move(direction));
    return () => cancelAnimationFrame(frame);
  }, [animating, board, move]);

  const undo = useCallback(() => {
    if (animatingRef.current || confirmNew || helpOpen || winOpen) return;
    if (aiRunningRef.current) {
      setAiThought(ui.aiUndoBlocked);
      return;
    }
    pauseAi(ui.undoWait);
    setHistory((old) => {
      if (!old.length) return old;
      const snapshot = old[old.length - 1];
      rngStateRef.current = snapshot.rngState;
      const replay = activeGameReplayRef.current
        ?? createGameReplay(sizeRef.current, rngSeedRef.current, aiSpeedIndex, boardRef.current, rngStateRef.current, scoreRef.current, movesRef.current);
      replay.events.push({ kind: "undo", source: "human" });
      replay.trace.push({ depth: 0, elapsedMs: 0, nodes: 0, confidence: 0, empty: countEmpty(snapshot.board), locked: false });
      activeGameReplayRef.current = replay;
      queueReplaySnapshot(replay, snapshot.score, snapshot.board, snapshot.moves);
      lastAiDecisionRef.current = null;
      applyState(copyBoard(snapshot.board), snapshot.score, snapshot.moves);
      return old.slice(0, -1);
    });
  }, [aiSpeedIndex, applyState, confirmNew, helpOpen, pauseAi, queueReplaySnapshot, ui.aiUndoBlocked, ui.undoWait, winOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const isInteractiveControl = Boolean(target?.closest("button, a, input, select, textarea, [role='option'], [role='listbox']"));
      const isBoardInteraction = Boolean(target?.closest(".board"));
      const directions: Record<string, Direction | undefined> = {
        ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down",
        ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right",
      };
      const direction = directions[event.key];
      if (direction && (!isInteractiveControl || isBoardInteraction)) {
        event.preventDefault();
        if (soundOn && !musicPlaying) void startMusic(true);
        move(direction);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); undo(); }
      if (event.key === "Escape") { setOpenMenu(null); setHelpOpen(false); setConfirmNew(false); setWinOpen(false); setPendingSize(null); }
    };
    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey);
  }, [move, musicPlaying, soundOn, startMusic, undo]);

  const startNew = (targetSize = sizeRef.current) => {
    if (championSaveTimerRef.current) {
      window.clearTimeout(championSaveTimerRef.current);
      championSaveTimerRef.current = null;
    }
    pendingReplayCandidateRef.current = null;
    if (activeGameReplayRef.current && movesRef.current > 0) {
      persistReplaySnapshot(activeGameReplayRef.current, scoreRef.current, boardRef.current, movesRef.current);
    }
    pauseAi(ui.waiting);
    if (moveTimer.current) window.clearTimeout(moveTimer.current);
    animatingRef.current = false;
    queuedDirection.current = null;
    setAnimating(false);
    setMotions([]);
    setMotionRunning(false);
    setHighlighted([]);
    sizeRef.current = targetSize;
    setSize(targetSize);
    const seed = createGameSeed();
    rngSeedRef.current = seed;
    rngStateRef.current = seed;
    const fresh = freshBoardOfSize(targetSize, gameRandom);
    applyState(fresh, 0, 0);
    setHistory([]);
    setScoreBurst(0);
    setContinued(false);
    setWinOpen(false);
    setConfirmNew(false);
    setPendingSize(null);
    aiCornerRef.current = 0;
    setAiCorner(0);
    setAiMoveCount(0);
    setAiTrail([]);
    setAiDepth(2);
    setAiStrategy("recover");
    setAiStats({ nodes: 0, elapsedMs: 0, movableTiles: 0 });
    aiPrefetchRef.current = null;
    lastAiMoveStartRef.current = 0;
    activeGameReplayRef.current = createGameReplay(targetSize, seed, aiSpeedIndex, fresh, rngStateRef.current);
    lastAiDecisionRef.current = null;
  };

  const requestNew = () => {
    if (animatingRef.current) return;
    pauseAi(ui.waiting);
    setPendingSize(null);
    if (movesRef.current > 0) setConfirmNew(true);
    else startNew();
  };

  const requestSize = (targetSize: number) => {
    if (animatingRef.current) return;
    if (targetSize === sizeRef.current) return;
    pauseAi(ui.modeChanged);
    if (movesRef.current > 0) {
      setPendingSize(targetSize);
      setConfirmNew(true);
    } else startNew(targetSize);
  };

  const toggleAi = () => {
    if (aiRunningRef.current) {
      pauseAi();
      return;
    }
    if (!hasMoves(boardRef.current)) startNew(sizeRef.current);
    const anchor: AiCorner = 0;
    aiCornerRef.current = anchor;
    setAiCorner(anchor);
    setAiStrategy("recover");
    aiRunningRef.current = true;
    if (!activeGameReplayRef.current) activeGameReplayRef.current = createGameReplay(sizeRef.current, rngSeedRef.current, aiSpeedIndex, boardRef.current, rngStateRef.current, scoreRef.current, movesRef.current);
    lastAiMoveStartRef.current = 0;
    setAiRunning(true);
    setAiThought(ui.planning);
    if (soundOn && !musicPlaying) void startMusic(true);
  };

  useEffect(() => {
    if (!aiRunning || animating || confirmNew || helpOpen || winOpen) return;
    const timing = AI_SPEEDS[aiSpeedIndex];
    const elapsed = lastAiMoveStartRef.current ? performance.now() - lastAiMoveStartRef.current : timing.target;
    const waitMs = Math.max(0, timing.target - elapsed);
    const timer = window.setTimeout(() => {
      const key = aiBoardKey(boardRef.current, aiSpeedIndex, aiEngine);
      const prefetched = aiPrefetchRef.current?.key === key ? aiPrefetchRef.current.promise : null;
      aiPrefetchRef.current = null;
      const budget = aiBudgetFor(boardRef.current, aiSpeedIndex);
      const decisionPromise = prefetched || requestAiDecision(boardRef.current, aiCornerRef.current, budget, aiEngine);
      void decisionPromise.then((decision) => {
        if (!aiRunningRef.current || animatingRef.current) return;
        const direction = decision?.direction || chooseFallbackMove(boardRef.current, aiCornerRef.current);
        if (!direction) {
          pauseAi(ui.noMoves);
          return;
        }
        if (decision) {
          aiCornerRef.current = decision.anchor;
          setAiCorner(decision.anchor);
          setAiStrategy(decision.strategy);
          setAiDepth(decision.depth);
          setAiStats({ nodes: decision.nodes, elapsedMs: decision.elapsedMs, movableTiles: decision.movableTiles });
          const searchMode = isEndgameSearch(boardRef.current) ? ui.endgame : decision.strategy === "lock" ? ui.lock : ui.sequence;
          setAiThought(`${ui.direction[direction]} · ${searchMode} · ${decision.depth} ${ui.levels}`);
        } else setAiThought(`${ui.direction[direction]} · ${ui.fastDecision}`);
        lastAiDecisionRef.current = decision;
        lastAiMoveStartRef.current = performance.now();
        move(direction, "ai");
      });
    }, waitMs);
    return () => window.clearTimeout(timer);
  }, [aiBoardKey, aiEngine, aiRunning, aiSpeedIndex, animating, board, confirmNew, helpOpen, move, pauseAi, requestAiDecision, ui.direction, ui.endgame, ui.fastDecision, ui.levels, ui.lock, ui.noMoves, ui.sequence, winOpen]);

  const resetDragPreview = () => {
    const element = boardElementRef.current;
    if (!element) return;
    element.classList.remove("is-dragging");
    element.style.removeProperty("--drag-x");
    element.style.removeProperty("--drag-y");
  };

  const previewTouch = (x: number, y: number) => {
    if (!touchStart.current || animatingRef.current) return;
    const dx = x - touchStart.current.x;
    const dy = y - touchStart.current.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 5) return;
    const direction: Direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
    if (sameBoard(boardRef.current, moveBoard(boardRef.current, direction, 0).board)) {
      resetDragPreview();
      return;
    }
    const limit = 18;
    const damped = Math.min(limit, distance * 0.18);
    const element = boardElementRef.current;
    if (!element) return;
    const bounds = element.getBoundingClientRect();
    element.style.setProperty("--glow-x", `${Math.max(0, Math.min(100, (x - bounds.left) / bounds.width * 100))}%`);
    element.style.setProperty("--glow-y", `${Math.max(0, Math.min(100, (y - bounds.top) / bounds.height * 100))}%`);
    element.classList.add("is-dragging");
    element.style.setProperty("--drag-x", `${dx / distance * damped}px`);
    element.style.setProperty("--drag-y", `${dy / distance * damped}px`);
  };

  const endTouch = (x: number, y: number) => {
    if (!touchStart.current) return;
    const dx = x - touchStart.current.x;
    const dy = y - touchStart.current.y;
    touchStart.current = null;
    resetDragPreview();
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
  };

  const importReplayFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    try {
      const parsed = parseReplayPayload(await file.text());
      pauseAi(ui.paused);
      if (moveTimer.current) window.clearTimeout(moveTimer.current);
      animatingRef.current = false;
      setAnimating(false);
      setMotions([]);
      setHighlighted([]);
      setHistory([]);
      sizeRef.current = parsed.size;
      setSize(parsed.size);
      rngSeedRef.current = parsed.seed;
      rngStateRef.current = parsed.finalRngState;
      applyState(parsed.finalBoard, parsed.score, parsed.moves);
      setContinued(parsed.maxTile >= 2048);
      setWinOpen(false);
      setAiMoveCount(parsed.events.filter((entry) => entry.kind === "move" && entry.source === "ai").length);
      setAiTrail([]);
      setAiStats({ nodes: 0, elapsedMs: 0, movableTiles: 0 });
      activeGameReplayRef.current = {
        algorithm: parsed.algorithm,
        rules: parsed.rules,
        size: parsed.size,
        seed: parsed.seed,
        speedIndex: parsed.speedIndex,
        initialBoard: parsed.initialBoard.map((row) => [...row]),
        initialRngState: parsed.initialRngState,
        initialScore: parsed.initialScore,
        initialMoves: parsed.initialMoves,
        events: [...parsed.events],
        trace: parsed.trace.map((entry) => ({ ...entry })),
      };
      showToast(ui.importedReplay);
    } catch {
      showToast(ui.importFailed);
    }
  };

  const downloadJson = (payload: string, filename: string) => {
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const downloadCurrentReplay = () => {
    try {
      const active = activeGameReplayRef.current;
      if (!active) return;
      const payload = JSON.stringify({
          format: "2048-full-replay-v3",
          rules: active.rules,
          algorithm: active.algorithm,
          size: active.size,
          seed: active.seed,
          speedIndex: active.speedIndex,
          initialBoard: active.initialBoard,
          initialRngState: active.initialRngState,
          initialScore: active.initialScore,
          initialMoves: active.initialMoves,
          score: scoreRef.current,
          maxTile: Math.max(...boardRef.current.flat()),
          moves: movesRef.current,
          actions: active.events.length,
          events: bytesToBase64(packEvents(active.events)),
          trace: bytesToBase64(packTrace(active.trace)),
      });
      downloadJson(payload, `2048-current-${Math.max(...boardRef.current.flat())}-${scoreRef.current}.2048log`);
      showToast(ui.exportedCurrent);
    } catch { showToast(ui.exportFailed); }
  };

  const downloadChampionReplay = async () => {
    try {
      const replay = await getPreferredReplay(sizeRef.current);
      if (!replay) return;
      const encode = (bytes: Uint8Array) => {
        let binary = "";
        for (const byte of bytes) binary += String.fromCharCode(byte);
        return btoa(binary);
      };
      const isFullSession = Boolean(replay.eventBytes);
      const payload = JSON.stringify({
        format: isFullSession && replay.rules === "official-2048-v1" ? "2048-full-replay-v3" : isFullSession ? "2048-full-replay-v2" : "2048-ai-replay-v1",
        rules: replay.rules ?? "classic-2048-distribution-v1",
        algorithm: replay.algorithm,
        size: replay.size,
        seed: replay.seed,
        speedIndex: replay.speedIndex,
        score: replay.score,
        maxTile: replay.maxTile,
        moves: replay.moves,
        ...(isFullSession ? {
          initialBoard: replay.initialBoard,
          initialRngState: replay.initialRngState,
          initialScore: replay.initialScore,
          initialMoves: replay.initialMoves,
          actions: replay.eventCount,
          events: encode(replay.eventBytes!),
        } : { directions: encode(replay.directionBytes!) }),
        trace: encode(replay.traceBytes),
      });
      downloadJson(payload, `2048-record-${replay.maxTile}-${replay.score}.2048log`);
      showToast(ui.exportedRecord);
    } catch { showToast(ui.exportFailed); }
  };

  const maxTile = Math.max(...board.flat());
  const best = bests[size] || 0;
  const nextTarget = Math.max(4, (maxTile || 2) * 2);
  const emptyCount = countEmpty(board);
  const aiRoute = snakePositions(size, aiCorner);
  const endgameSearch = isEndgameSearch(board);
  const displayedMaxTile = maxTile || 2;

  return (
    <main
      className={`game-shell${dark ? " dark" : ""}`}
      lang={language === "zh" ? "zh-CN" : language}
      dir={language === "ar" ? "rtl" : "ltr"}
      onPointerDownCapture={() => { if (soundOn && !musicPlaying) void startMusic(true); }}
    >
      <section
        className="game"
        aria-label={`2048 · ${ui.eyebrow}`}
        aria-hidden={confirmNew || helpOpen || undefined}
        inert={confirmNew || helpOpen || undefined}
      >
        <header className="topbar">
          <div>
            <p className="eyebrow">{ui.eyebrow}</p>
            <h1>2048</h1>
          </div>
          <div className="scores" aria-label={ui.score}>
            <div className={`score-card score-digits-${Math.min(9, String(score).length)}`}><span>{ui.score}</span><strong>{score}</strong>{scoreBurst > 0 && <i>+{scoreBurst}</i>}</div>
            <div className={`score-card score-digits-${Math.min(9, String(best).length)}`}><span>{ui.best}</span><strong>{best}</strong></div>
          </div>
        </header>

        <div className="mode-switcher" aria-label={ui.boardSize}>
          {VALID_SIZES.map((modeSize) => (
            <button
              key={modeSize}
              className={size === modeSize ? "active" : ""}
              onClick={() => requestSize(modeSize)}
              aria-pressed={size === modeSize}
              disabled={animating}
            >
              {modeSize} × {modeSize}
            </button>
          ))}
        </div>

        <div className="action-row">
          <div className="mini-actions">
            <button className="icon-button" onClick={undo} disabled={!history.length || animating || aiRunning} aria-label={aiRunning ? ui.aiUndoBlocked : ui.undo} data-tooltip={aiRunning ? ui.aiUndoBlocked : ui.undo}>↶</button>
            <button className={`icon-button sound-button${musicPlaying ? " is-playing" : ""}`} onClick={toggleSound} aria-label={musicPlaying ? ui.soundOff : ui.soundOn} data-tooltip={musicPlaying ? ui.soundOff : ui.soundOn}>{musicPlaying ? "♫" : "⊘"}</button>
            <button className="icon-button" onClick={() => setDark((value) => !value)} aria-label={dark ? ui.light : ui.dark} data-tooltip={dark ? ui.light : ui.dark}>{dark ? "☀" : "☾"}</button>
            <GlassMenu
              compact
              value={language}
              label={ui.language}
              tooltip={ui.chooseLanguage}
              open={openMenu === "language"}
              options={LANGUAGES.map((item) => ({ value: item.code, label: item.nativeName, short: item.short, dir: item.dir }))}
              onToggle={() => setOpenMenu((current) => current === "language" ? null : "language")}
              onChange={(value) => { setLanguage(value as Language); setOpenMenu(null); }}
            />
            <button className="icon-button" onClick={() => { pauseAi(); setOpenMenu(null); setHelpOpen(true); }} aria-label={ui.help} data-tooltip={ui.help}>?</button>
          </div>
          <button className="primary-button" onClick={requestNew} disabled={animating}>{ui.newGame}</button>
        </div>

        <div className={`ai-bar${aiRunning ? " active" : ""}`}>
          <div className="ai-identity">
            <span className="ai-core" aria-hidden="true">AI</span>
            <div>
              <strong>{ui.aiChallenge}</strong>
            <small>{aiRunning ? `${aiEngine === "expert" ? ui.engineExpert : ui.engineSearch} · ${aiThought}` : `${aiEngine === "expert" ? ui.engineExpert : ui.engineSearch} · ${ui.fairForward} · ${ui.nextTarget} ${nextTarget}`}</small>
            </div>
          </div>
          <div className="ai-actions">
            <GlassMenu
              compact
              value={aiEngine}
              label={ui.aiEngine}
              tooltip={ui.aiEngine}
              open={openMenu === "engine"}
              options={[{ value: "search", label: ui.engineSearch, short: "⌕" }, { value: "expert", label: ui.engineExpert, short: "✦" }]}
              onToggle={() => setOpenMenu((current) => current === "engine" ? null : "engine")}
              onChange={(value) => { pauseAi(ui.paused); setAiEngine(value as AiEngine); setOpenMenu(null); }}
            />
            <GlassMenu
              value={String(aiSpeedIndex)}
              label={ui.aiSpeed}
              tooltip={ui.chooseSpeed}
              open={openMenu === "speed"}
              options={AI_SPEEDS.map((speed, index) => ({ value: String(index), label: ui.speeds[index] }))}
              onToggle={() => setOpenMenu((current) => current === "speed" ? null : "speed")}
              onChange={(value) => { setAiSpeedIndex(Number(value)); setOpenMenu(null); }}
            />
            <button className="ai-toggle" onClick={toggleAi}>{aiRunning ? ui.pause : ui.start}</button>
          </div>
        </div>

        <div className="ai-route-panel" aria-label={ui.routeLabel}>
            <div
              className="route-map"
              style={{ "--route-size": size } as CSSProperties}
              aria-hidden="true"
            >
              {aiRoute.map((point, index) => (
                <span
                  key={`${point.row}-${point.col}`}
                  className={index === 0 ? "route-anchor" : ""}
                  style={{
                    gridColumn: point.col + 1,
                    gridRow: point.row + 1,
                    "--route-alpha": Math.max(.15, .92 - index / aiRoute.length * .8),
                  } as CSSProperties}
                >
                  {index < 4 ? index + 1 : ""}
                </span>
              ))}
            </div>
            <div className="route-story">
              <strong>{ui.anchor} · {endgameSearch ? ui.endgame : maxTile < 128 ? ui.sequence : aiStrategy === "lock" ? ui.lock : ui.recover}</strong>
              <span>{aiTrail.length ? aiTrail.map((direction) => DIRECTION_ARROWS[direction]).join(" ") : ui.preserveSearch}</span>
              <small>{aiStats.nodes > 0 ? `${aiStats.nodes.toLocaleString()} · ${emptyCount} · ` : ""}{ui.officialFair}</small>
              <div className="replay-actions">
                <input ref={replayInputRef} className="sr-only" type="file" accept=".2048log,application/json,.json" onChange={(event) => void importReplayFile(event)} />
                <button className="replay-export" onClick={() => replayInputRef.current?.click()} aria-label={ui.importReplayHint} data-tooltip={ui.importReplayHint}><i aria-hidden="true">↑</i>{ui.importReplay}</button>
                <button className="replay-export" onClick={downloadCurrentReplay} disabled={!ready} aria-label={ui.exportCurrentHint} data-tooltip={ui.exportCurrentHint}><i aria-hidden="true">↓</i>{ui.currentRound} · {moves} {ui.steps}</button>
                {replaySummary && <button className="replay-export" onClick={() => void downloadChampionReplay()} aria-label={ui.exportRecordHint} data-tooltip={ui.exportRecordHint}><i aria-hidden="true">↓</i>{ui.record} · {Math.max(1, Math.ceil(replaySummary.bytes / 1024))}KB</button>}
              </div>
            </div>
            <div className="route-metrics">
              <span>{ui.aiMoves}<b>{aiMoveCount}</b></span>
              <span>{ui.lookahead}<b>{aiDepth} {ui.levels}</b></span>
              <span>{ui.movedTiles}<b>{aiStats.movableTiles}</b></span>
              <span>{ui.elapsed}<b>{Math.round(aiStats.elapsedMs)}ms</b></span>
            </div>
        </div>

        {toast && <div className="app-toast" role="status" aria-live="polite"><i aria-hidden="true">✓</i>{toast}</div>}

        <div className="board-stack">
          <div
            ref={boardElementRef}
            className={`board board-${size}${animating ? " is-moving" : ""}`}
            style={{ "--size": size, "--motion-duration": `${motionDuration}ms`, "--arrival-duration": `${arrivalDuration}ms` } as CSSProperties}
            role="region"
            tabIndex={0}
            aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight W A S D"
            aria-busy={!ready || animating}
            aria-label={ui.boardLabel(size, displayedMaxTile)}
            aria-describedby="board-state"
            onContextMenu={(event) => event.preventDefault()}
            onPointerDown={(event) => { touchStart.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); }}
            onPointerMove={(event) => previewTouch(event.clientX, event.clientY)}
            onPointerUp={(event) => endTouch(event.clientX, event.clientY)}
            onPointerCancel={() => { touchStart.current = null; resetDragPreview(); }}
          >
          <div ref={gestureLayerRef} className="gesture-layer" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
          {Array.from({ length: size * size }, (_, index) => <div className="cell" key={index} />)}
          <div className="tiles-layer" aria-hidden="true">
            {motions.length > 0 ? motions.map((tile) => (
              <div
                key={tile.id}
                className={`tile ${tile.moving ? "moving-tile" : "settled-motion-tile"} ${tileClass(tile.value)}${tile.moving && motionRunning ? " motion-run" : ""}${tile.merging ? " motion-merge" : ""}`}
                style={(tile.moving ? {
                  width: motionMetrics.tile,
                  height: motionMetrics.tile,
                  "--from-left": `${tile.fromCol * motionMetrics.step}px`,
                  "--from-top": `${tile.fromRow * motionMetrics.step}px`,
                  "--to-left": `${tile.toCol * motionMetrics.step}px`,
                  "--to-top": `${tile.toRow * motionMetrics.step}px`,
                } : { gridColumn: tile.fromCol + 1, gridRow: tile.fromRow + 1 }) as CSSProperties}
                aria-hidden="true"
              >
                <span>{tile.value}</span>
              </div>
            )) : board.flatMap((row, r) => row.map((value, c) => value ? (
              <div
                key={`${r}-${c}-${value}`}
                className={`tile static-tile ${tileClass(value)}${highlighted.some((point) => point.row === r && point.col === c) ? " tile-arrive" : ""}`}
                style={{ gridColumn: c + 1, gridRow: r + 1 }}
              >
                <span>{value}</span>
              </div>
            ) : null))}
          </div>
          <p id="board-state" className="sr-only">{board.map((row) => row.join(", ")).join(" / ")}</p>
          {winOpen && (
            <div className="board-message win-message" role="dialog" aria-modal="true" aria-live="assertive" aria-label={ui.winAria}>
              <span className="spark" aria-hidden="true">✦</span>
              <strong>{ui.achieved}</strong>
              <span>{ui.made2048}</span>
              <div className="message-actions">
                <button className="secondary-button" onClick={() => startNew()}>{ui.newGame}</button>
                <button autoFocus onClick={() => { setContinued(true); setWinOpen(false); }}>{ui.continueChallenge}</button>
              </div>
            </div>
          )}
          {gameOver && !winOpen && (
            <div className="board-message" role="dialog" aria-modal="true" aria-live="assertive" aria-label={ui.gameOver}>
              <strong>{ui.gameOver}</strong>
              <span>{ui.scoreLine(score, moves)}</span>
              <div className="message-actions">
                <button className="secondary-button" onClick={undo} disabled={!history.length}>{ui.undoOne}</button>
                <button autoFocus onClick={toggleAi}>{ui.aiAgain}</button>
              </div>
            </div>
          )}
          </div>

          <div className="status-row" aria-label={ui.roundStats} aria-live="polite">
            <span>{ui.steps} <strong>{moves}</strong></span>
            <i />
            <span>{ui.maxTile} <strong>{displayedMaxTile}</strong></span>
            <i />
            <span className={`swipe-tip${aiRunning ? " ai-live" : ""}`}>{aiRunning ? ui.aiRunning : `${size} × ${size} · ${ui.swipe}`}</span>
          </div>
        </div>
      </section>

      <p className="footer-tip" aria-hidden={confirmNew || helpOpen || winOpen || gameOver || undefined} inert={confirmNew || helpOpen || winOpen || gameOver || undefined}><strong>{ui.gameplay}</strong>{ui.gameplayText}</p>

      {needsAudioTap && soundOn && !confirmNew && !helpOpen && !winOpen && !gameOver && (
        <button className="music-prompt" onClick={() => void startMusic(true)} aria-label={ui.soundOn}>
          <span className="music-wave" aria-hidden="true"><i /><i /><i /></span>
          {ui.musicPrompt}
        </button>
      )}

      {confirmNew && (
        <div className="sheet-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) { setConfirmNew(false); setPendingSize(null); } }}>
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="restart-title">
            <span className="sheet-symbol" aria-hidden="true">↻</span>
            <h2 id="restart-title">{pendingSize ? `${ui.switchPrompt} ${pendingSize} × ${pendingSize}?` : ui.newPrompt}</h2>
            <p>{ui.replaceProgress}</p>
            <div className="sheet-actions">
              <button autoFocus className="secondary-button" onClick={() => { setConfirmNew(false); setPendingSize(null); }}>{ui.continueRound}</button>
              <button className="danger-button" onClick={() => startNew(pendingSize ?? sizeRef.current)}>{pendingSize ? ui.switchMode : ui.restart}</button>
            </div>
          </div>
        </div>
      )}

      {helpOpen && (
        <div className="sheet-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) setHelpOpen(false); }}>
          <div className="sheet help-sheet" role="dialog" aria-modal="true" aria-labelledby="help-title">
            <button autoFocus className="close-button" onClick={() => setHelpOpen(false)} aria-label={ui.closeHelp}>×</button>
            <p className="sheet-kicker">{ui.helpKicker}</p>
            <h2 id="help-title">{ui.howTo}</h2>
            <ol>
              <li><b>1</b><span>{ui.help1}</span></li>
              <li><b>2</b><span>{ui.help2}</span></li>
              <li><b>3</b><span>{ui.help3}</span></li>
              <li><b>{ui.fair}</b><span>{ui.helpFair}</span></li>
              <li><b>AI</b><span>{ui.helpAi}</span></li>
            </ol>
            <p className="keyboard-tip">{ui.keyboard}</p>
            <button className="wide-button" onClick={() => setHelpOpen(false)}>{ui.understood}</button>
          </div>
        </div>
      )}
    </main>
  );
}
