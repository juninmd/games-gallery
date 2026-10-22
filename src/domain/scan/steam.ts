export interface SteamManifest {
  appId: number;
  name: string;
  sizeGb?: number;
}

const field = (text: string, key: string) =>
  new RegExp(`"${key}"\\s+"([^"]*)"`, "i").exec(text)?.[1];

/** Valve KeyValues `appmanifest_<id>.acf`: flat quoted pairs are enough for appid/name/SizeOnDisk. */
export function parseAppManifest(text: string): SteamManifest | null {
  const appId = Number(field(text, "appid"));
  const name = field(text, "name")?.trim();
  if (!Number.isInteger(appId) || appId <= 0 || !name) return null;
  const bytes = Number(field(text, "SizeOnDisk"));
  const sizeGb = bytes > 0 ? Math.round((bytes / 1024 ** 3) * 10) / 10 : undefined;
  return { appId, name, sizeGb };
}

/** Redistributables, Proton and runtimes ship appmanifests too but are not games. */
export const isSteamTool = (name: string) =>
  /^(steamworks common redistributables|proton\b|steam linux runtime|steamvr$)/i.test(name.trim());

export const isManifestPath = (path: string) => /(^|\/)appmanifest_\d+\.acf$/i.test(path);
