import { LazyMotion } from "motion/react";
import { Component, lazy, Suspense, useMemo, useState, type ErrorInfo, type ReactNode } from "react";
import { AddGameModal } from "./components/AddGameModal";
import { CommandPalette } from "./components/CommandPalette";
import { GameDrawer } from "./components/GameDrawer";
import { Toasts } from "./components/Overlays";
import { Sidebar } from "./components/Sidebar";
import { useCompactSidebar } from "./components/useCompactSidebar";
import { useUi, type View } from "./state/ui";
import { GameBrowser } from "./views/GameBrowser";

// Animation features load after first paint so they stay out of the entry chunk.
const loadMotionFeatures = () => import("./motionFeatures").then((m) => m.default);

type Loader = () => Promise<{ default: React.ComponentType }>;
const loaders: Partial<Record<View, Loader>> = {
  board: () => import("./views/BoardView").then((m) => ({ default: m.BoardView })),
  platforms: () => import("./views/PlatformsView").then((m) => ({ default: m.PlatformsView })),
  folders: () => import("./views/FoldersView").then((m) => ({ default: m.FoldersView })),
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
  const { compact } = useCompactSidebar();
  return (
    <LazyMotion features={loadMotionFeatures} strict>
    <div className="app" style={{ gridTemplateColumns: `${compact ? 76 : 280}px minmax(0, 1fr)` }}>
      <Sidebar />
      <main className="main"><div className="view-enter" key={view}><CurrentView /></div></main>
      <GameDrawer />
      <AddGameModal />
      <CommandPalette />
      <Toasts />
    </div>
    </LazyMotion>
  );
}
