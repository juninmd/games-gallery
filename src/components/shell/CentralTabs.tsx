import { m } from "motion/react";
import { useUi } from "../../state/ui";
import { CENTRAL_VIEWS, NAV_GROUPS } from "../nav";
import { withViewTransition } from "./ambient";

const ITEMS = NAV_GROUPS.flatMap((g) => g.items).filter((n) => CENTRAL_VIEWS.includes(n.view))
  .sort((a, b) => CENTRAL_VIEWS.indexOf(a.view) - CENTRAL_VIEWS.indexOf(b.view));

/** The system screens live together in the Central; these tabs switch between them. */
export function CentralTabs() {
  const view = useUi((s) => s.view);
  const go = useUi((s) => s.go);

  return (
    <nav className="central-tabs" aria-label="Central do sistema">
      <span className="central-eyebrow">Central</span>
      <div className="central-track">
        {ITEMS.map((n) => {
          const on = n.view === view;
          return (
            <button key={n.view} type="button" aria-current={on ? "page" : undefined} onClick={() => !on && withViewTransition(() => go(n.view))}>
              {on && <m.span layoutId="central-pill" className="central-pill" transition={{ type: "spring", stiffness: 460, damping: 36 }} />}
              <span className="central-icon">{n.icon}</span>
              <span>{n.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
