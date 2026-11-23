import { WifiOff } from "lucide-react";
import { useSyncExternalStore } from "react";
import { offlineNow, subscribeNetStatus } from "../../platform/netStatus";

/** Shows after two network failures in a row; what is already on screen stays as it is. */
export function OfflineBanner() {
  const offline = useSyncExternalStore(subscribeNetStatus, offlineNow, () => false);
  if (!offline) return null;
  return (
    <div className="offline-banner" role="status">
      <WifiOff size={15} aria-hidden />
      <span>Sem conexão. Mostrando os dados salvos; o app tenta de novo na próxima atualização.</span>
    </div>
  );
}
