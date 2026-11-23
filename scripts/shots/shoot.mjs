// README screenshots: dark/light themes at 760px (bottom tabs) and 1280px (side rail).
// Usage: pnpm shots   (builds, serves dist with `vite preview` and writes docs/screenshots/*.png)
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { preview } from "vite";
import { fixture } from "./fixture.mjs";

const OUT = "docs/screenshots";
const WIDTHS = [760, 1280];
const THEMES = ["dark", "light"];
// Use the preinstalled browser when Playwright's own download is absent (CI containers, sandboxes).
const executablePath = process.env.PW_CHROMIUM ?? (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);

const server = await preview({ preview: { port: 4179, strictPort: true }, logLevel: "error" });
const url = server.resolvedUrls?.local[0] ?? "http://localhost:4179/";
const browser = await chromium.launch(executablePath ? { executablePath } : {});
try {
  await mkdir(OUT, { recursive: true });
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      const context = await browser.newContext({ viewport: { width, height: 860 }, deviceScaleFactor: 1, reducedMotion: "reduce", colorScheme: theme });
      await context.addInitScript((items) => {
        for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v);
        sessionStorage.setItem("games-gallery:intro-seen", "1");
      }, { ...fixture(), "games-gallery:theme": theme });
      const page = await context.newPage();
      await page.goto(url);
      await page.locator(".game-card").first().waitFor();
      await page.evaluate(async () => {
        await document.fonts.ready;
        // Skip past the hero so the cards (accent color and play chart) are in frame.
        const main = document.querySelector(".main");
        const bar = document.querySelector(".library-bar");
        if (main && bar) main.scrollTop = bar.getBoundingClientRect().top + main.scrollTop - 120;
      });
      const file = `${OUT}/library-${theme}-${width}.png`;
      await page.screenshot({ path: file });
      console.log(file);
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}
