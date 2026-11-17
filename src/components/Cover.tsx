import { useEffect, useState } from "react";
import { cachedCoverSrc } from "../platform/covers";
import { isTauri } from "../platform/runtime";
import { PLATFORM_BY_ID } from "../domain/platforms";
import type { Game } from "../domain/types";

/** Real art when available; otherwise a generated cover tinted with the platform color. */
export function Cover({ game }: { game: Pick<Game, "title" | "platformId" | "coverUrl"> }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [cached, setCached] = useState<{ from: string; src: string } | null>(null);
  const platform = PLATFORM_BY_ID[game.platformId];
  useEffect(() => {
    if (!game.coverUrl) return;
    let live = true;
    void cachedCoverSrc(game.coverUrl).then((src) => live && setCached({ from: game.coverUrl!, src }));
    return () => { live = false; };
  }, [game.coverUrl]);
  // Installed app: wait for the cache so the remote image is not downloaded twice.
  const resolved = cached && cached.from === game.coverUrl ? cached.src : isTauri() ? undefined : game.coverUrl;
  const src = resolved && resolved !== failedUrl ? resolved : null;

  return (
    <div className="cover" style={{ "--c": platform?.color ?? "#555" } as React.CSSProperties}>
      {src ? (
        <>
          <img className="cover-bg" src={src} alt="" aria-hidden loading="lazy" decoding="async" />
          <img
            className="cover-img"
            src={src}
            alt={`Capa de ${game.title}`}
            loading="lazy"
            decoding="async"
            onError={() => setFailedUrl(src)}
          />
        </>
      ) : (
        <div className="cover-fallback" role="img" aria-label={`Capa gerada de ${game.title}`}>
          <span className="cover-plat">{platform?.short}</span>
          <span className="cover-title">{game.title}</span>
        </div>
      )}
    </div>
  );
}
