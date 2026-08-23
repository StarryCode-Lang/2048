import { spawn } from "node:child_process";
import process from "node:process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const vinext = resolve(root, "node_modules/vinext/dist/cli.js");
const timeoutMs = Number(process.env.SITES_BUILD_TIMEOUT_MS ?? 180_000);

function run(command, args, timeout = 0) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      cwd: root,
    });
    const timer = timeout > 0
      ? setTimeout(() => {
          child.kill("SIGTERM");
          reject(new Error(`Command timed out after ${timeout} ms: ${command} ${args.join(" ")}`));
        }, timeout)
      : null;

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (timer) clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`Command failed (${code ?? signal}): ${command} ${args.join(" ")}`));
    });
  });
}

await run(process.execPath, [vinext, "build"], timeoutMs);
await run(process.execPath, [resolve(root, "scripts/validate-artifact.mjs")]);
