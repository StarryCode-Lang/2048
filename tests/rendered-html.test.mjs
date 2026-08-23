import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

const clientRoot = resolve(import.meta.dirname, "../dist/client");

const env = {
  ASSETS: {
    async fetch(request) {
      const pathname = decodeURIComponent(new URL(request.url).pathname);
      const filePath = resolve(clientRoot, `.${pathname}`);
      if (!filePath.startsWith(clientRoot)) return new Response("Forbidden", { status: 403 });
      try {
        const body = await readFile(filePath);
        return new Response(body, {
          headers: { "content-type": contentTypes[extname(filePath)] ?? "application/octet-stream" },
        });
      } catch {
        return new Response("Not found", { status: 404 });
      }
    },
  },
};

const ctx = {
  waitUntil() {},
  passThroughOnException() {},
};

test("renders production HTML and every emitted asset is served by the Worker", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    env,
    ctx,
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.doesNotMatch(html, developmentPreviewMeta);
  assert.match(html, /<h1[^>]*>2048<\/h1>/i);

  const assetPaths = [...html.matchAll(/(?:href|src)=["']([^"']+)["']/gi)]
    .map((match) => new URL(match[1], "http://localhost").pathname)
    .filter((pathname) => pathname.startsWith("/assets/") || pathname.startsWith("/_next/static/"));
  assert.ok(assetPaths.length > 0, "rendered HTML must reference production assets");

  for (const pathname of new Set(assetPaths)) {
    const asset = await worker.fetch(new Request(`http://localhost${pathname}`), env, ctx);
    assert.equal(asset.status, 200, `${pathname} was not served`);
    assert.notEqual(asset.headers.get("content-type"), "text/plain;charset=UTF-8", `${pathname} has a fallback content type`);
  }
});
