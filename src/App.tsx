import { Component, lazy, Suspense, useMemo, useState, type ErrorInfo, type ReactNode } from "react";
import { AddGameModal } from "./components/AddGameModal";
import { GameDrawer } from "./components/GameDrawer";
import { TaskTray, Toasts } from "./components/Overlays";
import { Sidebar } from "./components/Sidebar";
import { useUi, type View } from "./state/ui";
import { GameBrowser } from "./views/GameBrowser";

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
  return (
    <div className="app">
      <Sidebar />
      <main className="main"><CurrentView /></main>
      <GameDrawer />
      <AddGameModal />
      <TaskTray />
      <Toasts />
    </div>
  );
}
