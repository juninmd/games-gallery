import { useState } from "react";
import { planLaunch } from "../domain/launch";
import type { Game } from "../domain/types";
import { launch } from "../platform/runtime";
import { useLibrary } from "../state/library";
import { useTasks } from "../state/tasks";
import { useUi } from "../state/ui";

/** Launch plan, install progress and last result for one game, shared by the drawer's action bar and its Jogar tab. */
export function useLaunch(game: Game) {
  const emulators = useLibrary((s) => s.emulators);
  const toast = useUi((s) => s.toast);
  const task = useTasks((s) => s.tasks[`game:${game.id}`]);
  const [last, setLast] = useState<string | null>(null);
  const plan = planLaunch(game, { installed: emulators });

  const play = async () => {
    const r = await launch(plan);
    if (!r.ok) return toast(r.error);
    setLast(r.detail);
    toast(r.simulated ? "Simulado (protótipo): nada foi executado" : "Aberto no launcher");
  };

  return { plan, task, last, play };
}

export type LaunchState = ReturnType<typeof useLaunch>;
