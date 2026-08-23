import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const workerPath = resolve(root, "dist/server/index.js");
const clientPath = resolve(root, "dist/client");
const hostingPath = resolve(root, "dist/.openai/hosting.json");

assert((await stat(workerPath)).isFile(), "Missing Sites Worker entry: dist/server/index.js");
assert((await stat(clientPath)).isDirectory(), "Missing static client output: dist/client");
assert((await stat(hostingPath)).isFile(), "Missing packaged Sites manifest: dist/.openai/hosting.json");

JSON.parse(await readFile(hostingPath, "utf8"));
const workerUrl = pathToFileURL(workerPath);
workerUrl.searchParams.set("sites-validation", `${process.pid}-${Date.now()}`);
const worker = await import(workerUrl.href);
assert.equal(
  typeof worker.default?.fetch,
  "function",
  "dist/server/index.js must have an ESM default export with fetch(request, env, ctx)",
);

console.log("Validated Sites artifact: client assets, hosting manifest, and Worker default.fetch are present.");
