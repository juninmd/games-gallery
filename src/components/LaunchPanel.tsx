import { Download } from "lucide-react";
import { NO_EMULATOR_NOTE, emulatorsFor } from "../domain/emulators";
import { resolveEmulator } from "../domain/launch";
import { PLATFORM_BY_ID } from "../domain/platforms";
import type { Game } from "../domain/types";
import { useLibrary } from "../state/library";
import { useTasks } from "../state/tasks";
import { useUi } from "../state/ui";
import { ProgressBar } from "./Badges";
import type { LaunchState } from "./useLaunch";

function EmulationFields({ game }: { game: Game }) {
  const emulators = useLibrary((s) => s.emulators);
  const settings = useLibrary((s) => s.settings);
  const patchGame = useLibrary((s) => s.patchGame);
  const installEmulator = useLibrary((s) => s.installEmulator);
  const toast = useUi((s) => s.toast);
  const options = emulatorsFor(game.platformId);
  const chosen = resolveEmulator(game);
  const task = useTasks((s) => (chosen ? s.tasks[`emu:${chosen.id}`] : undefined));
  const platform = PLATFORM_BY_ID[game.platformId];

  if (!options.length) {
    return (
      <p className="note warn">
        {NO_EMULATOR_NOTE[game.platformId] ?? `Sem emulador para ${platform?.name}.`} Jogue no console original.
      </p>
    );
  }

  return (
    <div className="fields">
      <label>
        Emulador
        <select value={chosen?.id} onChange={(e) => patchGame(game.id, { emulatorId: e.target.value })}>
          {options.map((e) => (
            <option key={e.id} value={e.id}>{e.name}{emulators[e.id] ? " ✓ instalado" : ""}</option>
          ))}
        </select>
      </label>
      {chosen && !emulators[chosen.id] && (
        <div className="inline">
          <button className="btn" disabled={!!task} onClick={() => installEmulator(chosen.id)}>
            <Download size={15} aria-hidden /> Instalar {chosen.name}
          </button>
          {task && <ProgressBar value={task.progress} label={task.label} />}
        </div>
      )}
      {chosen && <p className={`note ${chosen.needsBios ? "warn" : ""}`}>{chosen.notes}</p>}
      <label>
        ROM / ISO
        <input
          value={game.romPath ?? ""}
          placeholder={`${settings.romsDir}/${game.platformId}/jogo.zip`}
          onChange={(e) => patchGame(game.id, { romPath: e.target.value })}
          onBlur={() => !game.romPath && toast("Defina o caminho da ROM para poder jogar")}
        />
      </label>
    </div>
  );
}

export function LaunchPanel({ game, launch }: { game: Game; launch: LaunchState }) {
  const { plan, last } = launch;
  const isPc = game.platformId === "pc";

  return (
    <section className="glass grid gap-3 rounded-2xl p-4" aria-label={isPc ? "Jogar" : "Jogar via emulação"}>
      <h3>{isPc ? "Como jogar" : "Jogar via emulação"}</h3>
      {!isPc && game.owned && <EmulationFields game={game} />}
      {plan.kind === "blocked" && game.installed && <p className="note warn">{plan.reason}</p>}
      {plan.kind !== "blocked" && (
        <>
          <p className="muted small">Comando que será executado:</p>
          <pre className="cmd">{plan.preview}</pre>
        </>
      )}
      {last && <p className="note ok">Último launch simulado: {last}</p>}
    </section>
  );
}
