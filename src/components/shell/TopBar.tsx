import { Command, Download, LoaderCircle, Plus } from "lucide-react";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { computeProfile } from "../../domain/profile";
import { computeStats } from "../../domain/stats";
import { isTauri } from "../../platform/runtime";
import { useLibrary } from "../../state/library";
import { useTasks } from "../../state/tasks";
import { useUi } from "../../state/ui";
import { useUpdates } from "../../state/updates";
import { Logo } from "../Logo";
import { NowPlaying } from "../NowPlaying";
import { LevelRing, ProfileCard } from "../ProfileCard";
import { SidebarTasks } from "../SidebarTasks";
import { OmniSearch } from "./OmniSearch";

const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);

/** Sticky command bar: brand, the smart search, quick actions and the profile panel. */
export function TopBar() {
  const go = useUi((s) => s.go);
  const setAddOpen = useUi((s) => s.setAddOpen);
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);
  const games = useLibrary((s) => s.games);
  const stats = useMemo(() => computeStats(games), [games]);
  const profile = useMemo(() => computeProfile(stats), [stats]);
  const taskCount = useTasks(useShallow((s) => Object.keys(s.tasks).length));
  const updateVersion = useUpdates((s) => (s.phase === "available" ? s.latest?.version : undefined));

  return (
    <header className="topbar">
      <button type="button" className="brand" onClick={() => go("library")} aria-label="Games Gallery: ir para a Biblioteca">
        <Logo size={36} />
        <span className="brand-name"><b>Games</b> <b className="text-gradient">Gallery</b></span>
      </button>

      <OmniSearch />

      <div className="topbar-actions">
        <button type="button" className="top-btn top-btn-add" onClick={() => setAddOpen(true)} aria-label="Adicionar jogo" title="Adicionar jogo">
          <Plus size={19} aria-hidden />
        </button>
        <button
          type="button"
          className="top-btn"
          onClick={() => setPaletteOpen(true)}
          aria-label={`Paleta de comandos (${isMac ? "⌘" : "Ctrl+"}K)${taskCount ? `, ${taskCount} tarefa(s) em andamento` : ""}`}
          title={`Buscar ou ir para… (${isMac ? "⌘" : "Ctrl+"}K)`}
        >
          <Command size={17} aria-hidden />
          {taskCount > 0 && <span className="top-dot" aria-hidden />}
        </button>
        <button
          type="button"
          className="top-profile"
          popoverTarget="profile-panel"
          aria-label={`Nível ${profile.level}, ${profile.title}. Abrir perfil`}
          title={`Nível ${profile.level} · ${profile.title}`}
        >
          <LevelRing level={profile.level} progress={profile.progress} size={44} />
          {taskCount > 0 && <LoaderCircle size={14} className="top-spinner animate-spin" aria-hidden />}
        </button>
      </div>

      <div id="profile-panel" popover="auto" className="profile-panel" aria-label="Perfil, jogando agora e tarefas">
        <ProfileCard stats={stats} compact={false} />
        <NowPlaying />
        <SidebarTasks compact={false} />
        {updateVersion && (
          <button type="button" onClick={() => go("settings")} className="update-cta">
            <Download size={14} aria-hidden /> Atualizar para v{updateVersion}
          </button>
        )}
        <p className="profile-version">v{__APP_VERSION__} · {isTauri() ? "Desktop" : "Web"}</p>
      </div>
    </header>
  );
}
