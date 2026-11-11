import { create } from "zustand";
import { EMPTY_FILTER, type GameFilter } from "../domain/filter";

export type View = "library" | "installed" | "board" | "platforms" | "providers" | "freebies" | "deals" | "connections" | "folders" | "emulators" | "stats" | "settings";

interface Toast {
  id: number;
  msg: string;
}

const DENSITY_KEY = "games-gallery:density";
/** How the library lays out games: themed rails, a grid (two sizes), a table-like list or 3D boxes. */
export type Density = "rails" | "comfortable" | "compact" | "list" | "boxes";
export const DENSITIES: readonly Density[] = ["rails", "comfortable", "compact", "list", "boxes"];
const readDensity = (): Density => {
  try {
    const stored = localStorage.getItem(DENSITY_KEY);
    return DENSITIES.find((d) => d === stored) ?? "rails";
  } catch { return "rails"; }
};

interface UiState {
  view: View;
  density: Density;
  shortcutsOpen: boolean;
  setDensity: (density: Density) => void;
  setShortcutsOpen: (open: boolean) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  /** Colors of the game in focus; the ambient backdrop fades to them. Null = signature colors. */
  ambient: [string, string] | null;
  setAmbient: (ambient: [string, string] | null) => void;
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
  density: readDensity(),
  shortcutsOpen: false,
  setDensity: (density) => {
    try { localStorage.setItem(DENSITY_KEY, density); } catch { /* storage unavailable: keep in memory */ }
    set({ density });
  },
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  ambient: null,
  setAmbient: (ambient) => set((s) => (s.ambient?.[0] === ambient?.[0] && s.ambient?.[1] === ambient?.[1] ? s : { ambient })),
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
