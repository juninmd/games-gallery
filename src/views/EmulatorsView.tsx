import { Download, ExternalLink, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { PlatformTag, ProgressBar } from "../components/Badges";
import { PlaylistExport } from "../components/PlaylistExport";
import { EMULATORS, NO_EMULATOR_NOTE } from "../domain/emulators";
import { PLATFORMS } from "../domain/platforms";
import type { EmulatorUsage } from "../domain/emulatorUsage";
import { emulatorUsage } from "../domain/emulatorUsage";
import type { Emulator, EmulatorStatus } from "../domain/types";
import { useLibrary } from "../state/library";
import { useTasks } from "../state/tasks";
import { useUi } from "../state/ui";

const STATUS: Record<EmulatorStatus, { label: string; cls: string }> = {
  active: { label: "Ativo", cls: "ok" },
  experimental: { label: "Experimental", cls: "warn" },
  "community-fork": { label: "Fork da comunidade", cls: "warn" },
  discontinued: { label: "Descontinuado", cls: "bad" },
};

function Usage({ usage }: { usage?: EmulatorUsage }) {
  const select = useUi((s) => s.select);
  const [open, setOpen] = useState(false);
  if (!usage) return <p className="muted small">Nenhum jogo da biblioteca usa este emulador.</p>;
  return (
    <details className="usage" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{usage.games.length} jogo{usage.games.length > 1 ? "s" : ""} · {usage.ready} pronto{usage.ready === 1 ? "" : "s"} para jogar</summary>
      {open && (
        <ul>
          {usage.games.map((g) => (
            <li key={g.id}><button onClick={() => select(g.id)}>{g.title}{g.romPath ? "" : " (sem ROM)"}</button></li>
          ))}
        </ul>
      )}
    </details>
  );
}

function EmulatorCard({ emulator: e, usage }: { emulator: Emulator; usage?: EmulatorUsage }) {
  const installed = useLibrary((s) => !!s.emulators[e.id]);
  const { installEmulator, uninstallEmulator } = useLibrary();
  const task = useTasks((s) => s.tasks[`emu:${e.id}`]);
  const st = STATUS[e.status];

  return (
    <article className="vcard">
      <div className="vcard-head">
        <div>
          <h3>{e.name}</h3>
          <span className="muted small">{e.os.join(" · ")}</span>
        </div>
        <span className={`tag ${st.cls}`}>{st.label}</span>
      </div>
      <div className="tags">{e.platforms.map((p) => <PlatformTag key={p} id={p} />)}</div>
      <p className={`small ${e.needsBios ? "warn-text" : "muted"}`}>{e.needsBios ? "⚠ " : ""}{e.notes}</p>
      <Usage usage={usage} />
      {e.id === "retroarch" && <PlaylistExport />}
      <pre className="cmd small">{[e.exe, ...e.args].join(" ")}</pre>
      {task && <ProgressBar value={task.progress} label={task.label} />}
      <div className="vcard-foot">
        {e.homepage ? (
          <a className="link" href={e.homepage} target="_blank" rel="noreferrer noopener"><ExternalLink size={13} aria-hidden /> Site</a>
        ) : <span />}
        {installed ? (
          <button className="btn ghost" onClick={() => uninstallEmulator(e.id)}><Trash2 size={14} aria-hidden /> Remover</button>
        ) : (
          <button className="btn primary" disabled={!!task} onClick={() => installEmulator(e.id)}><Download size={14} aria-hidden /> Instalar</button>
        )}
      </div>
    </article>
  );
}

export function EmulatorsView() {
  const installed = useLibrary((s) => s.emulators);
  const games = useLibrary((s) => s.games);
  const usage = useMemo(() => emulatorUsage(games), [games]);
  const [platformId, setPlatformId] = useState("");
  const [onlyInstalled, setOnlyInstalled] = useState(false);
  const list = EMULATORS.filter((e) => (!platformId || e.platforms.includes(platformId)) && (!onlyInstalled || installed[e.id]));
  const covered = PLATFORMS.filter((p) => p.id !== "pc" && EMULATORS.some((e) => e.platforms.includes(p.id)));

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Emuladores</h1>
          <p className="muted">
            {covered.length} de {PLATFORMS.length - 1} plataformas de console têm emulador no catálogo. Instalação simulada no protótipo.
          </p>
        </div>
        <div className="head-tools">
          <select aria-label="Filtrar por plataforma" value={platformId} onChange={(e) => setPlatformId(e.target.value)}>
            <option value="">Todas as plataformas</option>
            {PLATFORMS.filter((p) => p.id !== "pc").map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <label className="check"><input type="checkbox" checked={onlyInstalled} onChange={(e) => setOnlyInstalled(e.target.checked)} /> Só instalados</label>
        </div>
      </header>
      <div className="cards wide">{list.map((e) => <EmulatorCard key={e.id} emulator={e} usage={usage[e.id]} />)}</div>
      {!list.length && <p className="empty">Nenhum emulador com esses filtros.</p>}
      <section className="group gap">
        <h2>Lacunas conhecidas</h2>
        <ul className="gaps">
          {Object.entries(NO_EMULATOR_NOTE).map(([id, note]) => (
            <li key={id}><PlatformTag id={id} /> {note}</li>
          ))}
        </ul>
        <p className="muted small">Você precisa fornecer BIOS/firmware/chaves do seu próprio hardware e as ROMs/ISOs dos jogos que possui. O app não baixa nem distribui esses arquivos.</p>
      </section>
    </>
  );
}
