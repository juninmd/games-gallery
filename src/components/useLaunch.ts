import { useState } from "react";
import { planLaunch } from "../domain/launch";
import type { Game } from "../domain/types";
import { launch } from "../platform/runtime";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";

/** Launch plan and last result for one game, shared by the drawer's action bar and its Jogar tab. */
export function useLaunch(game: Game) {
  const emulators = useLibrary((s) => s.emulators);
  const emulatorPaths = useLibrary((s) => s.emulatorPaths);
  const toast = useUi((s) => s.toast);
  const [last, setLast] = useState<string | null>(null);
  const plan = planLaunch(game, { installed: emulators, exePaths: emulatorPaths });

  const play = async () => {
    const r = await launch(plan);
    if (!r.ok) return toast(r.error);
    setLast(r.detail);
    toast(plan.kind === "uri" ? "Aberto no launcher" : "Emulador iniciado");
  };

  return { plan, last, play };
}

export type LaunchState = ReturnType<typeof useLaunch>;
