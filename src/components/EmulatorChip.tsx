import { Cpu } from "lucide-react";
import { resolveEmulator } from "../domain/launch";
import type { Game } from "../domain/types";
import { useLibrary } from "../state/library";

/** Emulator that runs this console game, with its install state. Renders nothing for PC. */
export function EmulatorChip({ game }: { game: Game }) {
  const emulator = game.platformId === "pc" ? undefined : resolveEmulator(game);
  const installed = useLibrary((s) => (emulator ? !!s.emulators[emulator.id] : false));
  if (!emulator) return null;
  return (
    <span className={`emu-chip ${installed ? "on" : "off"}`} title={installed ? `${emulator.name} instalado` : `${emulator.name} não instalado`}>
      <Cpu size={11} aria-hidden /> {emulator.name.split(" (")[0]}
      <span className="sr-only">{installed ? " (instalado)" : " (não instalado)"}</span>
    </span>
  );
}
