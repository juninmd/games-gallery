import { defineConfig } from "vitest/config";

// Live smoke suite: real network calls through the app's own parsers. Not part of `pnpm test`.
export default defineConfig({
  test: { environment: "node", include: ["src/smoke/**/*.live.ts"], testTimeout: 40_000, retry: 1 },
});
