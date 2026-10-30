import { create } from "zustand";
import { EMPTY_FILTER, type GameFilter } from "../domain/filter";

export type View = "library" | "installed" | "board" | "platforms" | "providers" | "freebies" | "folders" | "emulators" | "stats" | "settings";

interface Toast {
  id: number;
  msg: string;
}

const COLLAPSE_KEY = "games-gallery:sidebar-collapsed";
const readCollapsed = () => {
  try { return localStorage.getItem(COLLAPSE_KEY) === "1"; } catch { return false; }
};

interface UiState {
  view: View;
  paletteOpen: boolean;
  sidebarCollapsed: boolean;
  setPaletteOpen: (open: boolean) => void;
  toggleSidebar: () => void;
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
  paletteOpen: false,
  sidebarCollapsed: readCollapsed(),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  toggleSidebar: () => set((s) => {
    const sidebarCollapsed = !s.sidebarCollapsed;
    try { localStorage.setItem(COLLAPSE_KEY, sidebarCollapsed ? "1" : "0"); } catch { /* storage unavailable: keep in memory */ }
    return { sidebarCollapsed };
  }),
  filter: EMPTY_FILTER,
  selectedId: null,
  addOpen: false,
  toasts: [],
  go: (view, filter) => set({ view, filter: { ...EMPTY_FILTER, ...filter }, selectedId: null }),
  setFilter: (patch) => set((s) => ({ filter: { ...s.filter, ...patch } })),
  select: (selectedId) => set({ selectedId, ...(selectedId ? { addOpen: false } : {}) }),
  setAddOpen: (addOpen) => set({ addOpen, ...(addOpen ? { selectedId: null } : {}) }),
  toast: (msg) => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts, { id, msg }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500);
  },
}));
