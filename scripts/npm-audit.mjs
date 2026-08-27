import { spawnSync } from "node:child_process";

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  console.error("npm_execpath is unavailable; run this command through npm.");
  process.exit(1);
}

const env = { ...process.env };
for (const key of Object.keys(env)) {
  // npm 12 rejects a global allow-scripts value after it is inherited by a
  // project-scoped nested npm process. package.json remains the project truth.
  if (key.toLowerCase() === "npm_config_allow_scripts") delete env[key];
}

const result = spawnSync(
  process.execPath,
  [npmCli, "audit", ...process.argv.slice(2), "--registry=https://registry.npmjs.org"],
  { env, stdio: "inherit" },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
