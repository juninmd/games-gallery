import { ExternalLink, Tag } from "lucide-react";
import { useState } from "react";
import type { DealInsight } from "../domain/dealInsights";
import { endingSoon, formatMoney } from "../domain/deals";
import { historyKey, isLowestSeen, lowestSeen } from "../domain/priceHistory";
import { openExternal } from "../platform/runtime";
import { usePriceHistory } from "../state/priceHistory";
import { useUi } from "../state/ui";
import { PriceAlertControl } from "./PriceAlertControl";
import { PriceSpark } from "./PriceSpark";
import { storeShort } from "./StoreChips";

export interface DealCardProps {
  /** Which store the price is from; lets the card show the prices this app has seen for it. */
  store?: string;
  title: string;
  url: string;
  imageUrl?: string;
  currency: string;
  originalCents: number;
  /** Absent when the store has no price: shown as a dash, never as free. */
  finalCents?: number;
  discountPercent: number;
  /** Short line under the price, e.g. the expiry date. */
  note?: string;
  /** ISO end of the offer; within three days it earns an urgency tag. */
  endsAt?: string;
  owned?: boolean;
  /** Cross-store context: who owns it, whether it is wanted, where it is cheaper. */
  insight?: DealInsight;
}

/** One priced entry (store deal or wishlist item). Buying always happens on the store itself. */
export function DealCard(p: DealCardProps) {
  const toast = useUi((s) => s.toast);
  const [broken, setBroken] = useState(false);
  const entry = usePriceHistory((s) => (p.store ? s.entries[historyKey(p.store, p.title, p.currency)] : undefined));
  const low = lowestSeen(entry);
  const onSale = p.finalCents !== undefined && p.discountPercent > 0 && p.finalCents < p.originalCents;

  const open = async () => {
    try {
      if (!(await openExternal(p.url))) toast("Link bloqueado: endereço fora da lista permitida");
    } catch (e) {
      toast(`Não foi possível abrir: ${String(e)}`);
    }
  };

  return (
    <article className="freebie">
      <div className="freebie-art">
        {p.imageUrl && !broken ? (
          <img src={p.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        ) : (
          <span className="freebie-fallback"><Tag size={28} aria-hidden /></span>
        )}
      </div>
      <div className="freebie-body">
        <strong title={p.title}>{p.title}</strong>
        <span className="small">
          {onSale && <span className="tag ok">-{p.discountPercent}%</span>}{" "}
          {onSale && <s className="muted">{formatMoney(p.originalCents, p.currency)}</s>}{" "}
          <b>{p.finalCents === undefined ? "—" : p.finalCents === 0 ? "Grátis" : formatMoney(p.finalCents, p.currency)}</b>
        </span>
        {p.note && <span className="muted small">{p.note}</span>}
        {entry && low && entry.points.length > 1 && (
          <span className="flex flex-wrap items-center gap-2 text-fog">
            <PriceSpark entry={entry} currency={p.currency} />
            <span className="muted small">menor visto {formatMoney(low.cents, p.currency)}</span>
          </span>
        )}
        {p.insight && p.insight.elsewhere.length > 0 && (
          <span className="muted small">
            Também: {p.insight.elsewhere.map((e) => `${e.store === "epic" ? "Epic" : e.store === "gog" ? "GOG" : "Steam"} ${formatMoney(e.finalCents, e.currency)}`).join(" · ")}
          </span>
        )}
        <div className="freebie-actions">
          <button className="btn" onClick={open} aria-label={`Abrir na loja: ${p.title}`}><ExternalLink size={13} aria-hidden /> Abrir na loja</button>
          {endingSoon(p.endsAt) && <span className="tag warn">{endingSoon(p.endsAt)}</span>}
          {p.insight?.cheapest && <span className="tag ok">Menor preço</span>}
          {isLowestSeen(entry) && <span className="tag ok" title="O menor preço que este app já viu (só vale desde a primeira consulta)">Mínimo visto</span>}
          {p.insight && p.insight.ownedIn.length > 0 ? (
            <span className="tag ok" title="Você já tem este jogo">Você tem: {p.insight.ownedIn.map(storeShort).join(" · ")}</span>
          ) : (
            p.owned && <span className="tag ok">Na biblioteca</span>
          )}
          {p.insight?.wanted && !p.insight.ownedIn.length && <span className="tag">Na wishlist</span>}
          {p.finalCents !== undefined && !p.owned && !p.insight?.ownedIn.length && <PriceAlertControl title={p.title} currency={p.currency} />}
        </div>
      </div>
    </article>
  );
}
