import { useState } from "react";
import { Badge } from "@juninmd/sonido";
import { ConsoleSheet } from "../components/ConsoleSheet";
import { CONSOLE_SHEETS } from "../domain/consoleCatalog";
import { FAMILY_LABEL, PLATFORMS } from "../domain/platforms";
import { NO_EMULATOR_NOTE, emulatorsFor } from "../domain/emulators";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";

export function PlatformsView() {
  const games = useLibrary((s) => s.games);
  const emulators = useLibrary((s) => s.emulators);
  const go = useUi((s) => s.go);
  const [open, setOpen] = useState<string | null>(null);
  const openPlatform = PLATFORMS.find((p) => p.id === open) ?? null;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Plataformas</h1>
          <p className="muted">{PLATFORMS.length} plataformas catalogadas, de PC ao PS5.</p>
        </div>
      </header>
      {(Object.keys(FAMILY_LABEL) as (keyof typeof FAMILY_LABEL)[]).map((fam) => (
        <section key={fam} className="section-group">
          <h2>{FAMILY_LABEL[fam]}</h2>
          <div className="cards">
            {PLATFORMS.filter((p) => p.family === fam).map((p) => {
              const mine = games.filter((g) => g.platformId === p.id);
              const emus = emulatorsFor(p.id);
              const ready = emus.some((e) => emulators[e.id]);
              const sheet = CONSOLE_SHEETS[p.id];
              return (
                <button key={p.id} className="pcard" style={{ "--c": p.color } as React.CSSProperties} onClick={() => (sheet ? setOpen(p.id) : go("library", { platformId: p.id }))}>
                  {sheet && <img className="pcard-photo" src={sheet.photo} alt="" loading="lazy" decoding="async" />}
                  <div className="pcard-top"><strong>{p.name}</strong><span>{p.year}</span></div>
                  <div className="pcard-count"><b>{mine.length}</b> jogos · {mine.filter((g) => g.installed).length} instalados</div>
                  {p.id === "pc" ? (
                    <Badge tone="success">Nativo</Badge>
                  ) : emus.length ? (
                    <Badge tone={ready ? "success" : "warning"}>{ready ? "Emulador pronto" : `Instalar: ${emus[0]?.name}`}</Badge>
                  ) : (
                    <Badge tone="danger" title={NO_EMULATOR_NOTE[p.id]}>Sem emulador viável</Badge>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}
      <ConsoleSheet
        platform={openPlatform}
        games={openPlatform ? games.filter((g) => g.platformId === openPlatform.id).length : 0}
        onClose={() => setOpen(null)}
        onBrowse={(platformId) => { setOpen(null); go("library", { platformId }); }}
      />
    </>
  );
}
