import js from "@eslint/js";
import json from "@eslint/json";
import globals from "globals";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import tseslint from "typescript-eslint";

const obsidianRecommended = obsidianmd.configs.recommendedWithLocalesEn
  .filter(config => !config.language && (!config.files || config.files.includes("**/*.{ts,cts,mts,tsx}")))
  .map(config => ({ ...config, files: ["src/**/*.ts"] }));

const typeCheckedTests = tseslint.configs.recommendedTypeChecked.map(config => ({
  ...config,
  files: ["tests/**/*.ts"],
}));

export default defineConfig([
  { ignores: ["dist/**", ".local-qa/**", "node_modules/**"] },
  ...obsidianRecommended,
  {
    files: ["src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-return": "error",
    },
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
  },
  {
    ...js.configs.recommended,
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      globals: globals.node,
    },
  },
  ...typeCheckedTests,
  {
    files: ["tests/**/*.ts"],
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true },
    },
  },
  {
    files: ["manifest.json", "package.json"],
    language: "json/json",
    plugins: { json, obsidianmd },
    rules: { "no-irregular-whitespace": "off" },
  },
  {
    files: ["manifest.json"],
    language: "json/json",
    plugins: { json, obsidianmd },
    rules: { "obsidianmd/validate-manifest": "error" },
  },
]);
