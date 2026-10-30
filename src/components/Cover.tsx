import { useState } from "react";
import { PLATFORM_BY_ID } from "../domain/platforms";
import type { Game } from "../domain/types";

/** Real art when available; otherwise a generated cover tinted with the platform color. */
export function Cover({ game }: { game: Pick<Game, "title" | "platformId" | "coverUrl"> }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const platform = PLATFORM_BY_ID[game.platformId];
  const src = game.coverUrl && game.coverUrl !== failedUrl ? game.coverUrl : null;

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
