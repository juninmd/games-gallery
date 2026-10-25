import { isTauri } from "./runtime";

/** Hosts the app may call; also mirrored in `src-tauri/capabilities/default.json` and vite.config.ts. */
const DEV_PROXY: Record<string, string> = {
  "https://store.steampowered.com": "/proxy/steam",
  "https://api.rawg.io": "/proxy/rawg",
  "https://store-site-backend-static.ak.epicgames.com": "/proxy/epic",
  "https://blog.playstation.com": "/proxy/psblog",
};
const REQUEST_DEADLINE_MS = 30_000;
const JSON_MAX_BYTES = 4 * 1024 * 1024;

/** Browser dev can't call these hosts (no CORS), so it goes through the vite dev proxy. */
export function resolveRequestUrl(url: string, tauri: boolean): string {
  const u = new URL(url);
  const base = `${u.protocol}//${u.host}`;
  const proxy = DEV_PROXY[base];
  if (u.protocol !== "https:" || !proxy) throw new Error("Host não permitido");
  return tauri ? url : `${proxy}${u.pathname}${u.search}`;
}

function timeoutError(): Error { return new Error("Tempo limite da solicitação excedido"); }

async function bounded<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { timedOut = true; controller.abort(); reject(timeoutError()); }, REQUEST_DEADLINE_MS);
  });
  try {
    return await Promise.race([work(controller.signal), timeout]);
  } catch (e) {
    if (timedOut) throw timeoutError();
    if (e instanceof Error && (/^HTTP \d+$/.test(e.message) || e.message === "Resposta excede o limite permitido" || e.message === "Tempo limite da solicitação excedido")) throw e;
    throw new Error("Solicitação de rede falhou");
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function cancelBody(res: Response): Promise<void> {
  try { void res.body?.cancel().catch(() => undefined); } catch { /* best effort */ }
}

async function httpGet(url: string, accept: string, signal: AbortSignal): Promise<Response> {
  const tauri = isTauri();
  const target = resolveRequestUrl(url, tauri);
  const doFetch = tauri ? (await import("@tauri-apps/plugin-http")).fetch : fetch;
  const res = await doFetch(target, { headers: { Accept: accept }, signal });
  if (signal.aborted) {
    void cancelBody(res);
    throw timeoutError();
  }
  if (!res.ok) {
    void cancelBody(res);
    throw new Error(`HTTP ${res.status}`);
  }
  return res;
}

async function readJsonCapped(res: Response, maxBytes: number, signal: AbortSignal): Promise<unknown> {
  if (!res.body) {
    const text = await readWithAbort(res.text(), signal);
    if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error("Resposta excede o limite permitido");
    return JSON.parse(text) as unknown;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  let complete = false;
  try {
    while (true) {
      const { done, value } = await readWithAbort(reader.read(), signal);
      if (done) { complete = true; break; }
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        throw new Error("Resposta excede o limite permitido");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const result = JSON.parse(text) as unknown;
    complete = true;
    return result;
  } finally {
    if (!complete) void reader.cancel().catch(() => undefined);
    try { reader.releaseLock(); } catch { /* reader may still be pending */ }
  }
}

function readWithAbort<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(timeoutError());
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(timeoutError());
    signal.addEventListener("abort", onAbort, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

export async function httpGetJson(url: string): Promise<unknown> {
  return bounded(async (signal) => readJsonCapped(await httpGet(url, "application/json", signal), JSON_MAX_BYTES, signal));
}

/** Reads at most `maxChars` characters and cancels the stream past that, so a hostile host cannot fill memory. */
export async function readCapped(res: Response, maxChars: number, signal?: AbortSignal): Promise<string> {
  if (!res.body) return (await res.text()).slice(0, maxChars);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let complete = false;
  try {
    while (text.length < maxChars) {
      const { done, value } = signal ? await readWithAbort(reader.read(), signal) : await reader.read();
      if (done) { complete = true; break; }
      text += decoder.decode(value, { stream: true });
    }
    if (text.length < maxChars) text += decoder.decode();
    if (text.length >= maxChars) void reader.cancel().catch(() => undefined);
    else complete = true;
    return text.slice(0, maxChars);
  } finally {
    if (!complete) void reader.cancel().catch(() => undefined);
    try { reader.releaseLock(); } catch { /* a timed-out read can still be pending */ }
  }
}

/** Feeds (RSS/XML), capped. */
export async function httpGetText(url: string, maxChars = 3_000_000): Promise<string> {
  return bounded(async (signal) => readCapped(await httpGet(url, "application/rss+xml, application/xml, text/xml", signal), maxChars, signal));
}
