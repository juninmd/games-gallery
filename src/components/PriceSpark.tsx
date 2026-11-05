import { formatMoney } from "../domain/deals";
import { lowestSeen, type PriceEntry } from "../domain/priceHistory";

const W = 120;
const H = 30;
const PAD = 3;
const DAY_MS = 86_400_000;
const date = (day: number) => new Date(day * DAY_MS).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

/** Step chart of the prices this app has seen for one offer; the lowest point is marked. Needs two points to say anything. */
export function PriceSpark({ entry, currency }: { entry: PriceEntry; currency: string }) {
  const pts = entry.points;
  if (pts.length < 2) return null;
  const days = pts.map((p) => p[0]);
  const cents = pts.map((p) => p[1]);
  const d0 = Math.min(...days), d1 = Math.max(...days, d0 + 1);
  const lo = Math.min(...cents), hi = Math.max(...cents, lo + 1);
  const x = (d: number) => PAD + ((d - d0) / (d1 - d0)) * (W - 2 * PAD);
  const y = (c: number) => H - PAD - ((c - lo) / (hi - lo)) * (H - 2 * PAD);
  // Horizontal until the next change, then vertical: a price holds until it moves.
  const path = pts.map(([d, c], i) => (i === 0 ? `M${x(d)} ${y(c)}` : `H${x(d)}V${y(c)}`)).join("") + `H${W - PAD}`;
  const low = lowestSeen(entry)!;
  const label = `Preços vistos pelo app, de ${date(d0)} a ${date(d1)}: de ${formatMoney(Math.max(...cents), currency)} a ${formatMoney(lo, currency)}; menor em ${date(low.day)}.`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label} className="text-aurora">
      <title>{label}</title>
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx={x(low.day)} cy={y(low.cents)} r="2.6" fill="currentColor" />
    </svg>
  );
}
