import { isTauri } from "./runtime";

/** API keys go to the OS credential store through allow-listed Rust commands; the browser has none. */
export type VaultName = "steamKey" | "rawgKey";

export const vaultAvailable = () => isTauri();

async function call<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

export const vaultGet = (name: VaultName): Promise<string | null> => call("secret_get", { name });
export const vaultSet = (name: VaultName, value: string): Promise<void> => call("secret_set", { name, value });
export const vaultDelete = (name: VaultName): Promise<void> => call("secret_delete", { name });
