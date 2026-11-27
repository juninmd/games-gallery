import { Button, ProgressBar, Select, TextField } from "@juninmd/sonido";
import { Download } from "lucide-react";
import { NO_EMULATOR_NOTE, emulatorsFor } from "../domain/emulators";
import { resolveEmulator } from "../domain/launch";
import { PLATFORM_BY_ID } from "../domain/platforms";
import type { Game } from "../domain/types";
import { useLibrary } from "../state/library";
import { useTasks } from "../state/tasks";
import { useUi } from "../state/ui";
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
      <Select
        label="Emulador"
        value={chosen?.id ?? ""}
        onChange={(emulatorId) => patchGame(game.id, { emulatorId })}
        options={options.map((e) => ({ value: e.id, label: `${e.name}${emulators[e.id] ? " ✓ instalado" : ""}` }))}
      />
      {chosen && !emulators[chosen.id] && (
        <div className="inline">
          <Button variant="secondary" disabled={!!task} onClick={() => void installEmulator(chosen.id)}>
            <Download size={15} aria-hidden /> Instalar {chosen.name}
          </Button>
          {task && <ProgressBar size="sm" value={task.progress / 100} label={task.label} />}
        </div>
      )}
      {chosen && <p className={`note ${chosen.needsBios ? "warn" : ""}`}>{chosen.notes}</p>}
      <TextField
        label="ROM / ISO"
        value={game.romPath ?? ""}
        placeholder={`${settings.romsDir}/${game.platformId}/jogo.zip`}
        onChange={(e) => patchGame(game.id, { romPath: e.target.value, romCrc32: undefined, datName: undefined, romSerial: undefined })}
        onBlur={() => !game.romPath && toast("Defina o caminho da ROM para poder jogar")}
      />
      {game.romCrc32 && (
        <p className={`note ${game.datName ? "ok" : ""}`}>
          CRC32 {game.romCrc32}: {game.datName ? `confere com o DAT (${game.datName})` : "não está no DAT carregado"}
        </p>
      )}
      {game.romSerial && <p className="note">ID do disco {game.romSerial} · capa completa da caixa: GameTDB</p>}
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
      {last && <p className="note ok">Último comando: {last}</p>}
    </section>
  );
}
