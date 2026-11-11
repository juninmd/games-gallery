import { BarChart3, Blocks, Cpu, FolderSearch, Gamepad2, Gift, HardDriveDownload, Plug, Tags, Kanban, Library, Settings, Store } from "lucide-react";
import type { ReactNode } from "react";
import type { View } from "../state/ui";

export interface NavItem { view: View; label: string; icon: ReactNode; keywords?: string }

export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Coleção",
    items: [
      { view: "library", label: "Biblioteca", icon: <Library size={18} />, keywords: "jogos catalogo todos" },
      { view: "installed", label: "Instalados", icon: <HardDriveDownload size={18} />, keywords: "disco instalado" },
      { view: "board", label: "Quero jogar", icon: <Kanban size={18} />, keywords: "backlog kanban wishlist" },
      { view: "platforms", label: "Plataformas", icon: <Gamepad2 size={18} />, keywords: "consoles pc playstation xbox nintendo" },
    ],
  },
  {
    title: "Descobrir",
    items: [
      { view: "deals", label: "Promoções", icon: <Tags size={18} />, keywords: "desconto oferta wishlist steam gog epic" },
      { view: "freebies", label: "Jogos grátis", icon: <Gift size={18} />, keywords: "epic ps plus gratis" },
      { view: "providers", label: "Provedores", icon: <Store size={18} />, keywords: "lojas steam gog" },
      { view: "folders", label: "Pastas", icon: <FolderSearch size={18} />, keywords: "varredura roms importar" },
    ],
  },
  {
    title: "Sistema",
    items: [
      { view: "connections", label: "Conexões", icon: <Plug size={18} />, keywords: "steam web api chave login epic reviews rawg providers" },
      { view: "emulators", label: "Emuladores", icon: <Cpu size={18} />, keywords: "retroarch dolphin" },
      { view: "stats", label: "Estatísticas", icon: <BarChart3 size={18} />, keywords: "numeros horas graficos" },
      { view: "settings", label: "Ajustes", icon: <Settings size={18} />, keywords: "backup configuracoes" },
    ],
  },
];

/** System screens grouped behind one dock item, switched with tabs. */
export const CENTRAL_VIEWS: View[] = ["connections", "providers", "folders", "emulators", "settings"];
export const isCentral = (view: View) => CENTRAL_VIEWS.includes(view);

export interface DockItem { view: View; label: string; icon: ReactNode }
/** The floating dock: collection and discovery screens, then stats and the system Central. */
export const DOCK_GROUPS: DockItem[][] = [
  NAV_GROUPS[0]!.items,
  NAV_GROUPS[1]!.items.filter((n) => n.view === "deals" || n.view === "freebies"),
  [
    NAV_GROUPS[2]!.items.find((n) => n.view === "stats")!,
    { view: "connections", label: "Central", icon: <Blocks size={18} /> },
  ],
];
export const DOCK_ITEMS: DockItem[] = DOCK_GROUPS.flat();
