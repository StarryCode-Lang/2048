import { readFile } from "node:fs/promises";

const root = new URL("..", import.meta.url);
const limits = new Map([
  ["app/page.tsx", 1200],
  ["app/globals.css", 600],
  ["app/i18n/messages.ts", 300],
  ["app/ai/bitboard.ts", 700],
  ["app/ai/worker.ts", 600],
]);

for (const [relativePath, limit] of limits) {
  const source = await readFile(new URL(relativePath, root), "utf8");
  const lines = source.split(/\r?\n/).length - 1;
  if (lines > limit) throw new Error(`${relativePath} has ${lines} lines (limit ${limit})`);
  console.log(`${relativePath}: ${lines}/${limit}`);
}
