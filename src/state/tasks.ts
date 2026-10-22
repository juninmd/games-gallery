import { create } from "zustand";

export interface Task {
  key: string;
  label: string;
  progress: number;
}

interface TasksState {
  tasks: Record<string, Task>;
  /** Simulates a long-running job (download/sync); the real app swaps this for a Tauri command + events. */
  run: (key: string, label: string, durationMs: number, onDone: () => void) => void;
}

const TICK_MS = 120;

export const useTasks = create<TasksState>((set, get) => ({
  tasks: {},
  run: (key, label, durationMs, onDone) => {
    if (get().tasks[key]) return;
    set((s) => ({ tasks: { ...s.tasks, [key]: { key, label, progress: 0 } } }));
    const step = 100 / Math.max(1, durationMs / TICK_MS);
    const timer = setInterval(() => {
      const t = get().tasks[key];
      if (!t) return clearInterval(timer);
      const progress = Math.min(100, t.progress + step);
      if (progress < 100) {
        set((s) => ({ tasks: { ...s.tasks, [key]: { ...t, progress } } }));
        return;
      }
      clearInterval(timer);
      set((s) => {
        const { [key]: _done, ...rest } = s.tasks;
        return { tasks: rest };
      });
      onDone();
    }, TICK_MS);
  },
}));
