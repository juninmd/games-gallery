import { useMemo } from "react";
import { FilterBar } from "../components/FilterBar";
import { GameCard } from "../components/GameCard";
import { filterGames, libraryStats } from "../domain/filter";
import { PLATFORM_BY_ID } from "../domain/platforms";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";

export function GameBrowser({ scope }: { scope: "all" | "installed" }) {
  const games = useLibrary((s) => s.games);
  const filter = useUi((s) => s.filter);
  const effective = useMemo(() => scope === "installed" ? { ...filter, installedOnly: true } : filter, [scope, filter]);
  const shown = useMemo(() => filterGames(games, effective), [games, effective]);
  const stats = useMemo(() => libraryStats(games), [games]);
  const platform = filter.platformId ? PLATFORM_BY_ID[filter.platformId] : null;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>{scope === "installed" ? "Instalados" : platform ? platform.name : "Biblioteca"}</h1>
          <p className="muted">{shown.length} de {games.length} jogos</p>
        </div>
        <dl className="stats">
          <div><dt>Comprados</dt><dd>{stats.owned}</dd></div>
          <div><dt>Instalados</dt><dd>{stats.installed}</dd></div>
          <div><dt>Backlog</dt><dd>{stats.backlog}</dd></div>
          <div><dt>Horas</dt><dd>{stats.hours}</dd></div>
        </dl>
      </header>
      <FilterBar lockInstalled={scope === "installed"} />
      {shown.length === 0 ? (
        <p className="empty">Nenhum jogo com esses filtros.</p>
      ) : (
        <div className="grid">
          {shown.map((g) => <GameCard key={g.id} game={g} />)}
        </div>
      )}
    </>
  );
}
