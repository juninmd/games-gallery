import { Bell } from "lucide-react";
import { isTauri } from "../platform/runtime";
import { usePrefs } from "../state/prefs";
import { usePriceAlerts } from "../state/priceAlerts";
import { useUi } from "../state/ui";

/** Opt-in OS notifications. Checks run only while the app is open (every few hours); nothing runs in the background. */
export function NotificationSettings() {
  const on = usePrefs((s) => s.notifications);
  const setNotifications = usePrefs((s) => s.setNotifications);
  const targets = Object.keys(usePriceAlerts((s) => s.targets)).length;
  const toast = useUi((s) => s.toast);
  const native = isTauri();

  const change = async (next: boolean) => {
    const ok = await setNotifications(next);
    if (next && !ok) toast(native ? "O sistema não liberou notificações para o app." : "Notificações do sistema só funcionam no app instalado.");
  };

  return (
    <section className="panel narrow" aria-label="Notificações">
      <h3 aria-level={2}>Notificações</h3>
      <label className="inline-flex cursor-pointer items-center gap-2.5">
        <input type="checkbox" checked={on} disabled={!native} onChange={(e) => void change(e.currentTarget.checked)} />
        <Bell size={15} aria-hidden /> Avisar pelo sistema
      </label>
      <p className="muted small">
        Avisa quando um jogo com preço-alvo ({targets} {targets === 1 ? "definido" : "definidos"}) chega ao preço e quando a Epic libera um jogo grátis novo.
        O app confere ao abrir e depois com ele aberto (preços a cada 3 horas, jogos grátis a cada 6); fechado, nada é verificado.
        {!native && " Disponível apenas no app instalado."}
      </p>
    </section>
  );
}
