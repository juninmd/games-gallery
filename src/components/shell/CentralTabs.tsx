import { Tabs } from "@juninmd/sonido";
import { useUi, type View } from "../../state/ui";
import { CENTRAL_VIEWS, NAV_GROUPS } from "../nav";
import { withViewTransition } from "./ambient";

const ITEMS = NAV_GROUPS.flatMap((g) => g.items).filter((n) => CENTRAL_VIEWS.includes(n.view))
  .sort((a, b) => CENTRAL_VIEWS.indexOf(a.view) - CENTRAL_VIEWS.indexOf(b.view))
  .map((n) => ({ key: n.view, label: n.label, icon: n.icon }));

/** The system screens live together in the Central; these tabs switch between them. */
export function CentralTabs() {
  const view = useUi((s) => s.view);
  const go = useUi((s) => s.go);
  const open = (next: View) => next !== view && withViewTransition(() => go(next));

  return (
    <nav className="central-tabs" aria-label="Central do sistema">
      <Tabs label="Telas da Central" variant="pill" items={ITEMS} value={view} onChange={open} />
    </nav>
  );
}
