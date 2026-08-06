import { defineConfig, globalIgnores } from "eslint/config";
// 🚀 重点：在末尾加上 .js 后缀
import nextVitals from "eslint-config-next/core-web-vitals.js"; 
import nextTs from "eslint-config-next/typescript.js";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;