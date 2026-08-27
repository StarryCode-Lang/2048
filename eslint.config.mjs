import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals.filter((config) => !config.ignores),
  ...nextTs.filter((config) => !config.ignores),
  // Replace eslint-config-next's generated-directory defaults because this
  // project keeps deployment source code in build/.
  globalIgnores([
    // Framework, deployment, test, and local tool outputs.
    ".next/**",
    "out/**",
    "dist/**",
    ".sites-runtime/**",
    ".wrangler/**",
    "coverage/**",
    "outputs/**",
    "work/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
