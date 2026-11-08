import { HandCoins, Tag, X } from "lucide-react";
import { useMemo, useState } from "react";
import { addTag, canLend, loanDays, MAX_LOAN_NAME, MAX_TAG_LEN, removeTag, tagCounts } from "../domain/collection";
import type { Game } from "../domain/types";
import { useLibrary } from "../state/library";

const chip = "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-all duration-200 ease-expo active:scale-95";
const off = "border-white/10 bg-white/[0.04] text-fog hover:text-mist hover:border-white/25";
const on = "border-aurora/60 bg-aurora/15 text-aurora";

function TagEditor({ game }: { game: Game }) {
  const patchGame = useLibrary((s) => s.patchGame);
  const games = useLibrary((s) => s.games);
  const [draft, setDraft] = useState("");
  const tags = game.tags ?? [];
  const suggestions = useMemo(
    () => tagCounts(games).map(([t]) => t).filter((t) => !tags.some((x) => x.toLowerCase() === t.toLowerCase())).slice(0, 8),
    [games, tags],
  );
  const add = (t: string) => {
    const patch = addTag(game, t);
    if (patch) patchGame(game.id, patch);
    setDraft("");
  };

  return (
    <div className="grid gap-2.5">
      <div className="flex flex-wrap items-center gap-2" aria-label="Tags do jogo">
        {tags.map((t) => (
          <span key={t} className={`${chip} ${on}`}>
            <Tag size={12} aria-hidden />{t}
            <button type="button" aria-label={`Remover tag ${t}`} className="-mr-1 rounded-full p-0.5 hover:bg-white/10" onClick={() => patchGame(game.id, removeTag(game, t))}>
              <X size={12} aria-hidden />
            </button>
          </span>
        ))}
        <form className="flex" onSubmit={(e) => { e.preventDefault(); add(draft); }}>
          <label>
            <span className="sr-only">Nova tag</span>
            <input
              value={draft} maxLength={MAX_TAG_LEN} placeholder="+ tag (Enter)"
              onChange={(e) => setDraft(e.currentTarget.value)}
              className="!w-36 !rounded-full !py-1.5 text-[12.5px]"
            />
          </label>
        </form>
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Tags usadas em outros jogos">
          {suggestions.map((t) => (
            <button key={t} type="button" className={`${chip} ${off} !py-1 text-[11.5px]`} onClick={() => add(t)}>+ {t}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function LoanEditor({ game }: { game: Game }) {
  const patchGame = useLibrary((s) => s.patchGame);
  const [to, setTo] = useState("");
  if (game.loan) {
    const days = loanDays(game.loan.since);
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[13px]">
        <span className="inline-flex items-center gap-2 text-mist">
          <HandCoins size={15} className="text-warn" aria-hidden />
          Emprestado para <b>{game.loan.to}</b> · {days === 0 ? "hoje" : `há ${days} dia${days > 1 ? "s" : ""}`}
        </span>
        <button type="button" className={`${chip} ${off}`} onClick={() => patchGame(game.id, { loan: undefined })}>Devolvido</button>
      </div>
    );
  }
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const name = to.trim();
        if (name) patchGame(game.id, { loan: { to: name, since: new Date().toISOString() } });
        setTo("");
      }}
    >
      <label className="flex-1">
        <span className="sr-only">Emprestar para</span>
        <input value={to} maxLength={MAX_LOAN_NAME} placeholder="Emprestar para…" onChange={(e) => setTo(e.currentTarget.value)} className="!rounded-full !py-1.5 text-[13px]" />
      </label>
      <button type="submit" disabled={!to.trim()} className={`${chip} ${off} disabled:opacity-40`}><HandCoins size={13} aria-hidden /> Emprestar</button>
    </form>
  );
}

export function CollectionPanel({ game }: { game: Game }) {
  return (
    <div className="grid gap-4">
      <TagEditor game={game} />
      {canLend(game) && <LoanEditor game={game} />}
    </div>
  );
}
