import { readCapped } from "./http";
import { isTauri } from "./runtime";

/** Shared by the store-account importers: native HTTP only, every request (body read included) has a deadline. */
export const DEADLINE_MS = 20_000;
export const REVOKE_DEADLINE_MS = 5_000;
const MAX_CHARS = 4_000_000;

export interface Pending {
  res: Response;
  signal: AbortSignal;
}

export async function request(url: string, init: RequestInit, ms = DEADLINE_MS): Promise<Pending> {
  if (!isTauri()) throw new Error("O login das lojas só funciona no app instalado (essas APIs não aceitam o navegador).");
  const { fetch } = await import("@tauri-apps/plugin-http");
  const signal = AbortSignal.timeout(ms);
  return { res: await fetch(url, { ...init, signal }), signal };
}

export async function readJson({ res, signal }: Pending): Promise<unknown> {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return JSON.parse(await readCapped(res, MAX_CHARS, signal)) as unknown;
}
