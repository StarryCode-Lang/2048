import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

test("package, lockfile, changelog, and service-worker cache share the v2 release version", async () => {
  const [pkg, lock, changelog, worker] = await Promise.all([
    readJson(new URL("../package.json", import.meta.url)),
    readJson(new URL("../package-lock.json", import.meta.url)),
    readFile(new URL("../CHANGELOG.md", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
  ]);
  assert.equal(pkg.version, "2.0.0");
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[""].version, pkg.version);
  assert.match(changelog, new RegExp(`^## v${pkg.version.replaceAll(".", "\\.")} \\(`, "m"));
  assert.match(worker, new RegExp(`2048-shell-v${pkg.version.replaceAll(".", "\\.")}`));
  new vm.Script(worker, { filename: "public/sw.js" });
});

test("PWA shell precaches emitted assets and never serves HTML as a missing static asset", async () => {
  const [manifest, worker] = await Promise.all([
    readJson(new URL("../public/manifest.webmanifest", import.meta.url)),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
  ]);
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.some((icon) => icon.purpose.includes("maskable")));
  assert.match(worker, /html\.matchAll/);
  assert.match(worker, /\/_next\/static\//);
  assert.match(worker, /event\.request\.mode === "navigate"/);
  assert.match(worker, /return Response\.error\(\)/);
  assert.doesNotMatch(worker, /cached\s*\?\?\s*caches\.match\(SHELL/);
});
