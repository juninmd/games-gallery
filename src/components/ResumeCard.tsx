import { Play } from "lucide-react";
import { useMemo } from "react";
import type { GameGroup } from "../domain/duplicates";
import { useSessions } from "../state/sessions";
import { Cover } from "./Cover";
import { useLaunch } from "./useLaunch";

const when = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

function ResumeRow({ group, start, minutes }: { group: GameGroup; start: string; minutes?: number }) {
  const game = group.members.find((m) => m.installed) ?? group.primary;
  const { plan, play } = useLaunch(game);
  const detail = minutes ? `${when(start)} · ${minutes} min` : when(start);
  return (
    <div className="flex items-center gap-2.5 rounded-xl p-1.5">
      <div className="w-9 shrink-0"><Cover game={game} /></div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-semibold text-mist">{game.title}</div>
        <div className="text-[11px] text-fog">Última vez: {detail}</div>
      </div>
      <button
        type="button"
        onClick={() => void play()}
        disabled={plan.kind === "blocked"}
        title={plan.kind === "blocked" ? plan.reason : undefined}
        aria-label={`Retomar ${game.title}`}
        className="grid size-8 shrink-0 place-items-center rounded-full bg-aurora/90 text-ink-950 transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
      >
        <Play size={14} aria-hidden />
      </button>
    </div>
  );
}

/** One click back into the game played last (sessions recorded by the app). */
export function ResumeCard({ groups }: { groups: GameGroup[] }) {
  const sessions = useSessions((s) => s.sessions);
  const hit = useMemo(() => {
    const last = sessions[0];
    if (!last) return undefined;
    const group = groups.find((g) => g.members.some((m) => m.id === last.gameId));
    if (!group) return undefined;
    return { group, session: last };
  }, [sessions, groups]);
  if (!hit) return null;
  return <ResumeRow group={hit.group} start={hit.session.start} minutes={hit.session.minutes} />;
}
