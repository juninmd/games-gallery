import { ListPlus, ListX, X } from "lucide-react";
import { useId, useMemo, useState, type FormEvent } from "react";
import { groupGames } from "../domain/duplicates";
import { nextSlot, remainingHours } from "../domain/queue";
import { MAX_TAGS, MAX_TAG_LEN, addTag, removeTag, tagCounts, tagKey } from "../domain/tags";
import type { Game } from "../domain/types";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";

const MAX_TO_BEAT = 2000;

/** Tags, time-to-beat and the play queue for one title; every owned store copy follows (see `applyShared`). */
export function GameOrganizer({ game }: { game: Game }) {
  const games = useLibrary((s) => s.games);
  const patchGame = useLibrary((s) => s.patchGame);
  const go = useUi((s) => s.go);
  const [draft, setDraft] = useState("");
  const listId = useId();
  const groups = useMemo(() => groupGames(games), [games]);
  const group = groups.find((x) => x.members.some((m) => m.id === game.id));
  const known = useMemo(() => tagCounts(games), [games]);
  const left = group ? remainingHours(group) : undefined;
  const canQueue = game.owned && (game.status === "backlog" || game.status === "playing");
  const queued = game.queuedAt !== undefined;
  const tags = game.tags ?? [];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = addTag(game.tags, draft);
    if (next) patchGame(game.id, { tags: next });
    setDraft("");
  };

  return (
    <section className="glass grid gap-4 rounded-2xl p-4" aria-label="Organização">
      <h3>Organização</h3>

      <div className="grid gap-2">
        <span className="text-[12.5px] font-semibold text-mist" id={`${listId}-label`}>Tags</span>
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-labelledby={`${listId}-label`}>
          {tags.map((t) => (
            <li key={tagKey(t)} className="tag">
              <button type="button" className="link" onClick={() => go("library", { tag: tagKey(t) })} title="Ver jogos com esta tag">{t}</button>
              <button type="button" aria-label={`Remover a tag ${t}`} className="grid place-items-center text-fog hover:text-mist" onClick={() => patchGame(game.id, { tags: removeTag(game.tags, t) })}>
                <X size={11} aria-hidden />
              </button>
            </li>
          ))}
          {!tags.length && <li className="muted small">Nenhuma tag ainda.</li>}
        </ul>
        <form onSubmit={submit} className="flex gap-2">
          <input
            list={listId}
            value={draft}
            maxLength={MAX_TAG_LEN}
            disabled={tags.length >= MAX_TAGS}
            onChange={(e) => setDraft(e.currentTarget.value)}
            placeholder={tags.length >= MAX_TAGS ? "Limite de tags atingido" : "cozy, co-op, para ver com amigos…"}
            aria-label="Nova tag"
            className="min-w-0 flex-1"
          />
          <datalist id={listId}>{known.filter((k) => !tags.some((t) => tagKey(t) === k.key)).slice(0, 30).map((k) => <option key={k.key} value={k.label} />)}</datalist>
          <button className="btn" type="submit" disabled={!draft.trim() || tags.length >= MAX_TAGS}>Adicionar</button>
        </form>
        {game.owned && groups.some((x) => x.members.length > 1 && x.members.some((m) => m.id === game.id)) && <p className="muted small">Vale para todas as lojas em que você tem este jogo.</p>}
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="grid gap-1 text-[12.5px] font-semibold text-mist">
          Horas para zerar
          <input
            type="number" min={0.5} max={MAX_TO_BEAT} step={0.5} inputMode="decimal"
            value={game.hoursToBeat ?? ""}
            className="!w-28 !rounded-xl text-center tabular-nums"
            placeholder="ex.: 12"
            onChange={(e) => {
              const v = e.currentTarget.valueAsNumber;
              patchGame(game.id, { hoursToBeat: Number.isFinite(v) && v >= 0.5 ? Math.min(MAX_TO_BEAT, Math.round(v * 2) / 2) : undefined });
            }}
          />
        </label>
        <span className="muted small pb-2">
          {left === undefined ? "Você informa; nenhum site é consultado." : left === 0 ? "Estimativa já cumprida." : `Faltam ~${left.toLocaleString("pt-BR")} h.`}
        </span>
        {canQueue && (
          <button
            type="button" className="btn ml-auto" aria-pressed={queued}
            onClick={() => patchGame(game.id, { queuedAt: queued ? undefined : nextSlot(groups) })}
          >
            {queued ? <><ListX size={15} aria-hidden /> Tirar da fila</> : <><ListPlus size={15} aria-hidden /> Colocar na fila</>}
          </button>
        )}
      </div>
    </section>
  );
}
