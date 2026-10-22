import { FAMILY_LABEL, PLATFORMS } from "../domain/platforms";
import { NO_EMULATOR_NOTE, emulatorsFor } from "../domain/emulators";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";

export function PlatformsView() {
  const games = useLibrary((s) => s.games);
  const emulators = useLibrary((s) => s.emulators);
  const go = useUi((s) => s.go);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Plataformas</h1>
          <p className="muted">{PLATFORMS.length} plataformas catalogadas, de PC ao PS5.</p>
        </div>
      </header>
      {(Object.keys(FAMILY_LABEL) as (keyof typeof FAMILY_LABEL)[]).map((fam) => (
        <section key={fam} className="group">
          <h2>{FAMILY_LABEL[fam]}</h2>
          <div className="cards">
            {PLATFORMS.filter((p) => p.family === fam).map((p) => {
              const mine = games.filter((g) => g.platformId === p.id);
              const emus = emulatorsFor(p.id);
              const ready = emus.some((e) => emulators[e.id]);
              return (
                <button key={p.id} className="pcard" style={{ "--c": p.color } as React.CSSProperties} onClick={() => go("library", { platformId: p.id })}>
                  <div className="pcard-top"><strong>{p.name}</strong><span>{p.year}</span></div>
                  <div className="pcard-count"><b>{mine.length}</b> jogos · {mine.filter((g) => g.installed).length} instalados</div>
                  {p.id === "pc" ? (
                    <span className="tag ok">Nativo</span>
                  ) : emus.length ? (
                    <span className={`tag ${ready ? "ok" : "warn"}`}>{ready ? "Emulador pronto" : `Instalar: ${emus[0]?.name}`}</span>
                  ) : (
                    <span className="tag bad" title={NO_EMULATOR_NOTE[p.id]}>Sem emulador viável</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
