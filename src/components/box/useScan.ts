import { useEffect, useState } from "react";
import { fullCoverUrls } from "../../domain/gametdb";
import type { Game } from "../../domain/types";

/** Found scans by game id, so a box re-mounted on the shelf does not probe again. */
const found = new Map<string, string | null>();

function probe(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

/** First GameTDB full scan that loads (CSS backgrounds give no error event), or null. */
export function useFullScan(game: Pick<Game, "id" | "platformId" | "romSerial">): string | null {
  const key = `${game.id}:${game.romSerial ?? ""}`;
  const [url, setUrl] = useState<string | null>(() => found.get(key) ?? null);
  useEffect(() => {
    const candidates = fullCoverUrls(game.platformId, game.romSerial);
    if (!candidates.length || found.has(key)) {
      setUrl(found.get(key) ?? null);
      return;
    }
    let alive = true;
    void (async () => {
      for (const candidate of candidates) {
        if (await probe(candidate)) {
          found.set(key, candidate);
          if (alive) setUrl(candidate);
          return;
        }
      }
      found.set(key, null);
    })();
    return () => { alive = false; };
  }, [key, game.platformId, game.romSerial]);
  return url;
}
