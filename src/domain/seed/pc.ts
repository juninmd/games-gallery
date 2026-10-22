import type { Game } from "../types";
import { pc } from "./build";

export const PC_GAMES: Game[] = [
  // Steam
  pc("steam", 1091500, "Cyberpunk 2077", 2020, "RPG, Ação", { s: "playing", i: true, h: 64, r: 4, gb: 70 }),
  pc("steam", 1245620, "Elden Ring", 2022, "RPG, Ação", { s: "completed", i: true, h: 120, r: 5, gb: 60 }),
  pc("steam", 1086940, "Baldur's Gate 3", 2023, "RPG", { s: "playing", i: true, h: 85, r: 5, gb: 150 }),
  pc("steam", 1145360, "Hades", 2020, "Roguelike, Ação", { s: "completed", i: true, h: 48, r: 5, gb: 15 }),
  pc("steam", 1145350, "Hades II", 2024, "Roguelike, Ação", { s: "wishlist" }),
  pc("steam", 367520, "Hollow Knight", 2017, "Metroidvania", { s: "completed", h: 38, r: 5, gb: 9 }),
  pc("steam", 504230, "Celeste", 2018, "Plataforma", { s: "completed", h: 14, r: 5, gb: 1 }),
  pc("steam", 413150, "Stardew Valley", 2016, "Simulação", { s: "playing", i: true, h: 210, r: 5, gb: 1 }),
  pc("steam", 620, "Portal 2", 2011, "Puzzle", { s: "completed", h: 9, r: 5, gb: 12 }),
  pc("steam", 632470, "Disco Elysium", 2019, "RPG", { s: "backlog", gb: 25 }),
  pc("steam", 374320, "Dark Souls III", 2016, "RPG, Ação", { s: "backlog", gb: 25 }),
  pc("steam", 814380, "Sekiro: Shadows Die Twice", 2019, "Ação", { s: "backlog", gb: 20 }),
  pc("steam", 105600, "Terraria", 2011, "Sandbox, Aventura", { s: "completed", h: 150, r: 4, gb: 1 }),
  pc("steam", 646570, "Slay the Spire", 2019, "Roguelike, Cartas", { s: "playing", i: true, h: 55, r: 5, gb: 1 }),
  pc("steam", 588650, "Dead Cells", 2018, "Roguelike, Metroidvania", { s: "dropped", h: 6, r: 3, gb: 3 }),
  pc("steam", 2050650, "Resident Evil 4", 2023, "Survival Horror", { s: "backlog", gb: 60 }),
  pc("steam", 2379780, "Balatro", 2024, "Roguelike, Cartas", { s: "playing", i: true, h: 32, r: 5, gb: 1 }),
  pc("steam", 553850, "Helldivers 2", 2024, "Shooter, Co-op", { s: "playing", i: true, h: 40, r: 4, gb: 100 }),
  pc("steam", 1623730, "Palworld", 2024, "Sobrevivência", { s: "backlog", gb: 40 }),
  pc("steam", 753640, "Outer Wilds", 2019, "Aventura, Exploração", { s: "wishlist" }),
  pc("steam", 264710, "Subnautica", 2018, "Sobrevivência", { s: "backlog", gb: 20 }),
  pc("steam", 1687950, "Persona 5 Royal", 2022, "JRPG", { s: "backlog", gb: 40 }),
  pc("steam", 1794680, "Vampire Survivors", 2022, "Roguelike, Ação", { s: "completed", i: true, h: 22, r: 4, gb: 1 }),
  pc("steam", 427520, "Factorio", 2020, "Automação, Estratégia", { s: "playing", i: true, h: 210, r: 5, gb: 2 }),
  // GOG
  pc("gog", 292030, "The Witcher 3: Wild Hunt", 2015, "RPG", { s: "completed", i: true, h: 160, r: 5, gb: 50 }),
  pc("gog", 1245620, "Elden Ring", 2022, "RPG, Ação", { s: "wishlist" }),
  pc("gog", 632470, "Disco Elysium", 2019, "RPG", { s: "backlog", gb: 25 }),
  // Epic
  pc("epic", 870780, "Control", 2019, "Ação, Sobrenatural", { s: "backlog", gb: 42 }),
  pc("epic", 588650, "Dead Cells", 2018, "Roguelike, Metroidvania", { s: "backlog", gb: 3 }),
  // Ubisoft Connect
  pc("ubisoft", 2208920, "Assassin's Creed Valhalla", 2020, "Ação, RPG", { s: "backlog", gb: 160 }),
  pc("ubisoft", 2369390, "Far Cry 6", 2021, "Shooter", { s: "dropped", h: 7, gb: 60 }),
  // EA app
  pc("ea", 1328670, "Mass Effect Legendary Edition", 2021, "RPG, Sci-fi", { s: "playing", i: true, h: 31, r: 5, gb: 120 }),
  pc("ea", 1426210, "It Takes Two", 2021, "Co-op, Aventura", { s: "completed", h: 14, r: 5, gb: 50 }),
  // Battle.net
  pc("battlenet", 2344520, "Diablo IV", 2023, "ARPG", { s: "backlog", gb: 90 }),
  pc("battlenet", 2357570, "Overwatch 2", 2023, "Shooter", { s: "dropped", h: 12, gb: 55 }),
  // Xbox app / Game Pass PC
  pc("xboxpc", 1716740, "Starfield", 2023, "RPG, Sci-fi", { s: "backlog", gb: 125 }),
  pc("xboxpc", 1817230, "Hi-Fi RUSH", 2023, "Ação, Ritmo", { s: "completed", h: 11, r: 5, gb: 30 }),
  pc("xboxpc", 1551360, "Forza Horizon 5", 2021, "Corrida", { s: "playing", i: true, h: 26, r: 4, gb: 110 }),
  // Amazon Games / itch.io / Humble / Rockstar
  pc("amazon", 1063730, "New World", 2021, "MMORPG", { s: "dropped", h: 20, gb: 70 }),
  pc("itch", 1055540, "A Short Hike", 2019, "Aventura, Relaxante", { s: "completed", h: 3, r: 5, gb: 1 }),
  pc("humble", 653530, "Return of the Obra Dinn", 2018, "Mistério, Puzzle", { s: "backlog", gb: 1 }),
  pc("rockstar", 271590, "Grand Theft Auto V", 2013, "Ação, Mundo aberto", { s: "completed", i: true, h: 90, r: 4, gb: 105 }),
  pc("rockstar", 1174180, "Red Dead Redemption 2", 2018, "Ação, Mundo aberto", { s: "backlog", gb: 120 }),
];
