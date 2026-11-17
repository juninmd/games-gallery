import type { StoreRelease, WishlistEntry } from "./deals";

export interface CalendarGroup {
  /** "2026-11", "2026-Q4", "2026" or "tba": sorts chronologically within the same year. */
  key: string;
  label: string;
  items: { entry: WishlistEntry; when: string }[];
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Calendar parts in UTC: Steam stores planned dates as midnight-ish UTC timestamps. */
function parts(seconds: number) {
  const d = new Date(seconds * 1000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), day: d.getUTCDate() };
}

/** Group key, group label and per-game label, at the precision Steam publishes. */
function bucket(r: StoreRelease): { key: string; label: string; when: string } {
  if (!r.date || r.display?.startsWith("text")) {
    return { key: "tba", label: "Sem data", when: r.message ?? "Em breve" };
  }
  const { y, m, day } = parts(r.date);
  if (r.display === "date_year") return { key: `${y}`, label: `${y}`, when: `${y}` };
  if (r.display === "date_quarter") {
    const q = Math.floor(m / 3) + 1;
    return { key: `${y}-Q${q}`, label: `${q}º tri ${y}`, when: `${q}º tri ${y}` };
  }
  const key = `${y}-${String(m + 1).padStart(2, "0")}`;
  const label = `${MONTHS[m]} ${y}`;
  return { key, label, when: r.display === "date_month" ? label : `${day} ${MONTHS[m]}` };
}

/** Less precise groups follow the months they cover (quarter after its last month, year at its end); undated last. */
const order = (key: string) => (key === "tba" ? "~" : key.length === 4 ? `${key}-~` : key.replace(/-Q(\d)/, (_, q) => `-${String(Number(q) * 3).padStart(2, "0")}~`));

/** Unreleased wishlist games grouped by planned release, soonest first. */
export function releaseCalendar(entries: WishlistEntry[]): CalendarGroup[] {
  const groups = new Map<string, CalendarGroup>();
  for (const entry of entries) {
    if (!entry.release?.comingSoon) continue;
    const { key, label, when } = bucket(entry.release);
    const group = groups.get(key) ?? { key, label, items: [] };
    group.items.push({ entry, when });
    groups.set(key, group);
  }
  for (const g of groups.values()) g.items.sort((a, b) => (a.entry.release?.date ?? Infinity) - (b.entry.release?.date ?? Infinity) || a.entry.title.localeCompare(b.entry.title));
  return [...groups.values()].sort((a, b) => (order(a.key) < order(b.key) ? -1 : 1));
}
