import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useRef, type ReactNode } from "react";
import { totalHours, type GameGroup } from "../domain/duplicates";
import type { GameFilter } from "../domain/filter";
import { STATUS_COLOR } from "../domain/status";
import { useUi } from "../state/ui";
import { GameCard } from "./GameCard";

const RAIL_MAX = 24;

interface Rail { id: string; title: string; color: string; groups: GameGroup[]; filter?: Partial<GameFilter>; sort?: GameFilter["sort"] }

const physical = (g: GameGroup) => g.members.some((m) => m.providerId === "physical" || m.providerId === "roms");

/** Themed shelves built from the library; each can open the full filtered grid. */
export function buildRails(groups: GameGroup[]): Rail[] {
  const byHours = (a: GameGroup, b: GameGroup) => totalHours(b.members) - totalHours(a.members);
  const status = (s: GameGroup["primary"]["status"]) => groups.filter((g) => g.primary.status === s);
  const rails: Rail[] = [
    { id: "playing", title: "Continue jogando", color: STATUS_COLOR.playing, groups: status("playing").sort(byHours), filter: { status: "playing" } },
    { id: "backlog", title: "Quero jogar a seguir", color: STATUS_COLOR.backlog, groups: status("backlog"), filter: { status: "backlog" } },
    { id: "installed", title: "Prontos para jogar", color: "#46f0c1", groups: groups.filter((g) => g.members.some((m) => m.installed)).sort(byHours), filter: { installedOnly: true } },
    { id: "top", title: "Mais jogados", color: "#ff8a4c", groups: groups.filter((g) => totalHours(g.members) > 0).sort(byHours), sort: "playtime" },
    { id: "best", title: "Zerados com nota alta", color: STATUS_COLOR.completed, groups: status("completed").filter((g) => (g.primary.rating ?? 0) >= 4), filter: { status: "completed" }, sort: "rating" },
    { id: "physical", title: "Coleção física e retrô", color: "#d1a05a", groups: groups.filter(physical), filter: { providerIds: ["physical", "roms"] } },
    { id: "multi", title: "Em mais de uma loja", color: "#ff4d8d", groups: groups.filter((g) => g.members.length > 1), filter: { multiStoreOnly: true } },
    { id: "wishlist", title: "Na wishlist", color: STATUS_COLOR.wishlist, groups: status("wishlist"), filter: { status: "wishlist" } },
  ];
  return rails.filter((r) => r.groups.length > 0);
}

function RailRow({ rail, onSeeAll }: { rail: Rail; onSeeAll: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.85, behavior: "smooth" });
  const nav = (dir: number, icon: ReactNode, label: string) => (
    <button type="button" className="rail-nav" onClick={() => scroll(dir)} aria-label={`${label}: ${rail.title}`}>{icon}</button>
  );

  return (
    <section className="rail" aria-labelledby={`rail-${rail.id}`} style={{ "--c": rail.color } as React.CSSProperties}>
      <header className="rail-head">
        <h2 id={`rail-${rail.id}`}><i aria-hidden />{rail.title}<small>{rail.groups.length}</small></h2>
        <div className="rail-tools">
          {nav(-1, <ChevronLeft size={16} aria-hidden />, "Rolar para trás")}
          {nav(1, <ChevronRight size={16} aria-hidden />, "Rolar para frente")}
          <button type="button" className="rail-all" onClick={onSeeAll}>Ver todos</button>
        </div>
      </header>
      <div ref={track} className="rail-track">
        {rail.groups.slice(0, RAIL_MAX).map((g, i) => <GameCard key={g.primary.id} game={g.primary} members={g.members} index={i} />)}
      </div>
    </section>
  );
}

export function GameRails({ groups }: { groups: GameGroup[] }) {
  const setFilter = useUi((s) => s.setFilter);
  const setDensity = useUi((s) => s.setDensity);
  const rails = useMemo(() => buildRails(groups), [groups]);

  return (
    <div className="rails">
      {rails.map((rail) => (
        <RailRow
          key={rail.id}
          rail={rail}
          onSeeAll={() => {
            setDensity("comfortable");
            setFilter({ ...rail.filter, ...(rail.sort ? { sort: rail.sort } : {}) });
          }}
        />
      ))}
    </div>
  );
}
