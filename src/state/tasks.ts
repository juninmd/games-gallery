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
  cancel: (key: string) => void;
  cancelAll: () => void;
}

const TICK_MS = 120;
const timers = new Map<string, ReturnType<typeof setInterval>>();

export const useTasks = create<TasksState>((set, get) => ({
  tasks: {},
  run: (key, label, durationMs, onDone) => {
    if (timers.has(key)) return;
    const step = 100 / Math.max(1, durationMs / TICK_MS);
    const timer = setInterval(() => {
      if (timers.get(key) !== timer) { clearInterval(timer); return; }
      const t = get().tasks[key];
      if (!t) { clearInterval(timer); timers.delete(key); return; }
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
      if (timers.get(key) !== timer) return;
      timers.delete(key);
      onDone();
    }, TICK_MS);
    timers.set(key, timer);
    set((s) => ({ tasks: { ...s.tasks, [key]: { key, label, progress: 0 } } }));
  },
  cancel: (key) => {
    const timer = timers.get(key);
    if (timer !== undefined) clearInterval(timer);
    timers.delete(key);
    set((s) => {
      if (!(key in s.tasks)) return s;
      const { [key]: _cancelled, ...rest } = s.tasks;
      return { tasks: rest };
    });
  },
  cancelAll: () => {
    for (const timer of timers.values()) clearInterval(timer);
    timers.clear();
    set({ tasks: {} });
  },
}));
