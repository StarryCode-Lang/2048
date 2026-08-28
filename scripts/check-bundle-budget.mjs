import { readdir, readFile, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { join, resolve } from "node:path";

const clientRoot = resolve(import.meta.dirname, "../dist/client/_next/static");
const MAX_JS_GZIP = 190_000;

async function collect(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(path));
    else if (entry.name.endsWith(".js")) files.push(path);
  }
  return files;
}

const files = await collect(clientRoot);
const rawBytes = (await Promise.all(files.map((file) => stat(file)))).reduce((sum, item) => sum + item.size, 0);
const gzipBytes = (await Promise.all(files.map(async (file) => gzipSync(await readFile(file), { level: 9 }).byteLength))).reduce((sum, size) => sum + size, 0);
console.log(JSON.stringify({ files: files.length, rawBytes, gzipBytes, maxJsGzipBytes: MAX_JS_GZIP }));
if (gzipBytes > MAX_JS_GZIP) {
  console.error(`JavaScript gzip budget exceeded: ${gzipBytes} > ${MAX_JS_GZIP}`);
  process.exitCode = 1;
}
