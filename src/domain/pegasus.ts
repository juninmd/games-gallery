import { renderArgs, resolveEmulator, type LaunchContext } from "./launch";
import { PLATFORM_BY_ID } from "./platforms";
import type { Game } from "./types";

// eslint-disable-next-line no-control-regex -- strip control chars on purpose
const CONTROL = /[\u0000-\u001f\u007f]/;
/** One-line value: Pegasus treats an indented next line as a continuation and `key:` lines as new fields. */
const line = (s: string) => s.replace(new RegExp(CONTROL.source, "g"), " ").replace(/\s+/g, " ").trim();
const quote = (s: string) => `"${s}"`;

/**
 * Pegasus Frontend `metadata.pegasus.txt`: one collection per platform with its launch command
 * (`{file.path}` is Pegasus' own placeholder) and one `game:` per ROM, using absolute paths.
 */
export function buildPegasusMetadata(games: Game[], ctx: LaunchContext): { text: string; count: number } {
  const byPlatform = new Map<string, Game[]>();
  for (const g of games) {
    const rom = g.romPath?.trim();
    if (g.platformId === "pc" || !g.owned || !rom || CONTROL.test(rom) || rom.includes('"')) continue;
    byPlatform.set(g.platformId, [...(byPlatform.get(g.platformId) ?? []), g]);
  }
  const blocks: string[] = [];
  let count = 0;
  for (const [platformId, list] of [...byPlatform].sort(([a], [b]) => a.localeCompare(b))) {
    const header = [`collection: ${line(PLATFORM_BY_ID[platformId]?.name ?? platformId)}`, `shortname: ${platformId}`];
    // Emulator from the first game of the platform: Pegasus has one launch line per collection.
    const emulator = resolveEmulator(list[0]!);
    if (emulator && ctx.installed[emulator.id]) {
      const exe = ctx.exePaths?.[emulator.id] ?? emulator.exe;
      header.push(`launch: ${[quote(exe), ...renderArgs(emulator, platformId, "{file.path}").map((a) => (/\s|\{file\.path\}/.test(a) ? quote(a) : a))].join(" ")}`);
    }
    const games = [...list].sort((a, b) => a.title.localeCompare(b.title)).map((g) => {
      const out = [`game: ${line(g.title)}`, `file: ${g.romPath!.trim()}`];
      if (g.year > 0) out.push(`release: ${g.year}`);
      if (g.genres.length) out.push(`genre: ${line(g.genres.join(", "))}`);
      if (g.rating) out.push(`rating: ${Math.round((g.rating / 5) * 100)}%`);
      return out.join("\n");
    });
    count += games.length;
    blocks.push([header.join("\n"), ...games].join("\n\n"));
  }
  return { text: blocks.length ? `${blocks.join("\n\n\n")}\n` : "", count };
}
