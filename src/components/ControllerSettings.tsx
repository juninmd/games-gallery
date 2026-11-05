import { Gamepad2 } from "lucide-react";
import { usePrefs } from "../state/prefs";

/** Opt-in controller navigation. Off by default so a controller left connected never presses buttons by surprise. */
export function ControllerSettings() {
  const on = usePrefs((s) => s.gamepadNav);
  const setOn = usePrefs((s) => s.setGamepadNav);

  return (
    <section className="panel narrow" aria-label="Controle">
      <h3 aria-level={2}>Controle (gamepad)</h3>
      <label className="inline-flex cursor-pointer items-center gap-2.5">
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.currentTarget.checked)} />
        <Gamepad2 size={15} aria-hidden /> Navegar com o controle
      </label>
      <p className="muted small">
        Direcional ou analógico esquerdo move o foco, A (X no PlayStation) aciona e B volta ou fecha. Só age com o app em primeiro plano.
        Os botões de desinstalar, remover da biblioteca e limpar biblioteca ficam fora do alcance do controle: use mouse ou teclado para eles.
      </p>
    </section>
  );
}
