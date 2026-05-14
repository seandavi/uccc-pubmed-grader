/// <reference types="vitest/config" />
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function gitSha(): string {
  // Prefer Netlify-provided env, then user-set, then local git, then "dev".
  const envSha = process.env.COMMIT_REF || process.env.VITE_GIT_SHA;
  if (envSha) return envSha.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

function appVersion(): string {
  const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf-8"));
  return pkg.version ?? "0.0.0";
}

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
    __GIT_SHA__: JSON.stringify(gitSha()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    proxy: {},
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
  },
});
