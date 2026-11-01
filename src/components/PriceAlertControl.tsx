import { Bell, BellRing, X } from "lucide-react";
import { useState } from "react";
import { formatMoney } from "../domain/deals";
import { parseTarget, targetKey } from "../domain/priceAlerts";
import { usePriceAlerts } from "../state/priceAlerts";
import { useUi } from "../state/ui";

/** "Avisar abaixo de R$ X" for a title, in the currency the store charges. Stored on this device only. */
export function PriceAlertControl({ title, currency }: { title: string; currency: string }) {
  const target = usePriceAlerts((s) => (Object.hasOwn(s.targets, targetKey(title)) ? s.targets[targetKey(title)] : undefined));
  const setTarget = usePriceAlerts((s) => s.setTarget);
  const clearTarget = usePriceAlerts((s) => s.clearTarget);
  const toast = useUi((s) => s.toast);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");

  const save = () => {
    const cents = parseTarget(text);
    if (cents === undefined) {
      toast("Preço inválido. Exemplo: 49,90");
      return;
    }
    setTarget(title, cents, currency);
    setEditing(false);
    setText("");
    toast(`Aviso definido: ${title} abaixo de ${formatMoney(cents, currency)}`);
  };

  if (editing) {
    return (
      <form className="flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label className="sr-only" htmlFor={`alert-${targetKey(title)}`}>Preço-alvo de {title}</label>
        <input id={`alert-${targetKey(title)}`} autoFocus inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} placeholder="49,90" className="!m-0 !w-24 !py-1.5 text-sm" />
        <button type="submit" className="btn">Salvar</button>
        <button type="button" className="btn ghost" aria-label="Cancelar" onClick={() => setEditing(false)}><X size={14} aria-hidden /></button>
      </form>
    );
  }
  return target ? (
    <button type="button" className="btn ghost" title="Remover o aviso de preço" aria-label={`Remover aviso de ${title}`} onClick={() => clearTarget(title)}>
      <BellRing size={13} aria-hidden /> Abaixo de {formatMoney(target.cents, target.currency)} <X size={12} aria-hidden />
    </button>
  ) : (
    <button type="button" className="btn ghost" aria-label={`Avisar quando ${title} baixar de preço`} onClick={() => setEditing(true)}>
      <Bell size={13} aria-hidden /> Avisar
    </button>
  );
}
