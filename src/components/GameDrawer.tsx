import { m } from "motion/react";
import { Minus, Plus, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { STATUS_COLOR, STATUS_LABEL, STATUS_ORDER } from "../domain/status";
import type { Game, PlayStatus } from "../domain/types";
import { useLibrary } from "../state/library";
import { ratingEntry, useRatings, useSecrets } from "../state/ratings";
import { useUi } from "../state/ui";
import { DrawerActions } from "./DrawerActions";
import { DrawerHero } from "./DrawerHero";
import { LaunchPanel } from "./LaunchPanel";
import { RatingsPanel } from "./RatingsPanel";
import { useLaunch } from "./useLaunch";
import { useNativeDialog } from "./useNativeDialog";

const TABS = [
  { id: "overview", label: "Visão geral" },
  { id: "scores", label: "Notas" },
  { id: "play", label: "Jogar" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const STAR_LABELS = ["Ruim", "Fraco", "Bom", "Ótimo", "Obra-prima"];
const MAX_HOURS = 1_000_000;

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="glass grid gap-3.5 rounded-2xl p-4" aria-label={title}>
      <div className="flex items-center justify-between gap-3">
        <h3>{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function StatusPicker({ game }: { game: Game }) {
  const patchGame = useLibrary((s) => s.patchGame);
  const setStatus = (status: PlayStatus) =>
    patchGame(game.id, status === "wishlist" ? { status, owned: false, installed: false } : { status, owned: true });

  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Status do jogo">
      {STATUS_ORDER.map((s) => {
        const on = game.status === s;
        const c = STATUS_COLOR[s];
        return (
          <button
            key={s}
            role="radio"
            aria-checked={on}
            onClick={() => setStatus(s)}
            className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-all duration-300 ease-expo hover:-translate-y-0.5 active:scale-95"
            style={on
              ? { color: c, borderColor: c, background: `${c}26`, boxShadow: `0 8px 22px -10px ${c}` }
              : { color: "var(--muted)", borderColor: "rgb(255 255 255 / 10%)", background: "rgb(255 255 255 / 4%)" }}
          >
            <i className="size-2 rounded-full" style={{ background: c, opacity: on ? 1 : 0.55 }} />
            {STATUS_LABEL[s]}
          </button>
        );
      })}
    </div>
  );
}

function RatingStars({ game }: { game: Game }) {
  const patchGame = useLibrary((s) => s.patchGame);
  const [hover, setHover] = useState(0);
  const shown = hover || game.rating || 0;

  return (
    <div className="flex items-center gap-3">
      <div className="stars" role="group" aria-label="Avaliação" onPointerLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
            aria-pressed={(game.rating ?? 0) >= n}
            className={`transition-transform duration-200 ease-expo hover:scale-125 ${shown >= n ? "on" : ""}`}
            onPointerEnter={() => setHover(n)}
            onClick={() => patchGame(game.id, { rating: game.rating === n ? undefined : n })}
          >
            <Star size={26} fill={shown >= n ? "currentColor" : "none"} />
          </button>
        ))}
      </div>
      <span className="min-w-[5.5rem] text-[13px] font-medium text-warn" aria-live="polite">{shown ? STAR_LABELS[shown - 1] : "Sem nota"}</span>
    </div>
  );
}

function HoursStepper({ game }: { game: Game }) {
  const patchGame = useLibrary((s) => s.patchGame);
  const set = (h: number) => patchGame(game.id, { playtimeH: Math.min(MAX_HOURS, Math.max(0, Math.round(h * 10) / 10)) });
  const step = "grid size-9 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-mist transition-all duration-200 ease-expo hover:border-rose/50 hover:bg-rose/10 active:scale-90";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={step} aria-label="Menos 1 hora" onClick={() => set(game.playtimeH - 1)}><Minus size={15} aria-hidden /></button>
      <label className="relative">
        <span className="sr-only">Horas jogadas</span>
        <input
          type="number" min={0} max={MAX_HOURS} value={game.playtimeH}
          className="!w-24 !rounded-xl text-center font-display text-lg font-bold tabular-nums"
          onChange={(e) => { const v = e.currentTarget.valueAsNumber; set(Number.isFinite(v) ? v : 0); }}
        />
      </label>
      <button type="button" className={step} aria-label="Mais 1 hora" onClick={() => set(game.playtimeH + 1)}><Plus size={15} aria-hidden /></button>
      <span className="mx-1 h-6 w-px bg-white/10" aria-hidden />
      {[2, 5, 10].map((n) => (
        <button key={n} type="button" onClick={() => set(game.playtimeH + n)} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-fog transition-all duration-200 ease-expo hover:border-aurora/50 hover:text-aurora active:scale-95">
          +{n} h
        </button>
      ))}
    </div>
  );
}

