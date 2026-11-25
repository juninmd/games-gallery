import { Dock, NavRail } from "@juninmd/sonido";
import { useEffect, useMemo } from "react";
import { groupGames } from "../../domain/duplicates";
import { useLibrary } from "../../state/library";
import { usePriceAlerts } from "../../state/priceAlerts";
import { useUi, type View } from "../../state/ui";
import { useUpdates } from "../../state/updates";
import { CENTRAL_VIEWS, DOCK_GROUPS, DOCK_ITEMS, isCentral } from "../nav";
import { withViewTransition } from "./ambient";
import { useShellLayout } from "./useShellLayout";

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/** The Central reopens on the system screen used last. */
let lastCentral: View = "connections";

/** Navigation: Sonido's NavRail from 768px, its Dock at the bottom below; keys 1–8 jump. */
export function MainNav() {
  const view = useUi((s) => s.view);
  const go = useUi((s) => s.go);
  const games = useLibrary((s) => s.games);
  const alertCount = usePriceAlerts((s) => s.hits.length);
  const updateReady = useUpdates((s) => s.phase === "available");
  const layout = useShellLayout();

  if (isCentral(view)) lastCentral = view;
  const current: View = isCentral(view) ? "connections" : view;

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

  const label = (view: View, text: string) => (view === "connections" ? `Central: ${CENTRAL_VIEWS.length} telas do sistema` : text);

  if (layout === "tabs") {
    const items = DOCK_GROUPS.flatMap((group, gi) =>
      group.map((item, i) => ({ key: item.view, label: label(item.view, item.label), icon: item.icon, count: counts[item.view], group: gi > 0 && i === 0 })));
    return <Dock items={items} value={current} onChange={open} shortcuts={false} />;
  }

  const groups = DOCK_GROUPS.map((group) => ({
    items: group.map((item) => {
      const count = counts[item.view];
      const index = DOCK_ITEMS.indexOf(item) + 1;
      const badge = item.view === "connections" && updateReady ? "•" : count ? (count > 99 ? "99+" : count) : undefined;
      return { key: item.view, label: `${label(item.view, item.label)} (tecla ${index})`, icon: item.icon, badge };
    }),
  }));
  return <NavRail className="main-rail" groups={groups} value={current} onChange={open} compact label="Navegação principal" />;
}
