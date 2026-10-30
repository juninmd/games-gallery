import { BarChart3, Cpu, FolderSearch, Gamepad2, Gift, HardDriveDownload, Kanban, Library, Plus, Settings, Store } from "lucide-react";
import { m } from "motion/react";
import { useMemo, type ReactNode } from "react";
import { useLibrary } from "../state/library";
import { useUi, type View } from "../state/ui";
import { Logo } from "./Logo";

interface NavItem { view: View; label: string; icon: ReactNode }

const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Coleção",
    items: [
      { view: "library", label: "Biblioteca", icon: <Library size={18} /> },
      { view: "installed", label: "Instalados", icon: <HardDriveDownload size={18} /> },
      { view: "board", label: "Quero jogar", icon: <Kanban size={18} /> },
      { view: "platforms", label: "Plataformas", icon: <Gamepad2 size={18} /> },
    ],
  },
  {
    title: "Descobrir",
    items: [
      { view: "freebies", label: "Jogos grátis", icon: <Gift size={18} /> },
      { view: "providers", label: "Provedores", icon: <Store size={18} /> },
      { view: "folders", label: "Pastas", icon: <FolderSearch size={18} /> },
    ],
  },
  {
    title: "Sistema",
    items: [
      { view: "emulators", label: "Emuladores", icon: <Cpu size={18} /> },
      { view: "stats", label: "Estatísticas", icon: <BarChart3 size={18} /> },
      { view: "settings", label: "Ajustes", icon: <Settings size={18} /> },
    ],
  },
];

export function Sidebar() {
  const view = useUi((s) => s.view);
  const go = useUi((s) => s.go);
  const setAddOpen = useUi((s) => s.setAddOpen);
  const games = useLibrary((s) => s.games);
  const counts = useMemo<Partial<Record<View, number>>>(() => ({
    library: games.length,
    installed: games.filter((g) => g.installed).length,
    board: games.filter((g) => g.status === "backlog" || g.status === "wishlist").length,
  }), [games]);

  return (
    <nav
      className="relative z-10 flex flex-col gap-6 overflow-y-auto border-r border-white/[0.06] bg-ink-900/55 px-3 py-6 backdrop-blur-2xl max-[860px]:items-center max-[860px]:px-2"
      aria-label="Navegação principal"
    >
      <div className="flex items-center gap-3 px-2">
        <Logo size={38} />
        <div className="leading-none max-[860px]:hidden">
          <div className="font-display text-[19px] font-bold tracking-tight text-mist">Games</div>
          <div className="text-gradient font-display text-[19px] font-bold tracking-tight">Gallery</div>
        </div>
      </div>

      <button
        className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-2xl bg-signature px-4 py-3 text-sm font-semibold text-white shadow-glow transition-all duration-300 ease-expo hover:-translate-y-0.5 hover:brightness-110 active:scale-95 max-[860px]:size-11 max-[860px]:p-0"
        aria-label="Adicionar jogo"
        title="Adicionar jogo"
        onClick={() => setAddOpen(true)}
      >
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-sheen bg-white/25 blur-md" />
        <Plus size={18} aria-hidden className="relative transition-transform duration-300 group-hover:rotate-90" />
        <span className="relative max-[860px]:hidden">Adicionar jogo</span>
      </button>

      {GROUPS.map((group) => (
        <div key={group.title} className="grid gap-1 max-[860px]:w-full">
          <h2 className="px-3 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-fog/70 max-[860px]:sr-only">{group.title}</h2>
          <ul className="m-0 grid list-none gap-0.5 p-0">
            {group.items.map((n) => {
              const active = view === n.view;
              return (
                <li key={n.view}>
                  <button
                    className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13.5px] font-medium transition-colors duration-200 max-[860px]:justify-center max-[860px]:px-0 ${active ? "text-mist" : "text-fog hover:text-mist"}`}
                    aria-label={n.label}
                    title={n.label}
                    aria-current={active ? "page" : undefined}
                    onClick={() => go(n.view)}
                  >
                    {active && (
                      <m.span
                        layoutId="nav-pill"
                        className="absolute inset-0 rounded-xl border border-white/10 bg-gradient-to-r from-rose/25 via-orchid/15 to-transparent shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      >
                        <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full bg-signature" />
                      </m.span>
                    )}
                    <span className={`relative transition-transform duration-300 ease-expo group-hover:scale-110 ${active ? "text-rose" : ""}`}>{n.icon}</span>
                    <span className="relative flex-1 max-[860px]:hidden">{n.label}</span>
                    {counts[n.view] !== undefined && (
                      <small className="relative rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-fog max-[860px]:hidden">{counts[n.view]}</small>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
