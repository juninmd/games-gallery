/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Rating APIs send no CORS headers; in browser dev they go through these proxies.
// Under Tauri the HTTP plugin is used instead (scope in src-tauri/capabilities).
const proxy = (target: string, prefix: string) => ({
  target,
  changeOrigin: true,
  rewrite: (path: string) => path.slice(prefix.length),
});

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    proxy: {
      "/proxy/steam": proxy("https://store.steampowered.com", "/proxy/steam"),
      "/proxy/rawg": proxy("https://api.rawg.io", "/proxy/rawg"),
    },
  },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
