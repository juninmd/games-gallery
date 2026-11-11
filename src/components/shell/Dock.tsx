import { m } from "motion/react";
import { Fragment, useEffect, useMemo, useRef, type PointerEvent } from "react";
import { groupGames } from "../../domain/duplicates";
import { useLibrary } from "../../state/library";
import { usePriceAlerts } from "../../state/priceAlerts";
import { useUi, type View } from "../../state/ui";
import { useUpdates } from "../../state/updates";
import { CENTRAL_VIEWS, DOCK_GROUPS, DOCK_ITEMS, isCentral } from "../nav";
import { prefersReducedMotion, withViewTransition } from "./ambient";

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/** The Central reopens on the system screen used last. */
let lastCentral: View = "connections";

/** Floating dock: magnifies under the pointer (macOS style), a sliding pill marks the screen, keys 1–8 jump. */
export function Dock() {
  const view = useUi((s) => s.view);
  const go = useUi((s) => s.go);
  const games = useLibrary((s) => s.games);
  const alertCount = usePriceAlerts((s) => s.hits.length);
  const updateReady = useUpdates((s) => s.phase === "available");
  const ref = useRef<HTMLElement>(null);

  if (isCentral(view)) lastCentral = view;

  const counts = useMemo<Partial<Record<View, number>>>(() => {
    const groups = groupGames(games);
    return {
      board: groups.filter((x) => x.primary.status === "backlog" || x.primary.status === "wishlist").length,
      ...(alertCount ? { deals: alertCount } : {}),
    };
  }, [games, alertCount]);

  const open = (target: View) => {
    const next = target === "connections" ? lastCentral : target;
    if (next === view) return;
    withViewTransition(() => go(next));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || document.querySelector("dialog[open]")) return;
      const i = Number(e.key);
      const item = Number.isInteger(i) && i >= 1 ? DOCK_ITEMS[i - 1] : undefined;
      if (!item) return;
      e.preventDefault();
      open(item.view);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Writes the scale straight to each icon: no React render per pointer move.
  const magnify = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse" || prefersReducedMotion()) return;
    for (const b of ref.current?.querySelectorAll<HTMLElement>(".dock-item") ?? []) {
      const r = b.getBoundingClientRect();
      const d = Math.abs(e.clientX - (r.left + r.width / 2));
      b.style.setProperty("--s", Math.max(1, 1.45 - d / 150).toFixed(3));
    }
  };
  const settle = () => ref.current?.querySelectorAll<HTMLElement>(".dock-item").forEach((b) => b.style.setProperty("--s", "1"));

  return (
    <div className="dock-wrap">
      <nav ref={ref} className="dock" aria-label="Navegação principal" onPointerMove={magnify} onPointerLeave={settle}>
        {DOCK_GROUPS.map((group, gi) => (
          <Fragment key={gi}>
            {gi > 0 && <span className="dock-sep" aria-hidden />}
            {group.map((item) => {
              const active = item.view === "connections" ? isCentral(view) : view === item.view;
              const index = DOCK_ITEMS.indexOf(item) + 1;
              const count = counts[item.view];
              const label = item.view === "connections" ? `Central: ${CENTRAL_VIEWS.length} telas do sistema` : item.label;
              return (
                <button
                  key={item.view}
                  type="button"
                  className="dock-item"
                  aria-label={`${label} (tecla ${index})`}
                  aria-current={active ? "page" : undefined}
                  onClick={() => open(item.view)}
                >
                  {active && <m.span layoutId="dock-pill" className="dock-pill" transition={{ type: "spring", stiffness: 480, damping: 36 }} />}
                  <span className="dock-icon">{item.icon}</span>
                  {count !== undefined && count > 0 && <span className="dock-count">{count > 99 ? "99+" : count}</span>}
                  {item.view === "connections" && updateReady && <span className="dock-dot" title="Nova versão disponível" />}
                  <span className="dock-label" aria-hidden>{item.label}<kbd>{index}</kbd></span>
                </button>
              );
            })}
          </Fragment>
        ))}
      </nav>
    </div>
  );
}
