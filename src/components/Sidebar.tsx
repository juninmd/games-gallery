import { BarChart3, CircleCheck, Cpu, FolderSearch, Gamepad2, Gift, HardDriveDownload, Kanban, Library, Plus, Settings, Store } from "lucide-react";
import type { ReactNode } from "react";
import { useLibrary } from "../state/library";
import { useUi, type View } from "../state/ui";

const NAV: { view: View; label: string; icon: ReactNode }[] = [
  { view: "library", label: "Biblioteca", icon: <Library size={18} /> },
  { view: "installed", label: "Instalados", icon: <HardDriveDownload size={18} /> },
  { view: "board", label: "Quero jogar", icon: <Kanban size={18} /> },
  { view: "platforms", label: "Plataformas", icon: <Gamepad2 size={18} /> },
  { view: "freebies", label: "Jogos grátis", icon: <Gift size={18} /> },
  { view: "providers", label: "Provedores", icon: <Store size={18} /> },
  { view: "folders", label: "Pastas", icon: <FolderSearch size={18} /> },
  { view: "emulators", label: "Emuladores", icon: <Cpu size={18} /> },
  { view: "stats", label: "Estatísticas", icon: <BarChart3 size={18} /> },
  { view: "settings", label: "Ajustes", icon: <Settings size={18} /> },
];

export function Sidebar() {
  const view = useUi((s) => s.view);
  const go = useUi((s) => s.go);
  const setAddOpen = useUi((s) => s.setAddOpen);
  const games = useLibrary((s) => s.games);
  const counts: Partial<Record<View, number>> = {
    library: games.length,
    installed: games.filter((g) => g.installed).length,
    board: games.filter((g) => g.status === "backlog" || g.status === "wishlist").length,
  };

  return (
    <nav className="sidebar" aria-label="Navegação principal">
      <div className="brand"><CircleCheck size={20} aria-hidden /> Games Gallery</div>
      <button className="btn primary block" aria-label="Adicionar jogo" title="Adicionar jogo" onClick={() => setAddOpen(true)}>
        <Plus size={16} aria-hidden /> <span className="sidebar-add-label">Adicionar jogo</span>
      </button>
      <ul>
        {NAV.map((n) => (
          <li key={n.view}>
            <button className={`nav ${view === n.view ? "active" : ""}`} aria-label={n.label} title={n.label} aria-current={view === n.view ? "page" : undefined} onClick={() => go(n.view)}>
              {n.icon}
              <span>{n.label}</span>
              {counts[n.view] !== undefined && <small>{counts[n.view]}</small>}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
