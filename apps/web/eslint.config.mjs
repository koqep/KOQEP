import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // M6 Slice C: nextVitals zaten jsx-a11y plugin'ini kayıt ediyor (6 dar
  // kuralla) - eklentiyi ikinci kez kaydetmemek için (ConfigError: Cannot
  // redefine plugin) sadece recommended kural setinin rules'ını üstüne
  // bindiriyoruz.
  {
    rules: jsxA11y.flatConfigs.recommended.rules,
  },
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
