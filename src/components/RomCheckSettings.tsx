import { FileCheck2, FileUp } from "lucide-react";
import { useState } from "react";
import { pickTextFile } from "../platform/files";
import { isTauri } from "../platform/runtime";
import { hashable, identifyRoms, MAX_ROMS_PER_RUN, useDat } from "../state/dat";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";

/** Loads the user's DAT and hashes ROMs to tell apart ambiguous `.bin`/`.iso` files. */
export function RomCheckSettings() {
  const source = useDat((s) => s.source);
  const entries = useDat((s) => s.index.size);
  const load = useDat((s) => s.load);
  const roms = useLibrary((s) => hashable(s.games).length);
  const toast = useUi((s) => s.toast);
  const [busy, setBusy] = useState(false);
  const native = isTauri();

  const pickDat = async () => {
    try {
      const text = await pickTextFile("dat");
      if (text === null) return;
      const n = load(text, "DAT carregado");
      toast(n ? `DAT com ${n.toLocaleString("pt-BR")} ROMs carregado` : "Esse arquivo não parece um DAT Logiqx (No-Intro/Redump)");
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    }
  };

  const run = async () => {
    setBusy(true);
    try {
      const { matched, hashed, failed } = await identifyRoms();
      toast(`${hashed} ROMs conferidas, ${matched} no DAT${failed ? `, ${failed} com erro de leitura` : ""}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel narrow">
      <h3 aria-level={2}>Identificar ROMs (CRC32 + DAT)</h3>
      <p className="muted small">
        O app calcula o CRC32 de cada ROM no seu computador e confere com um DAT que você fornece (formato Logiqx, como os da
        No-Intro e da Redump). Nada é baixado ou enviado. ROMs compactadas (.zip/.7z) ficam de fora, porque o DAT lista o arquivo
        descompactado. O CRC também vai para a playlist do RetroArch.
      </p>
      <p className="small">{entries ? `${source}: ${entries.toLocaleString("pt-BR")} ROMs na memória` : "Nenhum DAT carregado nesta sessão."}</p>
      <div className="actions">
        <button className="btn" onClick={() => void pickDat()}><FileUp size={14} aria-hidden /> Carregar DAT</button>
        <button className="btn" disabled={!native || busy || roms === 0} onClick={() => void run()} title={native ? undefined : "Só no app instalado"}>
          <FileCheck2 size={14} aria-hidden /> Conferir ROMs (até {Math.min(roms, MAX_ROMS_PER_RUN)})
        </button>
      </div>
    </section>
  );
}
