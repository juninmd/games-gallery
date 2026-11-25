import { Badge, Button, Checkbox, ProgressBar, Select, type BadgeTone } from "@juninmd/sonido";
import { Download, ExternalLink, RefreshCw, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { PlatformTag } from "../components/Badges";
import { EmulatorInstallPanel } from "../components/EmulatorInstallPanel";
import { InstallScript } from "../components/InstallScript";
import { PlaylistExport } from "../components/PlaylistExport";
import { EMULATORS, NO_EMULATOR_NOTE } from "../domain/emulators";
import { PLATFORMS } from "../domain/platforms";
import type { EmulatorUsage } from "../domain/emulatorUsage";
import { emulatorUsage } from "../domain/emulatorUsage";
import type { Emulator, EmulatorStatus } from "../domain/types";
import { useLibrary } from "../state/library";
import { useTasks } from "../state/tasks";
import { useUi } from "../state/ui";

const STATUS: Record<EmulatorStatus, { label: string; tone: BadgeTone }> = {
  active: { label: "Ativo", tone: "success" },
  experimental: { label: "Experimental", tone: "warning" },
  "community-fork": { label: "Fork da comunidade", tone: "warning" },
  discontinued: { label: "Descontinuado", tone: "danger" },
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
  const exePath = useLibrary((s) => s.emulatorPaths[e.id]);
  const installEmulator = useLibrary((s) => s.installEmulator);
  const uninstallEmulator = useLibrary((s) => s.uninstallEmulator);
  const cancelEmulator = useLibrary((s) => s.cancelEmulator);
  const task = useTasks((s) => s.tasks[`emu:${e.id}`]);
  const st = STATUS[e.status];

  const install = () => {
    void installEmulator(e.id);
  };

  return (
    <article className="vcard">
      <div className="vcard-head">
        <div>
          <h3 aria-level={2}>{e.name}</h3>
          <span className="muted small">{e.os.join(" · ")}</span>
        </div>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
      <div className="tags">{e.platforms.map((p) => <PlatformTag key={p} id={p} />)}</div>
      <p className={`small ${e.needsBios ? "warn-text" : "muted"}`}>{e.needsBios ? "⚠ " : ""}{e.notes}</p>
      <Usage usage={usage} />
      {e.id === "retroarch" && <PlaylistExport />}
      <pre className="cmd small">{[exePath ?? e.exe, ...e.args].join(" ")}</pre>
      {exePath ? (
        <p className="muted small">Encontrado em <code>{exePath}</code></p>
      ) : (
        <p className="muted small">Executável não encontrado no PATH nem nas pastas de programas.</p>
      )}
      {!e.launchVerified && <p className="muted small">Comando de launch heurístico: confira na versão instalada.</p>}
      <EmulatorInstallPanel emulator={e} />
      {task && (
        <div className="grid gap-1">
          <ProgressBar size="sm" value={task.progress / 100} label={task.label} />
          <span className="muted small">{task.detail ?? task.label}</span>
          <Button variant="ghost" onClick={() => void cancelEmulator(e.id)}><X size={13} aria-hidden /> Cancelar</Button>
        </div>
      )}
      <div className="vcard-foot">
        {e.homepage ? (
          <a className="link" href={e.homepage} target="_blank" rel="noreferrer noopener"><ExternalLink size={13} aria-hidden /> Site</a>
        ) : <span />}
        {installed ? (
          <Button
            variant="ghost"
            disabled={!!task}
            onClick={() => void uninstallEmulator(e.id)}
          >
            <Trash2 size={14} aria-hidden /> Remover
          </Button>
        ) : (
          <Button variant="primary" disabled={!!task} onClick={install}><Download size={14} aria-hidden /> Instalar</Button>
        )}
      </div>
    </article>
  );
}

export function EmulatorsView() {
  const installed = useLibrary((s) => s.emulators);
  const games = useLibrary((s) => s.games);
  const refresh = useLibrary((s) => s.refreshEmulators);
  const usage = useMemo(() => emulatorUsage(games), [games]);
  const [platformId, setPlatformId] = useState("");
  const [onlyInstalled, setOnlyInstalled] = useState(false);
  const list = EMULATORS.filter((e) => (!platformId || e.platforms.includes(platformId)) && (!onlyInstalled || installed[e.id]));
  const covered = PLATFORMS.filter((p) => p.id !== "pc" && EMULATORS.some((e) => e.platforms.includes(p.id)));
  const installedCount = EMULATORS.filter((e) => installed[e.id]).length;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Emuladores</h1>
          <p className="muted">
            {covered.length} de {PLATFORMS.length - 1} plataformas de console têm emulador no catálogo.
            {" "}{installedCount} instalado(s) neste PC, conferido pelo executável em disco.
          </p>
        </div>
        <div className="head-tools">
          <Button variant="secondary" onClick={() => void refresh()}><RefreshCw size={14} aria-hidden /> Reconferir instalados</Button>
          <Select label="Plataforma" value={platformId} onChange={setPlatformId} options={[{ value: "", label: "Todas as plataformas" }, ...PLATFORMS.filter((p) => p.id !== "pc").map((p) => ({ value: p.id, label: p.name }))]} />
          <InstallScript />
          <Checkbox label="Só instalados" checked={onlyInstalled} onChange={setOnlyInstalled} />
        </div>
      </header>
      <div className="cards wide">{list.map((e) => <EmulatorCard key={e.id} emulator={e} usage={usage[e.id]} />)}</div>
      {!list.length && <p className="empty">Nenhum emulador com esses filtros.</p>}
      <section className="section-group gap">
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
