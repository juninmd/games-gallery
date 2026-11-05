import { type DeckStatus, type ProtonInfo, parseDeck, parseGamePassIds, parseGamePassTitles, parseProtonDb } from "../domain/compat";
import { httpGetJson } from "./http";

const validAppId = (id: number) => Number.isInteger(id) && id > 0 && id < 2 ** 31;
const notFound = (e: unknown) => e instanceof Error && e.message === "HTTP 404";

/** ProtonDB answers 404 for titles with no reports: that is "no data", not a failure worth retrying. */
export async function fetchProton(appId: number): Promise<ProtonInfo | null> {
  if (!validAppId(appId)) return null;
  try {
    return parseProtonDb(await httpGetJson(`https://www.protondb.com/api/v1/reports/summaries/${appId}.json`)) ?? null;
  } catch (e) {
    if (notFound(e)) return null;
    throw e;
  }
}

export async function fetchDeck(appId: number): Promise<DeckStatus | null> {
  if (!validAppId(appId)) return null;
  return parseDeck(await httpGetJson(`https://store.steampowered.com/saleaction/ajaxgetdeckappcompatibilityreport?nAppID=${appId}`)) ?? null;
}

const PC_GAME_PASS = "fdd9e2a7-0fee-49f6-ad69-4354098401ff";
const BATCH = 40;
const PARALLEL = 3;

/** Every title in the PC Game Pass catalog: one list call, then the product names in small batches. */
export async function fetchGamePassTitles(): Promise<string[]> {
  const ids = parseGamePassIds(await httpGetJson(`https://catalog.gamepass.com/sigls/v2?id=${PC_GAME_PASS}&language=en-us&market=US`));
  if (!ids.length) throw new Error("Catálogo do Game Pass vazio");
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += BATCH) batches.push(ids.slice(i, i + BATCH));
  const titles: string[] = [];
  for (let i = 0; i < batches.length; i += PARALLEL) {
    const part = await Promise.all(batches.slice(i, i + PARALLEL).map(async (ids) =>
      parseGamePassTitles(await httpGetJson(`https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${ids.join(",")}&market=US&languages=en-us&MS-CV=DGU1mcuYo0WMMp+F.1`))));
    titles.push(...part.flat());
  }
  return titles;
}