function Overview({ game }: { game: Game }) {
  const patchGame = useLibrary((s) => s.patchGame);
  return (
    <div className="grid gap-4">
      <Section title="Status"><StatusPicker game={game} /></Section>
      <Section title="Sua avaliação"><RatingStars game={game} /></Section>
      <Section title="Tempo de jogo"><HoursStepper game={game} /></Section>
      <section className="glass grid gap-2 rounded-2xl p-4 game-notes">
        <label htmlFor="game-personal-notes" className="!text-[15px] font-display font-semibold !text-mist">Notas pessoais</label>
        <textarea
          id="game-personal-notes"
          maxLength={5000}
          rows={4}
          value={game.notes ?? ""}
          aria-describedby="game-note-count"
          onChange={(e) => patchGame(game.id, { notes: e.currentTarget.value.slice(0, 5000) || undefined })}
          placeholder="Anotações sobre sua experiência, progresso ou configuração…"
        />
        <span id="game-note-count" className="muted small text-right tabular-nums">{(game.notes ?? "").length}/5000</span>
      </section>
    </div>
  );
}

function GameDetails({ game, onClose }: { game: Game; onClose: () => void }) {
  const [tab, setTab] = useState<TabId>("overview");
  const launch = useLaunch(game);
  const entry = useRatings((s) => ratingEntry(s.entries, game.id));
  const refresh = useRatings((s) => s.refresh);
  const rawgKey = useSecrets((s) => s.rawgKey);

  // The hero shows the public average, so fetch it up front rather than when the Notas tab opens.
  useEffect(() => { void refresh(game); }, [game.id, rawgKey]);

  const onTabKey = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const t = TABS[(next + TABS.length) % TABS.length]!;
    setTab(t.id);
    document.getElementById(`drawer-tab-${t.id}`)?.focus();
  };

  return (
    <div className="flex min-h-full flex-col">
      <DrawerHero game={game} ratings={entry} onClose={onClose} />

      <div className="px-6">
        <div role="tablist" aria-label="Seções do jogo" onKeyDown={onTabKey} className="relative flex gap-1 border-b border-white/10">
          {TABS.map((t) => (
            <button
              key={t.id}
              id={`drawer-tab-${t.id}`}
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={`drawer-panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => setTab(t.id)}
              className={`relative px-4 py-3 text-[13.5px] font-semibold transition-colors ${tab === t.id ? "text-mist" : "text-fog hover:text-mist"}`}
            >
              {t.label}
              {tab === t.id && <m.span layoutId="drawer-tab" className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-signature" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
            </button>
          ))}
        </div>
      </div>

      <div key={tab} id={`drawer-panel-${tab}`} role="tabpanel" aria-labelledby={`drawer-tab-${tab}`} className="animate-rise px-6 py-5">
        {tab === "overview" && <Overview game={game} />}
        {tab === "scores" && <RatingsPanel game={game} />}
        {tab === "play" && <LaunchPanel game={game} launch={launch} />}
      </div>

      <DrawerActions game={game} launch={launch} />
    </div>
  );
}

export function GameDrawer() {
  const { selectedId, select } = useUi();
  const game = useLibrary((s) => s.games.find((g) => g.id === selectedId));
  const dialog = useNativeDialog(Boolean(game), () => select(null));

  return (
    <dialog ref={dialog.ref} className="native-dialog drawer p-0 open:block" aria-labelledby="game-drawer-title" onCancel={dialog.onCancel} onPointerDown={dialog.onPointerDown} onPointerUp={dialog.onPointerUp}>
      {game && <GameDetails key={game.id} game={game} onClose={() => select(null)} />}
    </dialog>
  );
}
