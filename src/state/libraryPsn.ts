import { planStoreImport } from "../domain/scan/plan";
import { nativeAvailable, psnLibrary } from "../platform/native";
import type { LibraryState } from "./library";
import { useTasks } from "./tasks";
import { useUi } from "./ui";

type Set = (fn: (s: LibraryState) => Partial<LibraryState>) => void;
type Get = () => LibraryState;

const toast = (msg: string) => useUi.getState().toast(msg);
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** PSN played games via the user's NPSSO (no public Sony API); the token is used once and dropped. */
export const psnActions = (set: Set, get: Get): Pick<LibraryState, "syncPsnAccount"> => ({
  syncPsnAccount: async (npsso) => {
    if (!nativeAvailable()) {
      toast("PSN: o login só funciona no app instalado.");
      return;
    }
    const key = "sync:psn-account";
    const tasks = useTasks.getState();
    tasks.start(key, "Lendo os jogos da conta PSN");
    try {
      const games = await psnLibrary(npsso);
      const items = planStoreImport("psn", games, get().games).filter((i) => i.kind !== "same");
      if (items.length) get().importItems(items, { kind: "games", name: "Conta PSN" });
      set((s) => ({ providers: { ...s.providers, psn: { connected: true, lastSync: new Date().toISOString(), source: "Conta PSN (jogos jogados PS4/PS5)" } } }));
      toast(`PSN: ${games.length} jogos jogados (PS4/PS5).`);
    } catch (e) {
      toast(`PSN: ${errorText(e)}`);
    } finally {
      useTasks.getState().done(key);
    }
  },
});
