import { Badge, Button } from "@juninmd/sonido";
import { ExternalLink, Tag } from "lucide-react";
import { useState } from "react";
import type { DealInsight } from "../domain/dealInsights";
import { endingSoon, formatMoney } from "../domain/deals";
import { openExternal } from "../platform/runtime";
import { useUi } from "../state/ui";
import { PriceAlertControl } from "./PriceAlertControl";
import { storeShort } from "./StoreChips";

export interface DealCardProps {
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
          {onSale && <Badge tone="success">-{p.discountPercent}%</Badge>}{" "}
          {onSale && <s className="muted">{formatMoney(p.originalCents, p.currency)}</s>}{" "}
          <b>{p.finalCents === undefined ? "—" : p.finalCents === 0 ? "Grátis" : formatMoney(p.finalCents, p.currency)}</b>
        </span>
        {p.note && <span className="muted small">{p.note}</span>}
        {p.insight && p.insight.elsewhere.length > 0 && (
          <span className="muted small">
            Também: {p.insight.elsewhere.map((e) => `${e.store === "epic" ? "Epic" : e.store === "gog" ? "GOG" : "Steam"} ${formatMoney(e.finalCents, e.currency)}`).join(" · ")}
          </span>
        )}
        <div className="freebie-actions">
          <Button variant="secondary" onClick={open} aria-label={`Abrir na loja: ${p.title}`}><ExternalLink size={13} aria-hidden /> Abrir na loja</Button>
          {endingSoon(p.endsAt) && <Badge tone="warning">{endingSoon(p.endsAt)}</Badge>}
          {p.insight?.cheapest && <Badge tone="success">Menor preço</Badge>}
          {p.insight && p.insight.ownedIn.length > 0 ? (
            <Badge tone="success" title="Você já tem este jogo">Você tem: {p.insight.ownedIn.map(storeShort).join(" · ")}</Badge>
          ) : (
            p.owned && <Badge tone="success">Na biblioteca</Badge>
          )}
          {p.insight?.wanted && !p.insight.ownedIn.length && <Badge>Na wishlist</Badge>}
          {p.finalCents !== undefined && !p.owned && !p.insight?.ownedIn.length && <PriceAlertControl title={p.title} currency={p.currency} />}
        </div>
      </div>
    </article>
  );
}
