import type { Game } from "../types";
import { rom } from "./build";

const PS1 = "Sony - PlayStation";
const PS2 = "Sony - PlayStation 2";
const PSP = "Sony - PlayStation Portable";
const PS3 = "Sony - PlayStation 3";
const PS4 = "Sony - PlayStation 4";
const VITA = "Sony - PlayStation Vita";

export const SONY_GAMES: Game[] = [
  rom("ps1", PS1, "Final Fantasy VII (USA) (Disc 1).png", "Final Fantasy VII", 1997, "JRPG", { s: "completed", i: true, h: 62, r: 5 }),
  rom("ps1", PS1, "Metal Gear Solid (USA) (Disc 1).png", "Metal Gear Solid", 1998, "Stealth, Ação", { s: "playing", i: true, h: 6, r: 5 }),
  rom("ps1", PS1, "Castlevania - Symphony of the Night (USA).png", "Castlevania: Symphony of the Night", 1997, "Metroidvania", { s: "completed", i: true, h: 14, r: 5 }),
  rom("ps1", PS1, "Crash Bandicoot (USA).png", "Crash Bandicoot", 1996, "Plataforma", { s: "backlog", i: true }),
  rom("ps1", PS1, "Resident Evil 2 (USA) (Disc 1).png", "Resident Evil 2", 1998, "Survival Horror", { s: "backlog", i: true }),
  rom("ps1", PS1, "Silent Hill (USA).png", "Silent Hill", 1999, "Survival Horror", { s: "wishlist" }),
  rom("ps1", PS1, "Chrono Cross (USA) (Disc 1).png", "Chrono Cross", 1999, "JRPG", { s: "backlog", i: true }),
  rom("ps1", PS1, "Tekken 3 (USA).png", "Tekken 3", 1998, "Luta", { s: "completed", i: true, h: 12, r: 4 }),

  rom("ps2", PS2, "God of War (USA).png", "God of War", 2005, "Ação", { s: "completed", i: true, h: 11, r: 5 }),
  rom("ps2", PS2, "Shadow of the Colossus (USA).png", "Shadow of the Colossus", 2005, "Aventura", { s: "completed", h: 9, r: 5 }),
  rom("ps2", PS2, "Metal Gear Solid 3 - Snake Eater (Europe) (En,Fr).png", "Metal Gear Solid 3: Snake Eater", 2004, "Stealth, Ação", { s: "backlog" }),
  rom("ps2", PS2, "Final Fantasy X (USA, Canada).png", "Final Fantasy X", 2001, "JRPG", { s: "playing", i: true, h: 28, r: 5 }),
  rom("ps2", PS2, "Kingdom Hearts (USA).png", "Kingdom Hearts", 2002, "Action RPG", { s: "backlog" }),
  rom("ps2", PS2, "Shin Megami Tensei - Persona 3 (USA).png", "Shin Megami Tensei: Persona 3", 2006, "JRPG", { s: "wishlist" }),
  rom("ps2", PS2, "Resident Evil 4 (USA).png", "Resident Evil 4", 2005, "Survival Horror", { s: "completed", h: 18, r: 5 }),
  rom("ps2", PS2, "Grand Theft Auto - San Andreas (USA) (v1.03).png", "Grand Theft Auto: San Andreas", 2004, "Ação, Mundo aberto", { s: "completed", i: true, h: 40, r: 5 }),
  rom("ps2", PS2, "Silent Hill 2 (USA) (En,Ja) (v1.20).png", "Silent Hill 2", 2001, "Survival Horror", { s: "backlog" }),
  rom("ps2", PS2, "Devil May Cry 3 - Dante's Awakening (USA) (En,Ja) (Special Edition).png", "Devil May Cry 3", 2005, "Hack and slash", { s: "backlog" }),

  rom("psp", PSP, "God of War - Chains of Olympus (USA).png", "God of War: Chains of Olympus", 2008, "Ação", { s: "completed", i: true, h: 8, r: 4 }),
  rom("psp", PSP, "Crisis Core - Final Fantasy VII (Europe).png", "Crisis Core: Final Fantasy VII", 2007, "Action RPG", { s: "backlog", i: true }),
  rom("psp", PSP, "Patapon (USA).png", "Patapon", 2007, "Ritmo, Estratégia", { s: "playing", i: true, h: 5, r: 4 }),
  rom("psp", PSP, "Metal Gear Solid - Peace Walker (USA) (En,Fr,Es) (v1.01).png", "Metal Gear Solid: Peace Walker", 2010, "Stealth, Ação", { s: "backlog" }),
  rom("psp", PSP, "Lumines (USA) (v1.01).png", "Lumines", 2004, "Puzzle", { s: "completed", i: true, h: 20, r: 4 }),
  rom("psp", PSP, "Monster Hunter Freedom Unite (Europe) (En,Fr,De,Es,It) (v1.01).png", "Monster Hunter Freedom Unite", 2008, "Action RPG", { s: "wishlist" }),

  rom("ps3", PS3, "Demon's Souls (USA).png", "Demon's Souls", 2009, "Action RPG", { s: "backlog", provider: "psn" }),
  rom("ps3", PS3, "Grand Theft Auto V (USA).png", "Grand Theft Auto V", 2013, "Ação, Mundo aberto", { s: "completed", h: 70, r: 4, provider: "physical" }),
  rom("ps3", PS3, "Heavy Rain (USA).png", "Heavy Rain", 2010, "Aventura interativa", { s: "completed", h: 12, r: 4, provider: "physical" }),
  rom("ps3", PS3, "Killzone 2 (USA).png", "Killzone 2", 2009, "Shooter", { s: "backlog", provider: "physical" }),
  rom("ps3", PS3, "Catherine (USA).png", "Catherine", 2011, "Puzzle, Aventura", { s: "wishlist", provider: "psn" }),
  rom("ps3", PS3, "Bayonetta (Europe).png", "Bayonetta", 2009, "Hack and slash", { s: "backlog", provider: "psn" }),

  rom("ps4", PS4, "Persona 5 (USA).png", "Persona 5", 2016, "JRPG", { s: "completed", h: 105, r: 5, provider: "psn" }),
  rom("ps4", PS4, "NieR Automata (Japan).png", "NieR: Automata", 2017, "Action RPG", { s: "completed", h: 45, r: 5, provider: "psn" }),
  rom("ps4", PS4, "Nioh (Japan).png", "Nioh", 2017, "Action RPG", { s: "backlog", provider: "psn" }),

  rom("vita", VITA, "Persona 4 Golden (USA).png", "Persona 4 Golden", 2012, "JRPG", { s: "playing", h: 48, r: 5, provider: "psn" }),
  rom("vita", VITA, "Gravity Rush (USA).png", "Gravity Rush", 2012, "Ação, Aventura", { s: "backlog", provider: "psn" }),
];
