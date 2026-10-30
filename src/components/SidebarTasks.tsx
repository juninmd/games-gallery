import { LoaderCircle } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useTasks } from "../state/tasks";
import { ProgressBar } from "./Badges";

/** Long-running jobs (downloads, syncs) shown where the eye already is. */
export function SidebarTasks({ compact }: { compact: boolean }) {
  const tasks = useTasks(useShallow((s) => Object.values(s.tasks)));
  if (!tasks.length) return null;

  if (compact) {
    return (
      <div className="relative grid size-10 place-items-center rounded-full glass" role="status" aria-label={`${tasks.length} tarefa(s) em andamento`} title={tasks.map((t) => `${t.label} ${Math.round(t.progress)}%`).join("\n")}>
        <LoaderCircle size={18} className="animate-spin text-aurora" aria-hidden />
        <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-signature text-[10px] font-bold text-white">{tasks.length}</span>
      </div>
    );
  }

  return (
    <aside className="glass grid gap-2.5 rounded-2xl p-3" aria-label="Tarefas em andamento">
      {tasks.map((t) => (
        <div key={t.key} className="grid gap-1.5 text-xs">
          <span className="flex items-center gap-2 text-mist">
            <LoaderCircle size={13} className="shrink-0 animate-spin text-aurora" aria-hidden />
            <span className="truncate">{t.label}</span>
            <span className="ml-auto tabular-nums text-fog">{Math.round(t.progress)}%</span>
          </span>
          <ProgressBar value={t.progress} label={t.label} />
        </div>
      ))}
    </aside>
  );
}
