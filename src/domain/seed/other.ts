import type { Game } from "../types";
import { game, rom, steamCover } from "./build";

const GEN = "Sega - Mega Drive - Genesis";
const DC = "Sega - Dreamcast";
const SAT = "Sega - Saturn";
const XBOX = "Microsoft - Xbox";
const X360 = "Microsoft - Xbox 360";

// Same key art as the Steam page where the title is multiplatform; exclusives
// have no cover on purpose so the generated fallback is exercised.
const art = (appId: number) => ({ cover: steamCover(appId), steamAppId: appId });

export const OTHER_GAMES: Game[] = [
  rom("genesis", GEN, "Sonic The Hedgehog (USA).png", "Sonic the Hedgehog", 1991, "Plataforma", { s: "completed", i: true, h: 4, r: 4 }),
  rom("genesis", GEN, "Streets of Rage 2 (Europe).png", "Streets of Rage 2", 1992, "Beat 'em up", { s: "completed", i: true, h: 3, r: 5 }),
  rom("genesis", GEN, "Phantasy Star IV (Europe).png", "Phantasy Star IV", 1993, "JRPG", { s: "backlog", i: true }),
  rom("genesis", GEN, "Gunstar Heroes (Europe).png", "Gunstar Heroes", 1993, "Run and gun", { s: "backlog" }),
  rom("genesis", GEN, "Shinobi III - Return of the Ninja Master (Europe).png", "Shinobi III", 1993, "Ação", { s: "wishlist" }),

  rom("dc", DC, "Shenmue (USA) (Disc 1).png", "Shenmue", 1999, "Aventura", { s: "backlog" }),
  rom("dc", DC, "Crazy Taxi (USA).png", "Crazy Taxi", 1999, "Corrida, Arcade", { s: "completed", h: 6, r: 4 }),
  rom("dc", DC, "Soulcalibur (USA).png", "Soulcalibur", 1999, "Luta", { s: "backlog" }),
  rom("dc", DC, "Sonic Adventure (USA).png", "Sonic Adventure", 1998, "Plataforma 3D", { s: "wishlist" }),

  rom("saturn", SAT, "Panzer Dragoon Saga (Disc 1) (USA).png", "Panzer Dragoon Saga", 1998, "JRPG", { s: "wishlist" }),
  rom("saturn", SAT, "Virtua Fighter 2 (Europe) (Made in EU).png", "Virtua Fighter 2", 1995, "Luta", { s: "backlog" }),

  rom("xbox", XBOX, "Halo - Combat Evolved (USA) (v1.02).png", "Halo: Combat Evolved", 2001, "FPS", { s: "completed", h: 10, r: 5, provider: "physical" }),
  rom("xbox", XBOX, "Fable (USA).png", "Fable", 2004, "Action RPG", { s: "backlog", provider: "physical" }),
  rom("xbox", XBOX, "Jet Set Radio Future (USA).png", "Jet Set Radio Future", 2002, "Ação, Esporte", { s: "backlog", provider: "physical" }),
  rom("xbox", XBOX, "Star Wars - Knights of the Old Republic (USA).png", "Star Wars: Knights of the Old Republic", 2003, "RPG", { s: "wishlist", provider: "physical" }),

  rom("x360", X360, "Bayonetta (USA).png", "Bayonetta", 2009, "Hack and slash", { s: "completed", h: 12, r: 4, provider: "xbl" }),
  rom("x360", X360, "Dead Rising (USA).png", "Dead Rising", 2006, "Ação, Sobrevivência", { s: "backlog", provider: "xbl" }),
  rom("x360", X360, "Portal 2 (USA).png", "Portal 2", 2011, "Puzzle", { s: "completed", h: 9, r: 5, provider: "physical" }),
  rom("x360", X360, "Final Fantasy XIII (USA).png", "Final Fantasy XIII", 2010, "JRPG", { s: "dropped", h: 8, provider: "physical" }),

  game("xone", "xbl", "Sea of Thieves", 2018, "Aventura, Co-op", { s: "playing", h: 35, r: 4, ...art(1172620) }),
  game("xone", "xbl", "Gears 5", 2019, "Shooter", { s: "backlog", ...art(1097840) }),
  game("xsx", "xbl", "Halo Infinite", 2021, "FPS", { s: "backlog", ...art(1240440) }),
  game("xsx", "xbl", "Forza Horizon 5", 2021, "Corrida", { s: "completed", h: 60, r: 5, ...art(1551360) }),

  game("ps5", "psn", "God of War Ragnarök", 2022, "Ação, Aventura", { s: "completed", h: 38, r: 5, ...art(2322010) }),
  game("ps5", "psn", "Elden Ring", 2022, "RPG, Ação", { s: "backlog", ...art(1245620) }),
  game("ps5", "psn", "Returnal", 2021, "Roguelike, Shooter", { s: "backlog", ...art(1649240) }),
  game("ps5", "psn", "Astro Bot", 2024, "Plataforma 3D", { s: "playing", h: 9, r: 5 }),
  game("ps5", "psn", "Marvel's Spider-Man 2", 2023, "Ação, Mundo aberto", { s: "wishlist" }),

  game("switch", "nintendo", "Hollow Knight", 2017, "Metroidvania", { s: "backlog", ...art(367520) }),
  game("switch", "nintendo", "Hades", 2020, "Roguelike, Ação", { s: "completed", h: 40, r: 5, ...art(1145360) }),
  game("switch", "nintendo", "Celeste", 2018, "Plataforma", { s: "backlog", ...art(504230) }),
  game("switch", "nintendo", "The Legend of Zelda: Tears of the Kingdom", 2023, "Aventura", { s: "playing", h: 110, r: 5 }),
  game("switch", "nintendo", "Super Mario Odyssey", 2017, "Plataforma 3D", { s: "completed", h: 28, r: 5 }),
  game("switch", "nintendo", "Metroid Dread", 2021, "Metroidvania", { s: "wishlist" }),
];
