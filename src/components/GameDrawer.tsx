import { burst, Dialog, Rating, Tabs, TextField } from "@juninmd/sonido";
import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { STATUS_COLOR, STATUS_LABEL, STATUS_ORDER } from "../domain/status";
import type { Game, PlayStatus } from "../domain/types";
import { useLibrary } from "../state/library";
import { ratingEntry, useRatings } from "../state/ratings";
import { useSecrets } from "../state/secrets";
import { useUi } from "../state/ui";
import { BeatEstimate } from "./BeatEstimate";
import { canShowAchievements, SteamAchievements } from "./SteamAchievements";
import { CollectionPanel } from "./CollectionPanel";
import { DrawerActions } from "./DrawerActions";
import { DrawerHero } from "./DrawerHero";
import { LaunchPanel } from "./LaunchPanel";
import { RatingsPanel } from "./RatingsPanel";
import { StoresPanel } from "./StoresPanel";
import { useLaunch } from "./useLaunch";

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
  const setStatus = (status: PlayStatus, from?: HTMLElement) => {
    if (status === "completed" && game.status !== "completed") { if (from) burst(from); }
    return patchGame(game.id, status === "wishlist" ? { status, owned: false, installed: false, loan: undefined } : { status, owned: true });
  };

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
            onClick={(e) => setStatus(s, e.currentTarget)}
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
  const rating = game.rating ?? 0;

  return (
    <div className="flex items-center gap-3">
      <Rating label="Avaliação" value={rating} onChange={(n) => patchGame(game.id, { rating: rating === n ? undefined : n })} />
      <span className="min-w-[5.5rem] text-[13px] font-medium text-warn" aria-live="polite">{rating ? STAR_LABELS[rating - 1] : "Sem nota"}</span>
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
      <TextField
        compact hideLabel label="Horas jogadas" className="hours-field"
        type="number" min={0} max={MAX_HOURS} value={game.playtimeH}
        onChange={(e) => { const v = e.currentTarget.valueAsNumber; set(Number.isFinite(v) ? v : 0); }}
      />
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
  const steam = useSecrets((s) => canShowAchievements(game, s.steamId, s.steamKey));
  return (
    <div className="overview-grid grid gap-4">
      <StoresPanel game={game} />
      <Section title="Status"><StatusPicker game={game} /></Section>
      <Section title="Coleção"><CollectionPanel game={game} /></Section>
      <Section title="Sua avaliação"><RatingStars game={game} /></Section>
      <Section title="Tempo de jogo"><HoursStepper game={game} /></Section>
      <Section title="Tempo para terminar"><BeatEstimate game={game} /></Section>
      {steam && <Section title="Conquistas da Steam"><SteamAchievements game={game} /></Section>}
      <section className="glass grid gap-2 rounded-2xl p-4 game-notes">
        <TextField
          multiline
          label="Notas pessoais"
          maxLength={5000}
          rows={4}
          value={game.notes ?? ""}
          hint={`${(game.notes ?? "").length}/5000`}
          onChange={(e) => patchGame(game.id, { notes: e.currentTarget.value.slice(0, 5000) || undefined })}
          placeholder="Anotações sobre sua experiência, progresso ou configuração…"
        />
      </section>
    </div>
  );
}

function GameDetails({ game }: { game: Game }) {
  const [tab, setTab] = useState<TabId>("overview");
  const launch = useLaunch(game);
  const entry = useRatings((s) => ratingEntry(s.entries, game.id));
  const refresh = useRatings((s) => s.refresh);
  const rawgKey = useSecrets((s) => s.rawgKey);

  // The hero shows the public average, so fetch it up front rather than when the Notas tab opens.
  useEffect(() => { void refresh(game); }, [game.id, rawgKey]);

  return (
    <div className="flex min-h-full flex-col">
      <DrawerHero game={game} ratings={entry} />

      <div className="px-6 sm:px-10">
        <Tabs label="Seções do jogo" idPrefix="drawer-tab" hasPanels items={TABS.map((t) => ({ key: t.id, label: t.label }))} value={tab} onChange={setTab} />
      </div>

      <div key={tab} id={`drawer-tab-panel-${tab}`} role="tabpanel" aria-labelledby={`drawer-tab-${tab}`} className="animate-rise px-6 py-5 sm:px-10">
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

  return (
    <Dialog open={Boolean(game)} onClose={() => select(null)} title={game?.title ?? "Jogo"} className="game-drawer">
      {game && <GameDetails key={game.id} game={game} />}
    </Dialog>
  );
}
