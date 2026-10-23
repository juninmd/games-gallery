import { isTauri } from "./runtime";

/** Hosts the app may call; also mirrored in `src-tauri/capabilities/default.json` and vite.config.ts. */
const DEV_PROXY: Record<string, string> = {
  "https://store.steampowered.com": "/proxy/steam",
  "https://api.rawg.io": "/proxy/rawg",
  "https://store-site-backend-static.ak.epicgames.com": "/proxy/epic",
  "https://blog.playstation.com": "/proxy/psblog",
};

/** Browser dev can't call these hosts (no CORS), so it goes through the vite dev proxy. */
export function resolveRequestUrl(url: string, tauri: boolean): string {
  const u = new URL(url);
  const base = `${u.protocol}//${u.host}`;
  const proxy = DEV_PROXY[base];
  if (u.protocol !== "https:" || !proxy) throw new Error(`Host não permitido: ${u.host}`);
  return tauri ? url : `${proxy}${u.pathname}${u.search}`;
}

async function httpGet(url: string, accept: string): Promise<Response> {
  const tauri = isTauri();
  const target = resolveRequestUrl(url, tauri);
  const doFetch = tauri ? (await import("@tauri-apps/plugin-http")).fetch : fetch;
  const res = await doFetch(target, { headers: { Accept: accept } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

export async function httpGetJson(url: string): Promise<unknown> {
  return (await httpGet(url, "application/json")).json();
}

/** Reads at most `maxChars` characters and cancels the stream past that, so a hostile host cannot fill memory. */
export async function readCapped(res: Response, maxChars: number): Promise<string> {
  if (!res.body) return (await res.text()).slice(0, maxChars);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (text.length < maxChars) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  await reader.cancel().catch(() => undefined);
  return text.slice(0, maxChars);
}

/** Feeds (RSS/XML), capped. */
export async function httpGetText(url: string, maxChars = 3_000_000): Promise<string> {
  return readCapped(await httpGet(url, "application/rss+xml, application/xml, text/xml"), maxChars);
}
