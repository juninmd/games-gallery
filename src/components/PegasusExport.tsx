import { Button } from "@juninmd/sonido";
import { FileOutput } from "lucide-react";
import { useMemo } from "react";
import { buildPegasusMetadata } from "../domain/pegasus";
import { saveFiles } from "../platform/exportFiles";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";

/** Exports the ROM library as a Pegasus Frontend metadata file. */
export function PegasusExport() {
  const games = useLibrary((s) => s.games);
  const emulators = useLibrary((s) => s.emulators);
  const emulatorPaths = useLibrary((s) => s.emulatorPaths);
  const toast = useUi((s) => s.toast);
  const { text, count } = useMemo(() => buildPegasusMetadata(games, { installed: emulators, exePaths: emulatorPaths }), [games, emulators, emulatorPaths]);

  const run = async () => {
    try {
      const renamed = await saveFiles([{ name: "metadata.pegasus.txt", text }]);
      if (renamed === null) return;
      toast(`${count} jogos exportados${renamed ? " como “metadata.pegasus (gallery).txt”, porque o arquivo já existia" : ""}. Adicione a pasta nas fontes de jogos do Pegasus.`);
    } catch (e) {
      toast(`Falha ao exportar: ${String(e)}`);
    }
  };

  return (
    <section className="panel narrow">
      <h3 aria-level={2}>Pegasus Frontend</h3>
      <p className="muted small">
        Gera um <code>metadata.pegasus.txt</code> com uma coleção por plataforma, o comando do emulador já configurado e cada ROM com
        caminho completo, ano, gênero e sua nota. Salve numa pasta e adicione essa pasta em Configurações → Diretórios de jogos do Pegasus.
      </p>
      <div className="actions">
        <Button variant="secondary" disabled={!count} onClick={() => void run()}><FileOutput size={14} aria-hidden /> Exportar {count} jogo(s)</Button>
      </div>
    </section>
  );
}
