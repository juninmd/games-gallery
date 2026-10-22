import type { Provider } from "./types";

const PC = ["pc"];

export const PROVIDERS: Provider[] = [
  { id: "steam", name: "Steam", kind: "pc-store", color: "#1b9bd8", platforms: PC, importMethod: "api-key", importNote: "Steam Web API (chave + SteamID) e appmanifest_*.acf locais", launchUri: "steam://rungameid/{id}" },
  { id: "gog", name: "GOG", kind: "pc-store", color: "#a64dff", platforms: PC, importMethod: "oauth", importNote: "OAuth do GOG Galaxy + galaxy-2.0.db local", launchUri: "goggalaxy://openGameView/{id}" },
  { id: "epic", name: "Epic Games Store", kind: "pc-store", color: "#9aa0a6", platforms: PC, importMethod: "local-scan", importNote: "Manifests em ProgramData/Epic (ou Legendary/Heroic)", launchUri: "com.epicgames.launcher://apps/{id}?action=launch&silent=true" },
  { id: "ubisoft", name: "Ubisoft Connect", kind: "pc-store", color: "#2f7bff", platforms: PC, importMethod: "local-scan", importNote: "Registro do Windows + cache do launcher", launchUri: "uplay://launch/{id}/0" },
  { id: "ea", name: "EA app", kind: "pc-store", color: "#ff4747", platforms: PC, importMethod: "local-scan", importNote: "InstallData XML + chaves de registro" },
  { id: "battlenet", name: "Battle.net", kind: "pc-store", color: "#00aeff", platforms: PC, importMethod: "local-scan", importNote: "Product DB local do Battle.net Agent", launchUri: "battlenet://{id}" },
  { id: "xboxpc", name: "Xbox app / Game Pass PC", kind: "pc-store", color: "#52b043", platforms: PC, importMethod: "oauth", importNote: "Conta Microsoft (Xbox Live) + pacotes UWP/GamePass" },
  { id: "amazon", name: "Amazon Games", kind: "pc-store", color: "#ff9900", platforms: PC, importMethod: "local-scan", importNote: "Banco SQLite local do Amazon Games (via Nile/Heroic)" },
  { id: "itch", name: "itch.io", kind: "pc-store", color: "#fa5c5c", platforms: PC, importMethod: "api-key", importNote: "API key do itch.io + butler/butlerd", launchUri: "itch://games/{id}" },
  { id: "humble", name: "Humble Bundle", kind: "pc-store", color: "#cb272a", platforms: PC, importMethod: "oauth", importNote: "Biblioteca de chaves (resgate Steam/GOG) e downloads DRM-free" },
  { id: "rockstar", name: "Rockstar Games Launcher", kind: "pc-store", color: "#fcaf17", platforms: PC, importMethod: "local-scan", importNote: "Registro do Windows" },
  { id: "playnite", name: "Playnite (import)", kind: "aggregator", color: "#14c8a8", platforms: PC, importMethod: "local-scan", importNote: "Importa a biblioteca do Playnite (agrega +30 lojas)" },
  { id: "heroic", name: "Heroic / Lutris", kind: "aggregator", color: "#6f6cff", platforms: PC, importMethod: "local-scan", importNote: "Config do Heroic (Epic/GOG/Amazon) e DB do Lutris no Linux" },
  { id: "psn", name: "PlayStation Network", kind: "console-service", color: "#2b6fdc", platforms: ["ps3", "ps4", "ps5", "psp", "vita"], importMethod: "oauth", importNote: "Login PSN → lista de jogos/troféus (sem API pública oficial)" },
  { id: "xbl", name: "Xbox Live / Game Pass", kind: "console-service", color: "#2f9e44", platforms: ["x360", "xone", "xsx"], importMethod: "oauth", importNote: "Conta Microsoft (XSTS) → títulos jogados e achievements" },
  { id: "nintendo", name: "Nintendo eShop / Switch Online", kind: "console-service", color: "#e60012", platforms: ["switch", "wiiu", "3ds"], importMethod: "manual", importNote: "Sem API pública; cadastro manual ou base de títulos da comunidade" },
  { id: "physical", name: "Coleção física", kind: "local", color: "#d1a05a", platforms: [], importMethod: "manual", importNote: "Discos e cartuchos cadastrados à mão (scan de código de barras: fase 2)" },
  { id: "roms", name: "Biblioteca de ROMs/ISOs", kind: "local", color: "#9b7bd6", platforms: [], importMethod: "local-scan", importNote: "Varre a pasta de ROMs, identifica por hash (No-Intro/Redump) e busca capas" },
];

export const PROVIDER_BY_ID: Record<string, Provider> = Object.fromEntries(
  PROVIDERS.map((x) => [x.id, x]),
);
