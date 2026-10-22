import type { Game } from "../types";
import { rom } from "./build";

const NES = "Nintendo - Nintendo Entertainment System";
const SNES = "Nintendo - Super Nintendo Entertainment System";
const N64 = "Nintendo - Nintendo 64";
const GC = "Nintendo - GameCube";
const WII = "Nintendo - Wii";
const WIIU = "Nintendo - Wii U";
const GB = "Nintendo - Game Boy";
const GBA = "Nintendo - Game Boy Advance";
const NDS = "Nintendo - Nintendo DS";
const N3DS = "Nintendo - Nintendo 3DS";

export const NINTENDO_GAMES: Game[] = [
  rom("nes", NES, "Super Mario Bros. (World).png", "Super Mario Bros.", 1985, "Plataforma", { s: "completed", i: true, h: 3, r: 5 }),
  rom("nes", NES, "Legend of Zelda, The (USA) (Collector's Edition).png", "The Legend of Zelda", 1986, "Aventura", { s: "backlog", i: true }),
  rom("nes", NES, "Mega Man 2 (USA) (Virtual Console).png", "Mega Man 2", 1988, "Plataforma, Ação", { s: "playing", i: true, h: 4, r: 4 }),
  rom("nes", NES, "Castlevania (USA).png", "Castlevania", 1986, "Ação, Plataforma", { s: "backlog" }),
  rom("nes", NES, "Contra (USA).png", "Contra", 1988, "Run and gun", { s: "completed", i: true, h: 2, r: 4 }),

  rom("snes", SNES, "Super Metroid (Japan, USA) (En,Ja).png", "Super Metroid", 1994, "Metroidvania", { s: "completed", i: true, h: 9, r: 5 }),
  rom("snes", SNES, "Legend of Zelda, The - A Link to the Past (USA).png", "The Legend of Zelda: A Link to the Past", 1991, "Aventura", { s: "completed", i: true, h: 15, r: 5 }),
  rom("snes", SNES, "Super Mario World (USA).png", "Super Mario World", 1990, "Plataforma", { s: "completed", i: true, h: 10, r: 5 }),
  rom("snes", SNES, "Chrono Trigger (USA).png", "Chrono Trigger", 1995, "JRPG", { s: "playing", i: true, h: 18, r: 5 }),
  rom("snes", SNES, "Final Fantasy III (USA).png", "Final Fantasy III (VI)", 1994, "JRPG", { s: "backlog", i: true }),
  rom("snes", SNES, "EarthBound (USA).png", "EarthBound", 1994, "JRPG", { s: "wishlist" }),
  rom("snes", SNES, "Donkey Kong Country (USA).png", "Donkey Kong Country", 1994, "Plataforma", { s: "backlog", i: true }),

  rom("n64", N64, "Super Mario 64 (USA).png", "Super Mario 64", 1996, "Plataforma 3D", { s: "completed", i: true, h: 14, r: 5 }),
  rom("n64", N64, "Legend of Zelda, The - Ocarina of Time (USA) (GameCube).png", "The Legend of Zelda: Ocarina of Time", 1998, "Aventura", { s: "completed", i: true, h: 25, r: 5 }),
  rom("n64", N64, "Legend of Zelda, The - Majora's Mask (USA) (GameCube).png", "The Legend of Zelda: Majora's Mask", 2000, "Aventura", { s: "backlog", i: true }),
  rom("n64", N64, "GoldenEye 007 (USA).png", "GoldenEye 007", 1997, "FPS", { s: "completed", h: 12, r: 4 }),
  rom("n64", N64, "Banjo-Kazooie (USA).png", "Banjo-Kazooie", 1998, "Plataforma 3D", { s: "backlog", i: true }),
  rom("n64", N64, "Mario Kart 64 (USA).png", "Mario Kart 64", 1996, "Corrida", { s: "playing", i: true, h: 22, r: 5 }),
  rom("n64", N64, "Paper Mario (USA).png", "Paper Mario", 2000, "RPG", { s: "backlog" }),

  rom("gc", GC, "Legend of Zelda, The - The Wind Waker (USA).png", "The Legend of Zelda: The Wind Waker", 2002, "Aventura", { s: "completed", i: true, h: 30, r: 5 }),
  rom("gc", GC, "Metroid Prime (USA).png", "Metroid Prime", 2002, "FPS, Aventura", { s: "backlog", i: true }),
  rom("gc", GC, "Super Smash Bros. Melee (USA) (En,Ja).png", "Super Smash Bros. Melee", 2001, "Luta", { s: "playing", i: true, h: 80, r: 5 }),
  rom("gc", GC, "Luigi's Mansion (USA).png", "Luigi's Mansion", 2001, "Aventura", { s: "backlog" }),
  rom("gc", GC, "Super Mario Sunshine (USA).png", "Super Mario Sunshine", 2002, "Plataforma 3D", { s: "backlog", i: true }),
  rom("gc", GC, "Paper Mario - The Thousand-Year Door (USA).png", "Paper Mario: The Thousand-Year Door", 2004, "RPG", { s: "wishlist" }),

  rom("wii", WII, "Super Mario Galaxy (USA) (En,Fr,Es).png", "Super Mario Galaxy", 2007, "Plataforma 3D", { s: "completed", i: true, h: 20, r: 5 }),
  rom("wii", WII, "Xenoblade Chronicles (USA).png", "Xenoblade Chronicles", 2010, "JRPG", { s: "backlog" }),
  rom("wii", WII, "Legend of Zelda, The - Twilight Princess (USA).png", "The Legend of Zelda: Twilight Princess", 2006, "Aventura", { s: "playing", i: true, h: 15, r: 4 }),
  rom("wii", WII, "Mario Kart Wii (USA) (En,Fr,Es).png", "Mario Kart Wii", 2008, "Corrida", { s: "completed", i: true, h: 40, r: 4 }),
  rom("wii", WII, "Super Smash Bros. Brawl (USA).png", "Super Smash Bros. Brawl", 2008, "Luta", { s: "backlog", i: true }),

  rom("wiiu", WIIU, "Super Mario 3D World (USA) (En,Fr,Es).png", "Super Mario 3D World", 2013, "Plataforma 3D", { s: "backlog", provider: "physical" }),
  rom("wiiu", WIIU, "Mario Kart 8 (Europe) (En,Fr,De,Es,It,Nl,Pt,Ru).png", "Mario Kart 8", 2014, "Corrida", { s: "completed", h: 30, r: 5, provider: "nintendo" }),
  rom("wiiu", WIIU, "Xenoblade Chronicles X (Europe) (En,Fr,De,Es,It).png", "Xenoblade Chronicles X", 2015, "JRPG", { s: "backlog", provider: "nintendo" }),
  rom("wiiu", WIIU, "Bayonetta 2 (Europe) (En,Ja,Fr,De,Es,It).png", "Bayonetta 2", 2014, "Hack and slash", { s: "wishlist", provider: "nintendo" }),

  rom("gb", GB, "Tetris (World) (Rev 1).png", "Tetris", 1989, "Puzzle", { s: "completed", i: true, h: 8, r: 5 }),
  rom("gb", GB, "Pokemon - Red Version (USA, Europe) (SGB Enhanced).png", "Pokémon Red", 1996, "RPG", { s: "backlog", i: true }),
  rom("gb", GB, "Legend of Zelda, The - Link's Awakening (USA, Europe).png", "The Legend of Zelda: Link's Awakening", 1993, "Aventura", { s: "completed", i: true, h: 12, r: 5 }),

  rom("gba", GBA, "Metroid Fusion (USA) (Virtual Console).png", "Metroid Fusion", 2002, "Metroidvania", { s: "completed", i: true, h: 7, r: 5 }),
  rom("gba", GBA, "Pokemon - Emerald Version (USA, Europe) (Alternate).png", "Pokémon Emerald", 2004, "RPG", { s: "playing", i: true, h: 70, r: 5 }),
  rom("gba", GBA, "Advance Wars (USA) (Virtual Console).png", "Advance Wars", 2001, "Estratégia", { s: "backlog", i: true }),
  rom("gba", GBA, "Golden Sun (USA, Europe).png", "Golden Sun", 2001, "JRPG", { s: "wishlist" }),
  rom("gba", GBA, "Legend of Zelda, The - The Minish Cap (USA).png", "The Legend of Zelda: The Minish Cap", 2004, "Aventura", { s: "backlog", i: true }),

  rom("nds", NDS, "Pokemon - Black Version (USA, Europe) (NDSi Enhanced).png", "Pokémon Black", 2010, "RPG", { s: "backlog" }),
  rom("nds", NDS, "Mario Kart DS (USA) (En,Fr,De,Es,It).png", "Mario Kart DS", 2005, "Corrida", { s: "completed", h: 25, r: 4 }),
  rom("nds", NDS, "New Super Mario Bros. (USA).png", "New Super Mario Bros.", 2006, "Plataforma", { s: "completed", h: 9, r: 4 }),
  rom("nds", NDS, "Castlevania - Dawn of Sorrow (USA).png", "Castlevania: Dawn of Sorrow", 2005, "Metroidvania", { s: "backlog" }),
  rom("nds", NDS, "Professor Layton and the Curious Village (USA).png", "Professor Layton and the Curious Village", 2007, "Puzzle", { s: "wishlist" }),
  rom("nds", NDS, "Legend of Zelda, The - Phantom Hourglass (USA) (DPAD).png", "The Legend of Zelda: Phantom Hourglass", 2007, "Aventura", { s: "backlog" }),

  rom("3ds", N3DS, "Legend of Zelda, The - A Link Between Worlds (Europe) (En,Fr,De,Es,It).png", "The Legend of Zelda: A Link Between Worlds", 2013, "Aventura", { s: "completed", h: 18, r: 5, provider: "physical" }),
  rom("3ds", N3DS, "Fire Emblem - Awakening (Europe) (En,Fr,De,Es,It).png", "Fire Emblem: Awakening", 2012, "Estratégia, RPG", { s: "backlog", provider: "physical" }),
  rom("3ds", N3DS, "Pokemon X (Europe) (En,Ja,Fr,De,Es,It,Ko).png", "Pokémon X", 2013, "RPG", { s: "backlog", provider: "nintendo" }),
  rom("3ds", N3DS, "Super Mario 3D Land (Europe) (En,Fr,De,Es,It,Nl,Pt,Ru).png", "Super Mario 3D Land", 2011, "Plataforma 3D", { s: "wishlist", provider: "nintendo" }),
];
