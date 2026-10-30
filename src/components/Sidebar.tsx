import { PanelLeftClose, PanelLeftOpen, Plus, Search } from "lucide-react";
import { m } from "motion/react";
import { useMemo, type PointerEvent } from "react";
import { computeStats } from "../domain/stats";
import { isTauri } from "../platform/runtime";
import { useLibrary } from "../state/library";
import { useUi, type View } from "../state/ui";
import { Logo } from "./Logo";
import { NAV_GROUPS } from "./nav";
import { NowPlaying } from "./NowPlaying";
import { ProfileCard } from "./ProfileCard";
import { SidebarTasks } from "./SidebarTasks";
import { useCompactSidebar } from "./useCompactSidebar";

const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);

/** Moves the hover spotlight under the pointer without re-rendering. */
const track = (e: PointerEvent<HTMLElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--x", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--y", `${e.clientY - r.top}px`);
};

export function Sidebar() {
  const view = useUi((s) => s.view);
  const go = useUi((s) => s.go);
  const setAddOpen = useUi((s) => s.setAddOpen);
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);
  const toggleSidebar = useUi((s) => s.toggleSidebar);
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const games = useLibrary((s) => s.games);
  const { compact, narrow } = useCompactSidebar();
  const stats = useMemo(() => computeStats(games), [games]);
  const counts = useMemo<Partial<Record<View, number>>>(() => ({
    library: games.length,
    installed: games.filter((g) => g.installed).length,
    board: games.filter((g) => g.status === "backlog" || g.status === "wishlist").length,
  }), [games]);

  return (
    <nav
      className={`relative z-10 flex flex-col gap-3 [&>*]:shrink-0 overflow-y-auto overflow-x-hidden border-r border-white/[0.06] bg-ink-900/55 py-5 backdrop-blur-2xl [scrollbar-width:none] ${compact ? "items-center px-2" : "px-3.5"}`}
      aria-label="Navegação principal"
    >
      <span aria-hidden className="pointer-events-none absolute -left-24 top-1/4 size-72 animate-drift rounded-full bg-orchid/15 blur-3xl" />
      <span aria-hidden className="pointer-events-none absolute -right-24 bottom-10 size-64 animate-drift rounded-full bg-ember/10 blur-3xl [animation-direction:alternate-reverse]" />

      <div className={`relative flex items-center gap-3 ${compact ? "justify-center" : "px-1"}`}>
        <Logo size={compact ? 40 : 40} />
        {!compact && (
          <div className="leading-none">
            <div className="font-display text-[19px] font-bold tracking-tight text-mist">Games</div>
            <div className="text-gradient font-display text-[19px] font-bold tracking-tight">Gallery</div>
          </div>
        )}
      </div>

      <div className={`relative flex gap-2 ${compact ? "flex-col" : ""}`}>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label="Buscar ou ir para… (atalho Ctrl+K)"
          title={`Buscar ou ir para… (${isMac ? "⌘" : "Ctrl+"}K)`}
          className={`group flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] text-[13px] text-fog transition-all duration-300 ease-expo hover:border-white/25 hover:bg-white/[0.08] hover:text-mist ${compact ? "size-11 justify-center" : "min-w-0 flex-1 px-3 py-2.5"}`}
        >
          <Search size={16} aria-hidden className="shrink-0" />
          {!compact && <>
            <span className="flex-1 truncate text-left">Buscar…</span>
            <kbd className="rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10.5px] text-fog">{isMac ? "⌘K" : "Ctrl K"}</kbd>
          </>}
        </button>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          aria-label="Adicionar jogo"
          title="Adicionar jogo"
          className="group relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-signature text-white shadow-glow transition-all duration-300 ease-expo hover:-translate-y-0.5 hover:brightness-110 active:scale-95"
        >
          <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-sheen bg-white/30 blur-md" />
          <Plus size={19} aria-hidden className="relative transition-transform duration-300 group-hover:rotate-90" />
        </button>
      </div>

      <ProfileCard stats={stats} compact={compact} />

      {NAV_GROUPS.map((group) => (
        <div key={group.title} className={`relative grid gap-1 ${compact ? "w-full" : ""}`}>
          {compact
            ? <div aria-hidden className="mx-3 mb-1 h-px bg-white/[0.07]" />
            : <h2 className="px-3 pb-0.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-fog/70">{group.title}</h2>}
          <ul className="m-0 grid list-none gap-0.5 p-0">
            {group.items.map((n) => {
              const active = view === n.view;
              return (
                <li key={n.view}>
                  <button
                    onPointerMove={track}
                    className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-xl py-[7px] text-left text-[13.5px] font-medium transition-colors duration-200 ${compact ? "justify-center px-0" : "px-3"} ${active ? "text-mist" : "text-fog hover:text-mist"}`}
                    aria-label={n.label}
                    title={n.label}
                    aria-current={active ? "page" : undefined}
                    onClick={() => go(n.view)}
                  >
                    <span aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 [background:radial-gradient(110px_circle_at_var(--x,50%)_var(--y,50%),rgb(255_255_255/0.1),transparent_70%)]" />
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
                    {!compact && <span className="relative flex-1">{n.label}</span>}
                    {!compact && counts[n.view] !== undefined && (
                      <small className="relative rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-fog">{counts[n.view]}</small>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className={`relative mt-auto grid gap-3 pt-2 ${compact ? "justify-items-center" : ""}`}>
        {!compact && <NowPlaying />}
        <SidebarTasks compact={compact} />
        <div className={`flex items-center gap-2 text-[11px] text-fog/80 ${compact ? "flex-col" : "justify-between px-1"}`}>
          {!compact && <span className="tabular-nums">v{__APP_VERSION__} · {isTauri() ? "Desktop" : "Web"}</span>}
          {!narrow && (
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
              title={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
              className="grid size-8 place-items-center rounded-lg text-fog transition-colors hover:bg-white/[0.08] hover:text-mist"
            >
              {collapsed ? <PanelLeftOpen size={16} aria-hidden /> : <PanelLeftClose size={16} aria-hidden />}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
