import { LazyMotion } from "motion/react";
import { Component, lazy, Suspense, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from "react";
import { AddGameModal } from "./components/AddGameModal";
import { CommandPalette } from "./components/CommandPalette";
import { GameDrawer } from "./components/GameDrawer";
import { Toasts } from "./components/Overlays";
import { ShortcutsHelp } from "./components/ShortcutsHelp";
import { isCentral } from "./components/nav";
import { Ambient } from "./components/shell/Ambient";
import { CentralTabs } from "./components/shell/CentralTabs";
import { Dock } from "./components/shell/Dock";
import { Intro } from "./components/shell/Intro";
import { TopBar } from "./components/shell/TopBar";
import { useLibrary } from "./state/library";
import { watchPriceAlerts } from "./state/alertWatcher";
import { useSecrets } from "./state/secrets";
import { useUpdates } from "./state/updates";
import { isTauri } from "./platform/runtime";
import { useUi, type View } from "./state/ui";
import { GameBrowser } from "./views/GameBrowser";

// Animation features load after first paint so they stay out of the entry chunk.
const loadMotionFeatures = () => import("./motionFeatures").then((m) => m.default);

/** StrictMode mounts effects twice in dev; detection should read the disk once per session. */
let booted = false;

type Loader = () => Promise<{ default: React.ComponentType }>;
const loaders: Partial<Record<View, Loader>> = {
  board: () => import("./views/BoardView").then((m) => ({ default: m.BoardView })),
  platforms: () => import("./views/PlatformsView").then((m) => ({ default: m.PlatformsView })),
  folders: () => import("./views/FoldersView").then((m) => ({ default: m.FoldersView })),
  deals: () => import("./views/DealsView").then((m) => ({ default: m.DealsView })),
  connections: () => import("./views/ConnectionsView").then((m) => ({ default: m.ConnectionsView })),
  freebies: () => import("./views/FreebiesView").then((m) => ({ default: m.FreebiesView })),
  providers: () => import("./views/ProvidersView").then((m) => ({ default: m.ProvidersView })),
  emulators: () => import("./views/EmulatorsView").then((m) => ({ default: m.EmulatorsView })),
  stats: () => import("./views/StatsView").then((m) => ({ default: m.StatsView })),
  settings: () => import("./views/SettingsView").then((m) => ({ default: m.SettingsView })),
};

class ViewLoadBoundary extends Component<{ onRetry: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.error("Falha ao carregar esta tela", error);
  }

  render() {
    if (this.state.failed) return <section className="empty" role="alert">
      <p>Não foi possível carregar esta tela.</p>
      <button className="btn" onClick={this.props.onRetry}>Tentar novamente</button>
    </section>;
    return this.props.children;
  }
}

function CurrentView() {
  const view = useUi((s) => s.view);
  const [attempt, setAttempt] = useState(0);
  const loader = loaders[view];
  const LazyView = useMemo(() => loader ? lazy(loader) : null, [loader, attempt]);

  if (view === "library") return <GameBrowser scope="all" />;
  if (view === "installed") return <GameBrowser scope="installed" />;
  if (!LazyView) return null;

  return <ViewLoadBoundary key={`${view}:${attempt}`} onRetry={() => setAttempt((n) => n + 1)}>
    <Suspense fallback={<p className="empty" role="status">Carregando tela…</p>}>
      <LazyView />
    </Suspense>
  </ViewLoadBoundary>;
}

export function App() {
  const view = useUi((s) => s.view);

  // Real data on first paint: executables on disk, then the launchers' libraries when empty.
  useEffect(() => {
    if (booted) return;
    booted = true;
    void useSecrets.getState().hydrate().then(watchPriceAlerts);
    const library = useLibrary.getState();
    void library.refreshEmulators();
    if (!library.games.length) void library.detect();
    // Installed app only: look for a newer GitHub release a few seconds after the window opens.
    if (isTauri()) setTimeout(() => void useUpdates.getState().check({ auto: true }), 5000);
  }, []);

  return (
    <LazyMotion features={loadMotionFeatures} strict>
    <div className="app">
      <Ambient />
      <main className="main">
        <TopBar />
        <div className="stage">
          {isCentral(view) && <CentralTabs />}
          <div className="view-enter" key={view}><CurrentView /></div>
        </div>
      </main>
      <Dock />
      <GameDrawer />
      <AddGameModal />
      <CommandPalette />
      <ShortcutsHelp />
      <Toasts />
      <Intro />
    </div>
    </LazyMotion>
  );
}
