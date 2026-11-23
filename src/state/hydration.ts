import { useSyncExternalStore } from "react";
import { useLibrary } from "./library";

const subscribe = (onChange: () => void) => useLibrary.persist.onFinishHydration(onChange);
const snapshot = () => useLibrary.persist.hasHydrated();

/** False while the saved library is still being read from disk (desktop app only). */
export const useLibraryHydrated = () => useSyncExternalStore(subscribe, snapshot);
