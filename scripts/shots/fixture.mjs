// Fake library for README screenshots: no real account data, no network (covers are generated).
const TITLES = [
  ["Hollow Depths", "pc", "steam", "playing", 42.5], ["Neon Drift", "pc", "epic", "backlog", 3], ["Skyforge", "pc", "gog", "completed", 61],
  ["Pixel Quest", "snes", "roms", "completed", 18], ["Shadow Courier", "ps2", "roms", "playing", 12.5], ["Star Harbor", "pc", "steam", "backlog", 0],
  ["Ember Knights", "pc", "steam", "dropped", 4], ["Tidal Runner", "gba", "roms", "backlog", 0], ["Moonlit Archive", "pc", "gog", "playing", 7],
  ["Circuit Kart", "switch", "roms", "completed", 25], ["Frost Bastion", "pc", "epic", "backlog", 1], ["Lantern Woods", "pc", "steam", "wishlist", 0],
];
const DAY = 86_400_000;

export function fixture(now = Date.now()) {
  const games = TITLES.map(([title, platformId, providerId, status, playtimeH], i) => ({
    id: `shot-${i}`, title, platformId, providerId, status, playtimeH, year: 2015 + (i % 10), genres: ["Ação"],
    owned: status !== "wishlist", installed: i % 3 !== 2, ...(i === 0 ? { tags: ["Coop"] } : {}),
  }));
  // A few weeks of sessions so the cards' mini charts have something to draw.
  const sessions = [];
  for (let d = 0; d < 14; d++) {
    for (const [i, every] of [[0, 1], [4, 2], [8, 3]]) {
      if (d % every === 0) sessions.push({ gameId: `shot-${i}`, start: new Date(now - d * DAY - 3_600_000).toISOString(), minutes: 30 + ((d * 37 + i * 11) % 120), kind: "exec" });
    }
  }
  return {
    "games-gallery:v1": JSON.stringify({ state: { games, scans: [], providers: {}, emulators: [], emulatorPaths: {}, settings: {} }, version: 4 }),
    "games-gallery:sessions:v1": JSON.stringify({ state: { sessions }, version: 1 }),
    "games-gallery:density": "comfortable",
  };
}
