import { PROVIDER_BY_ID } from "../domain/providers";
import type { Game } from "../domain/types";

/** "Epic Games Store" -> "Epic": a card footer has room for first words only. */
export const storeShort = (providerId: string) => (PROVIDER_BY_ID[providerId]?.name ?? providerId).split(/[\s/]+/)[0]!;

/** Names every store that owns a game, primary first; collapses long lists into "+N". */
export function storeSummary(members: Game[], max = 3): { names: string[]; more: number } {
  const names = [...new Set(members.map((m) => storeShort(m.providerId)))];
  return { names: names.slice(0, max), more: Math.max(0, names.length - max) };
}

/** A colored dot per store, with the store name: compact enough for a card footer. */
export function StoreChips({ members }: { members: Game[] }) {
  const providers = [...new Set(members.map((m) => m.providerId))];
  const { names, more } = storeSummary(members);
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-fog" title={providers.map((p) => PROVIDER_BY_ID[p]?.name ?? p).join(", ")}>
      <span className="flex shrink-0 -space-x-1" aria-hidden>
        {providers.slice(0, 4).map((p) => (
          <i key={p} className="size-2.5 rounded-full ring-2 ring-ink-950" style={{ background: PROVIDER_BY_ID[p]?.color ?? "#777" }} />
        ))}
      </span>
      <span className="truncate">{names.join(" · ")}{more > 0 && ` +${more}`}</span>
    </span>
  );
}
