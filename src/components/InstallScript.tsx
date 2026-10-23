import { ClipboardList } from "lucide-react";
import { useMemo, useState } from "react";
import { EMULATORS } from "../domain/emulators";
import { emulatorUsage } from "../domain/emulatorUsage";
import { MANAGER_LABEL, type Manager, hostOs, installScript } from "../domain/install";
import { copyText } from "../platform/clipboard";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";

const MANAGERS = Object.keys(MANAGER_LABEL) as Manager[];
const DEFAULT: Record<string, Manager> = { windows: "winget", macos: "brew", linux: "flatpak" };

/** One script with every emulator the library needs and the user has not installed. */
export function InstallScript() {
  const games = useLibrary((s) => s.games);
  const installed = useLibrary((s) => s.emulators);
  const toast = useUi((s) => s.toast);
  const [manager, setManager] = useState<Manager>(DEFAULT[hostOs(typeof navigator === "undefined" ? "" : navigator.userAgent)] ?? "winget");

  const missing = useMemo(() => {
    const usage = emulatorUsage(games);
    return EMULATORS.filter((e) => usage[e.id] && !installed[e.id]);
  }, [games, installed]);

  const copy = async () => {
    const ok = await copyText(installScript(missing, manager));
    toast(ok ? `Script copiado (${missing.length} emuladores)` : "Não foi possível copiar o script");
  };

  return (
    <div className="inline install-script">
      <select aria-label="Gerenciador de pacotes" value={manager} onChange={(e) => setManager(e.target.value as Manager)}>
        {MANAGERS.map((m) => <option key={m} value={m}>{MANAGER_LABEL[m]}</option>)}
      </select>
      <button className="btn" disabled={!missing.length} onClick={copy}>
        <ClipboardList size={14} aria-hidden /> Copiar script dos que faltam ({missing.length})
      </button>
    </div>
  );
}
