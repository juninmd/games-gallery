import { useEffect } from "react";
import { newlyPressed, padActions, type PadAction } from "../domain/gamepad";
import { pickNext, type Direction } from "../domain/spatialNav";
import { useUi } from "../state/ui";

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const visible = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
};

/** Focus scope: the open modal dialog when there is one, so the controller never leaves it. */
const scope = (): ParentNode => document.querySelector("dialog[open]") ?? document;

function move(dir: Direction) {
  const els = [...scope().querySelectorAll<HTMLElement>(FOCUSABLE)].filter(visible);
  const current = document.activeElement instanceof HTMLElement && els.includes(document.activeElement) ? document.activeElement : null;
  if (!current) return els[0]?.focus({ focusVisible: true } as FocusOptions);
  const box = (el: HTMLElement) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  const others = els.filter((el) => el !== current);
  const next = others[pickNext(box(current), others.map(box), dir)];
  if (!next) return;
  next.focus({ focusVisible: true } as FocusOptions);
  next.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function back() {
  const ui = useUi.getState();
  const dialog = document.querySelector<HTMLDialogElement>("dialog[open]");
  if (dialog) return dialog.dispatchEvent(new Event("cancel", { cancelable: true })) && dialog.close();
  if (ui.selectedId) return ui.select(null);
  if (ui.addOpen) return ui.setAddOpen(false);
}

function run(action: PadAction) {
  if (action === "confirm") return (document.activeElement as HTMLElement | null)?.click();
  if (action === "back") return back();
  if (action === "menu") return useUi.getState().setPaletteOpen(!useUi.getState().paletteOpen);
  move(action);
}

/** Standard-mapping controllers drive focus like arrow keys: D-pad/stick move, A clicks, B goes back, Start opens the palette. */
export function useGamepad() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("getGamepads" in navigator)) return;
    let frame = 0;
    let prev = new Set<PadAction>();
    const tick = () => {
      const pads = navigator.getGamepads().filter((p): p is Gamepad => !!p && p.connected);
      if (!pads.length) { frame = 0; prev = new Set(); return; }
      const curr = new Set(pads.flatMap((p) => [...padActions({ pressed: p.buttons.map((b) => b.pressed), axes: [...p.axes] })]));
      if (document.hasFocus()) newlyPressed(prev, curr).forEach(run);
      prev = curr;
      frame = requestAnimationFrame(tick);
    };
    const onConnect = (e: GamepadEvent) => {
      if (!frame) frame = requestAnimationFrame(tick);
      const ui = useUi.getState();
      if (!ui.tvMode) ui.toast(`Controle conectado (${e.gamepad.id.slice(0, 40)}). O modo TV fica em Ajustes.`);
    };
    window.addEventListener("gamepadconnected", onConnect);
    if (navigator.getGamepads().some(Boolean)) frame = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("gamepadconnected", onConnect);
      cancelAnimationFrame(frame);
    };
  }, []);
}
