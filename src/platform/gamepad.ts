import { blockedForGamepad, dirFromAxes, pickNext, type Dir } from "../domain/gamepadNav";

const REPEAT_MS = 190;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [role="tab"], [role="radio"], [tabindex]:not([tabindex="-1"])';
// Standard mapping: 0 = A, 1 = B, 12-15 = d-pad.
const DPAD: [number, Dir][] = [[12, "up"], [13, "down"], [14, "left"], [15, "right"]];

function visible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(el).visibility !== "hidden";
}

/** An open modal dialog traps the cursor; otherwise the whole page is in play. */
function scope(): ParentNode {
  return document.querySelector("dialog[open]") ?? document;
}

function move(dir: Dir): void {
  const all = [...scope().querySelectorAll<HTMLElement>(FOCUSABLE)].filter((e) => visible(e) && !blockedForGamepad(e));
  if (!all.length) return;
  const active = document.activeElement instanceof HTMLElement && all.includes(document.activeElement) ? document.activeElement : null;
  if (!active) { all[0]!.focus(); return; }
  const others = all.filter((e) => e !== active);
  const box = (e: HTMLElement) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
  const n = pickNext(box(active), others.map(box), dir);
  const target = n >= 0 ? others[n] : undefined;
  if (target) { target.focus(); target.scrollIntoView({ block: "nearest", inline: "nearest" }); }
}

function press(name: "confirm" | "back"): void {
  if (name === "confirm") {
    const el = document.activeElement;
    // Never fire destructive controls, even if the focus got there by other means (mouse, keyboard).
    if (el instanceof HTMLElement && el !== document.body && !blockedForGamepad(el)) el.click();
    return;
  }
  const dialog = document.querySelector<HTMLDialogElement>("dialog[open]");
  if (dialog) dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
  else document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
}

/**
 * Lets a controller drive the UI: d-pad or left stick moves focus spatially, A activates, B backs out.
 * Opt-in (see Ajustes): with it off nothing here runs, so a controller left connected cannot drive the app.
 * Polling runs only while a pad is connected, and does nothing until a button is touched.
 * Returns a stop function.
 */
export function startGamepadNav(): () => void {
  if (typeof window === "undefined" || typeof navigator.getGamepads !== "function") return () => undefined;
  let raf = 0;
  let last = 0;
  const held = new Map<string, boolean>();

  const tick = (now: number) => {
    const pad = [...navigator.getGamepads()].find((p): p is Gamepad => p !== null && p.connected);
    if (!pad) { raf = 0; return; }
    // A window that is visible but not in front (a game is running) still receives pad input in some runtimes; ignore it,
    // but keep tracking buttons so a key held while focus returns does not fire.
    const front = document.hasFocus();
    const dir = DPAD.find(([b]) => pad.buttons[b]?.pressed)?.[1] ?? dirFromAxes(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
    if (front && dir && now - last >= REPEAT_MS) { last = now; move(dir); }
    for (const [key, index, action] of [["a", 0, "confirm"], ["b", 1, "back"]] as const) {
      const down = Boolean(pad.buttons[index]?.pressed);
      if (front && down && !held.get(key)) press(action);
      held.set(key, down);
    }
    raf = requestAnimationFrame(tick);
  };
  const start = () => { if (!raf) raf = requestAnimationFrame(tick); };

  window.addEventListener("gamepadconnected", start);
  start();
  return () => {
    window.removeEventListener("gamepadconnected", start);
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
}
