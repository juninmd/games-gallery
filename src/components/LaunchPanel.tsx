import { Download, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { NO_EMULATOR_NOTE, emulatorsFor } from "../domain/emulators";
import { planLaunch, resolveEmulator } from "../domain/launch";
import { PLATFORM_BY_ID } from "../domain/platforms";
import type { Game } from "../domain/types";
import { launch } from "../platform/runtime";
import { useLibrary } from "../state/library";
import { useTasks } from "../state/tasks";
import { useUi } from "../state/ui";
import { ProgressBar } from "./Badges";

function EmulationFields({ game }: { game: Game }) {
  const { emulators, settings, patchGame, installEmulator } = useLibrary();
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

export function LaunchPanel({ game }: { game: Game }) {
  const { emulators, patchGame, installGame, uninstallGame } = useLibrary();
  const toast = useUi((s) => s.toast);
  const task = useTasks((s) => s.tasks[`game:${game.id}`]);
  const [last, setLast] = useState<string | null>(null);
  const plan = planLaunch(game, { installed: emulators });
  const isPc = game.platformId === "pc";

  const play = async () => {
    const r = await launch(plan);
    if (!r.ok) return toast(r.error);
    setLast(r.detail);
    toast(r.simulated ? "Simulado (protótipo): nada foi executado" : "Aberto no launcher");
  };

  return (
    <section className="panel">
      <h3>{isPc ? "Jogar" : "Jogar via emulação"}</h3>
      {!isPc && game.owned && <EmulationFields game={game} />}

      <div className="actions">
        {!game.owned ? (
          <button className="btn primary" onClick={() => patchGame(game.id, { owned: true, status: "backlog" })}>Marcar como comprado</button>
        ) : game.installed ? (
          <>
            <button className="btn primary" onClick={play} disabled={plan.kind === "blocked"}>
              <Play size={16} aria-hidden /> Jogar
            </button>
            <button className="btn ghost" onClick={() => uninstallGame(game.id)}>
              <Trash2 size={15} aria-hidden /> Desinstalar
            </button>
          </>
        ) : (
          <button className="btn primary" disabled={!!task} onClick={() => installGame(game.id)}>
            <Download size={16} aria-hidden /> {isPc ? "Instalar" : "Preparar jogo"}
          </button>
        )}
      </div>
      {task && <ProgressBar value={task.progress} label={task.label} />}
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
