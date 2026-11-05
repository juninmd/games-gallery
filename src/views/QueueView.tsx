import { ArrowDown, ArrowUp, Dices, ListX } from "lucide-react";
import { useMemo, useState } from "react";
import { Cover } from "../components/Cover";
import { StoreChips } from "../components/StoreChips";
import { groupGames, type GameGroup } from "../domain/duplicates";
import { backlogPlan, moveInQueue, nextSlot, pickGame, queueOf, remainingHours } from "../domain/queue";
import { tagCounts } from "../domain/tags";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";

const PACE_KEY = "games-gallery:pace";
const MAX_OPTIONS = [2, 5, 10, 20, 40] as const;
const readPace = () => {
  try {
    const v = Number(localStorage.getItem(PACE_KEY));
    return Number.isFinite(v) && v > 0 && v <= 168 ? v : 7;
  } catch {
    return 7;
  }
};

const hoursLabel = (g: GameGroup) => {
  const left = remainingHours(g);
  return left === undefined ? "sem estimativa" : left === 0 ? "estimativa cumprida" : `~${left.toLocaleString("pt-BR")} h restantes`;
};

function QueueList({ queue }: { queue: GameGroup[] }) {
  const patchGame = useLibrary((s) => s.patchGame);
  const patchGames = useLibrary((s) => s.patchGames);
  const select = useUi((s) => s.select);
  const move = (i: number, d: number) => patchGames(moveInQueue(queue, i, d).map((p) => ({ id: p.id, patch: { queuedAt: p.queuedAt } })));
  const btn = "grid size-8 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-fog transition-colors hover:border-white/25 hover:text-mist disabled:pointer-events-none disabled:opacity-30";

  if (!queue.length) {
    return <p className="empty !py-8">A fila está vazia. Use “Colocar na fila” no painel de um jogo do backlog, ou sorteie abaixo.</p>;
  }
  return (
    <ol className="m-0 grid list-none gap-2 p-0" aria-label="Fila de jogos">
      {queue.map((x, i) => (
        <li key={x.primary.id} className="glass flex items-center gap-3 rounded-2xl p-2.5">
          <span className="w-6 text-center font-display text-lg font-bold tabular-nums text-fog" aria-hidden>{i + 1}</span>
          <div className="w-10 shrink-0"><Cover game={x.primary} /></div>
          <div className="grid min-w-0 flex-1 gap-0.5">
            <button type="button" className="linkish truncate text-left font-semibold" onClick={() => select(x.primary.id)}>{x.primary.title}</button>
            <span className="muted small">{hoursLabel(x)}</span>
            <StoreChips members={x.members} />
          </div>
          <div className="flex gap-1.5">
            <button type="button" className={btn} aria-label={`Subir ${x.primary.title}`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={15} aria-hidden /></button>
            <button type="button" className={btn} aria-label={`Descer ${x.primary.title}`} disabled={i === queue.length - 1} onClick={() => move(i, 1)}><ArrowDown size={15} aria-hidden /></button>
            <button type="button" className={btn} aria-label={`Tirar ${x.primary.title} da fila`} onClick={() => patchGame(x.primary.id, { queuedAt: undefined })}><ListX size={15} aria-hidden /></button>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Picker({ groups }: { groups: GameGroup[] }) {
  const patchGame = useLibrary((s) => s.patchGame);
  const select = useUi((s) => s.select);
  const [installedOnly, setInstalledOnly] = useState(false);
  const [maxHours, setMaxHours] = useState<number | undefined>();
  const [genre, setGenre] = useState("");
  const [tag, setTag] = useState("");
  const [picked, setPicked] = useState<GameGroup | null | undefined>();
  const genres = useMemo(() => [...new Set(groups.filter((x) => x.primary.owned).flatMap((x) => x.primary.genres))].sort((a, b) => a.localeCompare(b, "pt-BR")), [groups]);
  const tags = useMemo(() => tagCounts(groups.map((x) => x.primary)), [groups]);
  const sel = "rounded-full border border-white/10 bg-white/[0.04] py-2 pl-4 pr-3 text-[13px] font-medium text-mist";
  const fresh = picked ? groups.find((x) => x.primary.id === picked.primary.id) : picked;

  return (
    <section className="panel" aria-label="Sorteio">
      <h3 aria-level={2}>O que jogar agora?</h3>
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-fog"><input type="checkbox" checked={installedOnly} onChange={(e) => setInstalledOnly(e.target.checked)} /> Só instalados</label>
        <select className={sel} aria-label="Tempo máximo" value={maxHours ?? ""} onChange={(e) => setMaxHours(e.target.value ? Number(e.target.value) : undefined)}>
          <option value="">Qualquer duração</option>
          {MAX_OPTIONS.map((h) => <option key={h} value={h}>Até {h} h restantes</option>)}
        </select>
        <select className={sel} aria-label="Gênero" value={genre} onChange={(e) => setGenre(e.target.value)}>
          <option value="">Qualquer gênero</option>
          {genres.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        {tags.length > 0 && (
          <select className={sel} aria-label="Tag" value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">Qualquer tag</option>
            {tags.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        )}
        <button type="button" className="btn" onClick={() => setPicked(pickGame(groups, { installedOnly, maxHours, genre: genre || undefined, tag: tag || null }) ?? null)}>
          <Dices size={15} aria-hidden /> Sortear
        </button>
      </div>
      {maxHours !== undefined && <p className="muted small">O filtro de duração só considera jogos com “Horas para zerar” preenchido no painel do jogo.</p>}
      <div aria-live="polite">
        {fresh === null && <p className="muted small">Nada no backlog combina com esses filtros.</p>}
        {fresh && (
          <div className="glass flex items-center gap-3 rounded-2xl p-2.5">
            <div className="w-12 shrink-0"><Cover game={fresh.primary} /></div>
            <div className="grid min-w-0 flex-1 gap-0.5">
              <strong className="truncate">{fresh.primary.title}</strong>
              <span className="muted small">{hoursLabel(fresh)}</span>
            </div>
            <button type="button" className="btn" onClick={() => select(fresh.primary.id)}>Abrir</button>
            {fresh.primary.queuedAt === undefined && (
              <button type="button" className="btn ghost" onClick={() => patchGame(fresh.primary.id, { queuedAt: nextSlot(groups) })}>Colocar na fila</button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Plan({ groups }: { groups: GameGroup[] }) {
  const [pace, setPace] = useState(readPace);
  const plan = useMemo(() => backlogPlan(groups, pace), [groups, pace]);
  const update = (v: number) => {
    const next = Number.isFinite(v) ? Math.min(168, Math.max(1, v)) : 7;
    setPace(next);
    try { localStorage.setItem(PACE_KEY, String(next)); } catch { /* storage unavailable: keep in memory */ }
  };

  return (
    <section className="panel" aria-label="Plano de backlog">
      <h3 aria-level={2}>Plano de backlog</h3>
      <label className="flex flex-wrap items-center gap-2 text-[13px] text-fog">
        Quanto você joga por semana
        <input type="number" min={1} max={168} value={pace} onChange={(e) => update(e.currentTarget.valueAsNumber)} className="!w-20 !rounded-xl text-center tabular-nums" /> h
      </label>
      {plan.estimated === 0 ? (
        <p className="muted small">Informe as “Horas para zerar” nos jogos do backlog para ver quanto tempo falta para limpar a fila.</p>
      ) : (
        <p>
          <strong>{plan.hours.toLocaleString("pt-BR")} h</strong> restantes em {plan.estimated} jogos, cerca de <strong>{plan.weeks} {plan.weeks === 1 ? "semana" : "semanas"}</strong> nesse ritmo.
          {plan.unestimated > 0 && <span className="muted small"> Mais {plan.unestimated} sem estimativa não entram na conta.</span>}
        </p>
      )}
    </section>
  );
}

export function QueueView() {
  const games = useLibrary((s) => s.games);
  const groups = useMemo(() => groupGames(games), [games]);
  const queue = useMemo(() => queueOf(groups), [groups]);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Fila</h1>
          <p className="muted">O que vem a seguir, um sorteio com filtros e quanto falta para limpar o backlog. Tudo calculado aqui, com as estimativas que você informa.</p>
        </div>
      </header>
      <div className="grid gap-4">
        <section className="grid gap-3" aria-label="Próximos jogos">
          <h2 className="text-lg">Próximos</h2>
          <QueueList queue={queue} />
        </section>
        <Picker groups={groups} />
        <Plan groups={groups} />
      </div>
    </>
  );
}
