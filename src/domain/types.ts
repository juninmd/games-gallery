export type PlayStatus = "backlog" | "playing" | "completed" | "wishlist" | "dropped";
export type PlatformFamily = "pc" | "playstation" | "xbox" | "nintendo" | "sega" | "other";
export type ProviderKind = "pc-store" | "console-service" | "aggregator" | "local";
export type ImportMethod = "oauth" | "api-key" | "local-scan" | "manual";
export type Os = "windows" | "linux" | "macos";

export interface Platform {
  id: string;
  name: string;
  short: string;
  family: PlatformFamily;
  year: number;
  color: string;
}

export interface Provider {
  id: string;
  name: string;
  kind: ProviderKind;
  color: string;
  platforms: string[];
  importMethod: ImportMethod;
  importNote: string;
  /** `{id}` is replaced by Game.storeId; undefined = no URI launcher. */
  launchUri?: string;
  /** Deep link that starts an install in the store's own client. */
  installUri?: string;
  /** Deep link that opens the store's uninstall flow. */
  uninstallUri?: string;
}

export type EmulatorStatus = "active" | "experimental" | "community-fork" | "discontinued";

/** Where to get an emulator, taken from its official site; ids are verified package-manager ids. */
export interface EmulatorInstall {
  /** Official download page (https). */
  downloadUrl: string;
  winget?: string;
  /** `bucket/app`, e.g. `extras/dolphin`. */
  scoop?: string;
  flatpak?: string;
  brew?: { kind: "cask" | "formula"; name: string };
}

export interface Emulator {
  id: string;
  name: string;
  platforms: string[];
  os: Os[];
  status: EmulatorStatus;
  homepage?: string;
  exe: string;
  /** Args with `{rom}` / `{core}` placeholders; kept as an array to avoid shell-string concat. */
  args: string[];
  /** RetroArch-style: platformId -> libretro core name. */
  cores?: Record<string, string>;
  needsBios: boolean;
  notes: string;
  install?: EmulatorInstall;
  /** True only when the executable name and arguments come from the project's own documentation. */
  launchVerified?: boolean;
}

export interface Game {
  id: string;
  title: string;
  platformId: string;
  providerId: string;
  storeId?: string;
  /** Used to look up Steam reviews for the PC release, even when owned elsewhere. */
  steamAppId?: number;
  year: number;
  genres: string[];
  coverUrl?: string;
  status: PlayStatus;
  owned: boolean;
  installed: boolean;
  sizeGb?: number;
  playtimeH: number;
  rating?: number;
  romPath?: string;
  emulatorId?: string;
  notes?: string;
  /** The user said this copy is not the same game as its same-title siblings in other stores. */
  separate?: boolean;
  /** Personal lists ("Coop", "Para a viagem"); shared with the same game in other stores. */
  tags?: string[];
  /** A copy in the "physical" collection lent to someone. `since` is an ISO date. */
  loan?: { to: string; since: string };
}

/** One entry reported by a local launcher scan or by a store API. */
export interface DetectedEntry {
  storeId: string;
  title: string;
  sizeGb?: number;
  installed: boolean;
  installPath?: string;
  playtimeH?: number;
}

/** Result of scanning one provider on this machine. */
export interface ProviderDetection {
  providerId: string;
  source: string;
  available: boolean;
  note?: string;
  games: DetectedEntry[];
}

export interface ProviderState {
  connected: boolean;
  lastSync?: string;
  /** Where the data came from (file, API) — shown in the UI so nothing looks magical. */
  source?: string;
  /** Why a source is unavailable. */
  note?: string;
}
