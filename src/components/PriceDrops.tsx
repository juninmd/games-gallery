import { useMemo } from "react";
import { formatMoney } from "../domain/deals";
import { priceDrops } from "../domain/priceHistory";
import { usePriceHistory } from "../state/priceHistory";

const STORE = { steam: "Steam", gog: "GOG", epic: "Epic" } as Record<string, string>;
const MAX_SHOWN = 8;

/** Offers whose price fell since the visit before this one, from the prices this app recorded itself. */
export function PriceDrops() {
  const entries = usePriceHistory((s) => s.entries);
  const since = usePriceHistory((s) => s.prevVisitDay);
  const drops = useMemo(() => priceDrops(entries, since), [entries, since]);
  if (!drops.length) return null;

  return (
    <section className="section-group" aria-label="Preços que caíram">
      <div className="section-head"><h2>Caíram desde a última visita ({drops.length})</h2></div>
      <p className="muted small">Comparação com o que o app viu antes; o histórico só começa na primeira vez que as ofertas foram consultadas aqui.</p>
      <ul className="plain">
        {drops.slice(0, MAX_SHOWN).map((d) => (
          <li key={d.key}>
            <strong>{d.title}</strong> <span className="muted">({STORE[d.store] ?? d.store})</span>{" "}
            <s className="muted">{formatMoney(d.from, d.currency)}</s> → <b>{d.to === 0 ? "Grátis" : formatMoney(d.to, d.currency)}</b>{" "}
            <span className="tag ok">-{Math.round(((d.from - d.to) / d.from) * 100)}%</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
