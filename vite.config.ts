/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import pkg from "./package.json";

// Rating APIs send no CORS headers; in browser dev they go through these proxies.
// Under Tauri the HTTP plugin is used instead (scope in src-tauri/capabilities).
// Vite matches proxy keys with startsWith: no prefix may be a prefix of another.
const proxy = (target: string, prefix: string) => ({
  target,
  changeOrigin: true,
  rewrite: (path: string) => path.slice(prefix.length),
});

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    proxy: {
      "/proxy/steamstore": proxy("https://store.steampowered.com", "/proxy/steamstore"),
      "/proxy/steamapi": proxy("https://api.steampowered.com", "/proxy/steamapi"),
      "/proxy/rawg": proxy("https://api.rawg.io", "/proxy/rawg"),
      "/proxy/epic": proxy("https://store-site-backend-static.ak.epicgames.com", "/proxy/epic"),
      "/proxy/psblog": proxy("https://blog.playstation.com", "/proxy/psblog"),
      "/proxy/gogcatalog": proxy("https://catalog.gog.com", "/proxy/gogcatalog"),
      "/proxy/github": proxy("https://api.github.com", "/proxy/github"),
    },
  },
  test: { environment: "node", include: ["src/**/*.test.ts"], testTimeout: 20_000 },
});
