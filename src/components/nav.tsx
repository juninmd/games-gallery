import { BarChart3, Cpu, FolderSearch, Gamepad2, Gift, HardDriveDownload, Kanban, Library, Settings, Store } from "lucide-react";
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
      { view: "freebies", label: "Jogos grátis", icon: <Gift size={18} />, keywords: "epic ps plus gratis" },
      { view: "providers", label: "Provedores", icon: <Store size={18} />, keywords: "lojas steam gog" },
      { view: "folders", label: "Pastas", icon: <FolderSearch size={18} />, keywords: "varredura roms importar" },
    ],
  },
  {
    title: "Sistema",
    items: [
      { view: "emulators", label: "Emuladores", icon: <Cpu size={18} />, keywords: "retroarch dolphin" },
      { view: "stats", label: "Estatísticas", icon: <BarChart3 size={18} />, keywords: "numeros horas graficos" },
      { view: "settings", label: "Ajustes", icon: <Settings size={18} />, keywords: "backup configuracoes" },
    ],
  },
];
