import { Button, Dialog } from "@juninmd/sonido";
import { CONSOLE_SHEETS, KIND_LABEL } from "../domain/consoleCatalog";
import type { Platform } from "../domain/types";

interface Props {
  platform: Platform | null;
  games: number;
  onClose: () => void;
  onBrowse: (platformId: string) => void;
}

/** Museum-style sheet for one console: photo, short history and hardware. */
export function ConsoleSheet({ platform, games, onClose, onBrowse }: Props) {
  const sheet = platform ? CONSOLE_SHEETS[platform.id] : undefined;
  const meta = platform ? [sheet?.maker, platform.year, sheet && KIND_LABEL[sheet.kind]].filter(Boolean).join(" · ") : "";
  return (
    <Dialog
      open={Boolean(platform)}
      onClose={onClose}
      title={platform?.name ?? "Plataforma"}
      description={meta}
      className="console-sheet"
      footer={platform && (
        <>
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
          <Button onClick={() => onBrowse(platform.id)}>{games ? `Ver ${games} jogos` : "Abrir na biblioteca"}</Button>
        </>
      )}
    >
      {sheet && (
        <>
          <figure className="cs-photo" style={{ "--c": platform?.color } as React.CSSProperties}>
            <img src={sheet.photo} alt={`Foto do ${platform?.name}`} decoding="async" />
          </figure>
          <p className="cs-history">{sheet.history}</p>
          <dl className="cs-specs">
            {sheet.specs.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>
          <p className="cs-credit muted">Foto: Wikimedia Commons (créditos em platforms/CREDITS.md). Texto adaptado do iBox.</p>
        </>
      )}
    </Dialog>
  );
}
