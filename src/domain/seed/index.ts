import type { Game } from "../types";
import { NINTENDO_GAMES } from "./nintendo";
import { OTHER_GAMES } from "./other";
import { PC_GAMES } from "./pc";
import { SONY_GAMES } from "./sony";

export const SEED_GAMES: Game[] = [...PC_GAMES, ...SONY_GAMES, ...NINTENDO_GAMES, ...OTHER_GAMES];

/** Emulators pre-installed in the demo so both "Play" and "Install first" flows are visible. */
export const SEED_INSTALLED_EMULATORS = ["duckstation", "pcsx2", "dolphin", "ppsspp", "retroarch", "mgba"];
