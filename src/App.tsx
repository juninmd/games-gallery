import { AddGameModal } from "./components/AddGameModal";
import { GameDrawer } from "./components/GameDrawer";
import { TaskTray, Toasts } from "./components/Overlays";
import { Sidebar } from "./components/Sidebar";
import { useUi } from "./state/ui";
import { BoardView } from "./views/BoardView";
import { EmulatorsView } from "./views/EmulatorsView";
import { FoldersView } from "./views/FoldersView";
import { FreebiesView } from "./views/FreebiesView";
import { GameBrowser } from "./views/GameBrowser";
import { PlatformsView } from "./views/PlatformsView";
import { ProvidersView } from "./views/ProvidersView";
import { SettingsView } from "./views/SettingsView";

function CurrentView() {
  const view = useUi((s) => s.view);
  switch (view) {
    case "library": return <GameBrowser scope="all" />;
    case "installed": return <GameBrowser scope="installed" />;
    case "board": return <BoardView />;
    case "platforms": return <PlatformsView />;
    case "folders": return <FoldersView />;
    case "freebies": return <FreebiesView />;
    case "providers": return <ProvidersView />;
    case "emulators": return <EmulatorsView />;
    case "settings": return <SettingsView />;
  }
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
