import { simulateAiGame } from "../app/ai/simulate.ts";

const maxMoves = Math.max(100, Number(process.argv[2] ?? 600));
const nodeBudget = Math.max(256, Number(process.argv[3] ?? 1024));
const seeds = [
  131556, 2048, 0x2048cafe, 0x5eed1234,
  17, 4096, 8675309, 0xf00dcafe,
  0x10203040, 0x89abcdef, 0x31415926, 0x27182818,
  73, 65537, 0xabcdef01, 0x13579bdf,
];

const started = performance.now();
const results = seeds.map((seed) => simulateAiGame({ seed, maxMoves, nodeBudget }));
const scores = results.map((result) => result.score).sort((a, b) => a - b);
const tiles = results.map((result) => result.maxTile);
const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
const scoreStandardDeviation = Math.sqrt(scores.reduce((sum, score) => sum + (score - averageScore) ** 2, 0) / scores.length);
const summary = {
  seeds: results.length,
  maxMoves,
  nodeBudget,
  averageScore: Math.round(averageScore),
  scoreStandardDeviation: Math.round(scoreStandardDeviation),
  lowerQuartileScore: scores[Math.floor(scores.length * .25)],
  medianScore: scores[Math.floor(scores.length / 2)],
  minimumScore: scores[0],
  reached512: tiles.filter((tile) => tile >= 512).length,
  reached1024: tiles.filter((tile) => tile >= 1024).length,
  reached2048: tiles.filter((tile) => tile >= 2048).length,
  elapsedMs: Math.round(performance.now() - started),
  results: results.map((result) => ({
    seed: result.seed,
    score: result.score,
    moves: result.moves,
    maxTile: result.maxTile,
  })),
};

console.log(JSON.stringify(summary, null, 2));

const passed = results.every((result) => result.moves === maxMoves && result.maxTile >= 512)
  && summary.minimumScore >= 8000
  && summary.averageScore >= 9400;
if (!passed) {
  console.error("AI multi-seed quality gate failed.");
  process.exitCode = 1;
}
