import { ToastProvider } from "@juninmd/sonido";
import { LazyMotion, MotionConfig } from "motion/react";
import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { AddGameModal } from "./components/AddGameModal";
import { CommandPalette } from "./components/CommandPalette";
import { GameDrawer } from "./components/GameDrawer";
import { Toasts } from "./components/Overlays";
import { ShortcutsHelp } from "./components/ShortcutsHelp";
import { LoadError, SkeletonGrid } from "./components/states";
import { isCentral } from "./components/nav";
import { AmbientBackdrop } from "./components/shell/AmbientBackdrop";
import { CentralTabs } from "./components/shell/CentralTabs";
import { MainNav } from "./components/shell/MainNav";
import { DropImport } from "./components/shell/DropImport";
import { Intro } from "./components/shell/Intro";
import { OfflineBanner } from "./components/shell/OfflineBanner";
import { TitleBar } from "./components/shell/TitleBar";
import { TopBar } from "./components/shell/TopBar";
import { useShellLayout } from "./components/shell/useShellLayout";
import { useUrlState } from "./components/shell/useUrlState";
import { useViewFocus } from "./components/shell/useViewFocus";
import { useLibrary, whenHydrated } from "./state/library";
import { watchPriceAlerts } from "./state/alertWatcher";
import { watchSessions } from "./state/sessions";
import { useSecrets } from "./state/secrets";
import { useUpdates } from "./state/updates";
import { isTauri } from "./platform/runtime";
import { useUi, type View } from "./state/ui";
import { useGamepad } from "./components/useGamepad";
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
    if (this.state.failed) return <LoadError title="Não foi possível carregar esta tela." reason="Verifique se o app foi atualizado e tente de novo." onRetry={this.props.onRetry} />;
    return this.props.children;
  }
}

function CurrentView() {
  const view = useUi((s) => s.view);
  const tvMode = useUi((s) => s.tvMode);
  const theme = useUi((s) => s.theme);
  useGamepad();
  useEffect(() => { document.documentElement.classList.toggle("tv-mode", tvMode); }, [tvMode]);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const [attempt, setAttempt] = useState(0);
  const loader = loaders[view];
  const LazyView = useMemo(() => loader ? lazy(loader) : null, [loader, attempt]);

  if (view === "library") return <GameBrowser scope="all" />;
  if (view === "installed") return <GameBrowser scope="installed" />;
  if (!LazyView) return null;

  return <ViewLoadBoundary key={`${view}:${attempt}`} onRetry={() => setAttempt((n) => n + 1)}>
    <Suspense fallback={<SkeletonGrid count={8} label="Carregando tela…" />}>
      <LazyView />
    </Suspense>
  </ViewLoadBoundary>;
}

export function App() {
  const view = useUi((s) => s.view);
  const stage = useRef<HTMLDivElement>(null);
  const layout = useShellLayout();
  useUrlState();
  useViewFocus(view, stage);

  // Real data on first paint: executables on disk, then the launchers' libraries when empty.
  useEffect(() => {
    if (booted) return;
    booted = true;
    void useSecrets.getState().hydrate().then(watchPriceAlerts);
    // The library loads from disk asynchronously in the app: only detect once it is known to be empty.
    whenHydrated(() => {
      const library = useLibrary.getState();
      void library.refreshEmulators();
      if (!library.games.length) void library.detect();
    });
    void watchSessions();
    // Installed app only: look for a newer GitHub release a few seconds after the window opens.
    if (isTauri()) setTimeout(() => void useUpdates.getState().check({ auto: true }), 5000);
  }, []);

  return (
    // "user": springs and layout animations honor the OS reduced-motion setting, like the CSS.
    <MotionConfig reducedMotion="user">
    <LazyMotion features={loadMotionFeatures} strict>
    <ToastProvider>
    <div className="app" data-layout={layout} data-frame={isTauri() ? "custom" : undefined}>
      <AmbientBackdrop />
      <TitleBar />
      <main className="main">
        <TopBar />
        <OfflineBanner />
        <div className="stage" ref={stage}>
          {isCentral(view) && <CentralTabs />}
          <div className="view-enter" key={view}><CurrentView /></div>
        </div>
      </main>
      <MainNav />
      <GameDrawer />
      <AddGameModal />
      <CommandPalette />
      <ShortcutsHelp />
      <Toasts />
      <DropImport />
      <Intro />
    </div>
    </ToastProvider>
    </LazyMotion>
    </MotionConfig>
  );
}
