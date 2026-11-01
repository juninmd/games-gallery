import { create } from "zustand";

/**
 * Real job registry: entries are created when a native operation starts and updated from its
 * output (package manager lines, detection steps). Nothing advances on a timer.
 */
export interface Task {
  key: string;
  label: string;
  progress: number;
  /** Last meaningful output line, shown under the bar. */
  detail?: string;
}

interface TasksState {
  tasks: Record<string, Task>;
  start: (key: string, label: string) => void;
  update: (key: string, patch: Partial<Omit<Task, "key">>) => void;
  done: (key: string) => void;
  cancel: (key: string) => void;
  cancelAll: () => void;
}

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export const useTasks = create<TasksState>((set, get) => ({
  tasks: {},
  start: (key, label) => {
    if (get().tasks[key]) return;
    set((s) => ({ tasks: { ...s.tasks, [key]: { key, label, progress: 0 } } }));
  },
  update: (key, patch) =>
    set((s) => {
      const current = s.tasks[key];
      if (!current) return s;
      const next: Task = {
        ...current,
        ...patch,
        progress: patch.progress === undefined ? current.progress : clamp(patch.progress),
      };
      return { tasks: { ...s.tasks, [key]: next } };
    }),
  done: (key) =>
    set((s) => {
      if (!(key in s.tasks)) return s;
      const { [key]: _finished, ...rest } = s.tasks;
      return { tasks: rest };
    }),
  cancel: (key) => {
    if (!get().tasks[key]) return;
    // The caller (library) also asks the native side to kill the process.
    get().done(key);
  },
  cancelAll: () => set({ tasks: {} }),
}));
