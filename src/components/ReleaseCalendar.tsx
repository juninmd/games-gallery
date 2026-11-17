import { CalendarDays } from "lucide-react";
import { useMemo } from "react";
import type { WishlistEntry } from "../domain/deals";
import { releaseCalendar } from "../domain/releaseCalendar";
import { openExternal } from "../platform/runtime";

/** Unreleased Steam wishlist games by planned release month. */
export function ReleaseCalendar({ items }: { items: WishlistEntry[] }) {
  const groups = useMemo(() => releaseCalendar(items), [items]);
  if (!groups.length) return null;
  return (
    <section className="grid gap-3" aria-labelledby="release-calendar-title">
      <h3 id="release-calendar-title" className="flex items-center gap-2"><CalendarDays size={16} aria-hidden /> Calendário de lançamentos</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <section key={g.key} className="glass grid content-start gap-2 rounded-2xl p-4" aria-label={g.label}>
            <h4 className="m-0 font-display text-sm font-semibold capitalize text-mist">{g.label}</h4>
            <ul className="m-0 grid list-none gap-1.5 p-0">
              {g.items.map(({ entry, when }) => (
                <li key={entry.appId} className="flex items-baseline justify-between gap-3 text-sm">
                  <button type="button" onClick={() => void openExternal(entry.url)} aria-label={`Abrir na loja: ${entry.title} (${when})`} className="truncate text-left text-fog hover:text-mist">{entry.title}</button>
                  <span className="muted small shrink-0 tabular-nums">{when}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
