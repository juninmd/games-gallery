import { ExternalLink, Tag } from "lucide-react";
import { useState } from "react";
import { formatMoney } from "../domain/deals";
import { openExternal } from "../platform/runtime";
import { useUi } from "../state/ui";

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
  owned?: boolean;
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
          {onSale && <span className="tag ok">-{p.discountPercent}%</span>}{" "}
          {onSale && <s className="muted">{formatMoney(p.originalCents, p.currency)}</s>}{" "}
          <b>{p.finalCents === undefined ? "—" : p.finalCents === 0 ? "Grátis" : formatMoney(p.finalCents, p.currency)}</b>
        </span>
        {p.note && <span className="muted small">{p.note}</span>}
        <div className="freebie-actions">
          <button className="btn" onClick={open} aria-label={`Abrir na loja: ${p.title}`}><ExternalLink size={13} aria-hidden /> Abrir na loja</button>
          {p.owned && <span className="tag ok">Na biblioteca</span>}
        </div>
      </div>
    </article>
  );
}
