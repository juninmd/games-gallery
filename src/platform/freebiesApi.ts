import { type Freebie, type PsPlusMonth, findPsPlusMonth, parseEpicFree, parseFeed } from "../domain/freebies";
import { httpGetJson, httpGetText } from "./http";

const EPIC_URL = "https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=pt-BR&country=BR&allowCountries=BR";
const FEED_URL = "https://blog.playstation.com/feed/";

/** The blog's robots.txt asks for a 5 s crawl delay; the monthly post sits a few feed pages back. */
export const PS_CRAWL_DELAY_MS = 5000;
export const PS_MAX_PAGES = 6;

export const fetchEpicFree = async (): Promise<Freebie[]> => parseEpicFree(await httpGetJson(EPIC_URL));

export interface PsDeps {
  get: (url: string) => Promise<string>;
  wait: (ms: number) => Promise<void>;
}

const realDeps: PsDeps = { get: (u) => httpGetText(u), wait: (ms) => new Promise((r) => setTimeout(r, ms)) };

/** Walks feed pages one at a time (with the crawl delay between them) until the monthly post shows up. */
export async function fetchPsPlusMonth(onPage?: (page: number) => void, deps: PsDeps = realDeps): Promise<PsPlusMonth | null> {
  for (let page = 1; page <= PS_MAX_PAGES; page++) {
    if (page > 1) await deps.wait(PS_CRAWL_DELAY_MS);
    onPage?.(page);
    const found = findPsPlusMonth(parseFeed(await deps.get(page === 1 ? FEED_URL : `${FEED_URL}?paged=${page}`)));
    if (found) return found;
  }
  return null;
}
