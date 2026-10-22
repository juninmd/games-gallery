import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { EMULATOR_BY_ID } from "../domain/emulators";
import type { ImportItem } from "../domain/scan/plan";
import { useLibrary } from "../state/library";
import { useTasks } from "../state/tasks";
import { PlatformTag } from "./Badges";

const KIND_LABEL = { new: "Novo", link: "Vincular", same: "Já importado" } as const;
const KIND_TAG = { new: "ok", link: "warn", same: "" } as const;
const MAX_ROWS = 300;

function NeededEmulators({ items }: { items: ImportItem[] }) {
  const installed = useLibrary((s) => s.emulators);
  const install = useLibrary((s) => s.installEmulator);
  const tasks = useTasks((s) => s.tasks);
  const counts = new Map<string, number>();
  for (const i of items) if (i.emulatorId) counts.set(i.emulatorId, (counts.get(i.emulatorId) ?? 0) + 1);
  if (!counts.size) return null;

  return (
    <div className="needed">
      <h4>Emuladores usados por esta seleção</h4>
      <ul className="plain">
        {[...counts].map(([id, n]) => (
          <li key={id} className="inline">
            <strong>{EMULATOR_BY_ID[id]?.name}</strong>
            <span className="muted small">{n} jogo{n > 1 ? "s" : ""}</span>
            {installed[id] ? (
              <span className="tag ok">instalado</span>
            ) : (
              <button className="btn" disabled={!!tasks[`emu:${id}`]} onClick={() => install(id)}>
                <Download size={14} aria-hidden /> Instalar
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface Props {
  title: string;
  items: ImportItem[];
  notes: string[];
  onImport: (selected: ImportItem[]) => void;
  onCancel: () => void;
}

export function ScanResults({ title, items, notes, onImport, onCancel }: Props) {
  const [off, setOff] = useState<Set<string>>(() => new Set(items.filter((i) => i.kind === "same").map((i) => i.key)));
  const selected = useMemo(() => items.filter((i) => !off.has(i.key)), [items, off]);
  const toggle = (key: string) =>
    setOff((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const changes = selected.filter((i) => i.kind !== "same").length;
  const count = (k: ImportItem["kind"]) => items.filter((i) => i.kind === k).length;

  return (
    <section className="panel" aria-label="Resultado da varredura">
      <h3>{title}</h3>
      <p className="muted small">{count("new")} novos · {count("link")} a vincular · {count("same")} já importados</p>
      {notes.map((n) => <p key={n} className="note warn">{n}</p>)}
      {!items.length && <p className="empty">Nada reconhecido nesta pasta.</p>}
      <div className="scan-list" role="list">
        {items.slice(0, MAX_ROWS).map((i) => (
          <label key={i.key} className="scan-row" role="listitem">
            <input type="checkbox" checked={!off.has(i.key)} onChange={() => toggle(i.key)} />
            <span className="scan-title" title={i.romPath}>{i.title}</span>
            <PlatformTag id={i.platformId} />
            <span className={`tag ${KIND_TAG[i.kind]}`}>{KIND_LABEL[i.kind]}</span>
            <span className="muted small scan-emu">{i.emulatorId ? EMULATOR_BY_ID[i.emulatorId]?.name.split(" (")[0] : ""}</span>
          </label>
        ))}
      </div>
      {items.length > MAX_ROWS && <p className="muted small">Mostrando {MAX_ROWS} de {items.length}; todos os marcados serão importados.</p>}
      <NeededEmulators items={selected} />
      <div className="actions">
        <button className="btn primary" disabled={!changes} onClick={() => onImport(selected)}>
          Importar {changes} {changes === 1 ? "item" : "itens"}
        </button>
        <button className="btn ghost" onClick={onCancel}>Descartar</button>
      </div>
    </section>
  );
}
