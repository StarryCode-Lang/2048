import { simulateAiGame } from "../app/ai/simulate.ts";

const maxMoves = Math.max(60, Number(process.argv[2] ?? 300));
const nodeBudget = Math.max(256, Number(process.argv[3] ?? 1024));
const seeds = [131556, 2048, 0x2048cafe, 0x5eed1234, 17, 4096, 8675309, 0xf00dcafe];

function summarize(engine: "search" | "expert") {
  const started = performance.now();
  const results = seeds.map((seed) => simulateAiGame({ seed, maxMoves, nodeBudget, engine }));
  const scores = results.map((result) => result.score).sort((a, b) => a - b);
  return {
    engine,
    averageScore: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
    medianScore: scores[Math.floor(scores.length / 2)],
    minimumScore: scores[0],
    reached512: results.filter((result) => result.maxTile >= 512).length,
    reached1024: results.filter((result) => result.maxTile >= 1024).length,
    elapsedMs: Math.round(performance.now() - started),
    results: results.map(({ seed, score, moves, maxTile }) => ({ seed, score, moves, maxTile })),
  };
}

const search = summarize("search");
const expert = summarize("expert");
console.log(JSON.stringify({ maxMoves, nodeBudget, search, expert, delta: {
  averageScore: expert.averageScore - search.averageScore,
  reached1024: expert.reached1024 - search.reached1024,
  elapsedMs: expert.elapsedMs - search.elapsedMs,
} }, null, 2));
