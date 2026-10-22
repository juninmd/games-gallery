import { useShallow } from "zustand/react/shallow";
import { useTasks } from "../state/tasks";
import { useUi } from "../state/ui";
import { ProgressBar } from "./Badges";

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => <div key={t.id} className="toast">{t.msg}</div>)}
    </div>
  );
}

export function TaskTray() {
  const tasks = useTasks(useShallow((s) => Object.values(s.tasks)));
  if (!tasks.length) return null;
  return (
    <aside className="tray" aria-label="Tarefas em andamento">
      {tasks.map((t) => (
        <div key={t.key}>
          <span>{t.label}… {Math.round(t.progress)}%</span>
          <ProgressBar value={t.progress} label={t.label} />
        </div>
      ))}
    </aside>
  );
}
