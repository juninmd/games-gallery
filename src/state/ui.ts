import { create } from "zustand";
import { EMPTY_FILTER, type GameFilter } from "../domain/filter";

export type View = "library" | "installed" | "board" | "platforms" | "providers" | "folders" | "emulators" | "settings";

interface Toast {
  id: number;
  msg: string;
}

interface UiState {
  view: View;
  filter: GameFilter;
  selectedId: string | null;
  addOpen: boolean;
  toasts: Toast[];
  go: (view: View, filter?: Partial<GameFilter>) => void;
  setFilter: (patch: Partial<GameFilter>) => void;
  select: (id: string | null) => void;
  setAddOpen: (open: boolean) => void;
  toast: (msg: string) => void;
}

let toastSeq = 0;

export const useUi = create<UiState>((set) => ({
  view: "library",
  filter: EMPTY_FILTER,
  selectedId: null,
  addOpen: false,
  toasts: [],
  go: (view, filter) => set({ view, filter: { ...EMPTY_FILTER, ...filter }, selectedId: null }),
  setFilter: (patch) => set((s) => ({ filter: { ...s.filter, ...patch } })),
  select: (selectedId) => set({ selectedId }),
  setAddOpen: (addOpen) => set({ addOpen }),
  toast: (msg) => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts, { id, msg }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500);
  },
}));
