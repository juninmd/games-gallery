import { compareSemver, parseSemver } from "../../scripts/release/lib.mjs";

export const RELEASE_REPO = "juninmd/games-gallery";
export const RELEASES_URL = `https://github.com/${RELEASE_REPO}/releases`;
export const LATEST_RELEASE_API = `https://api.github.com/repos/${RELEASE_REPO}/releases/latest`;

export interface ReleaseInfo {
  /** Version without the leading `v`, e.g. "1.4.0". */
  version: string;
  tag: string;
  /** Release page on GitHub. */
  url: string;
  notes: string;
  publishedAt: string | null;
}

const NOTES_MAX_CHARS = 20_000;

/**
 * Validates the GitHub "latest release" payload. Anything that is not a published, stable
 * `vX.Y.Z` release of this repository is rejected, so a malformed or hostile response can never
 * produce an update prompt.
 */
export function parseLatestRelease(data: unknown): ReleaseInfo | null {
  if (typeof data !== "object" || data === null) return null;
  const r = data as Record<string, unknown>;
  const tag = r["tag_name"];
  const url = r["html_url"];
  if (typeof tag !== "string" || !tag.startsWith("v") || typeof url !== "string") return null;
  if (r["draft"] === true || r["prerelease"] === true) return null;
  const v = parseSemver(tag);
  if (!v || v.pre.length) return null;
  if (!url.startsWith(`${RELEASES_URL}/`)) return null;
  const body = r["body"];
  const published = r["published_at"];
  return {
    version: `${v.major}.${v.minor}.${v.patch}`,
    tag,
    url,
    notes: typeof body === "string" ? body.slice(0, NOTES_MAX_CHARS) : "",
    publishedAt: typeof published === "string" ? published : null,
  };
}

/** True when `latest` is a newer version than `current`; an unparsable current version never prompts. */
export function isUpdateAvailable(current: string, latest: string): boolean {
  if (!parseSemver(current) || !parseSemver(latest)) return false;
  return compareSemver(latest, current) > 0;
}

/** Release notes as plain text for a small panel: links and markdown markers removed, bounded length. */
export function summarizeNotes(markdown: string, maxChars = 700): string {
  const text = markdown
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*/g, "")
    .replace(/​/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > maxChars ? `${text.slice(0, maxChars).trimEnd()}…` : text;
}

/** Only this repository's release pages may be opened from the update prompt. */
export function isReleasePageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const base = `/${RELEASE_REPO}/releases`;
    return u.protocol === "https:" && u.host === "github.com" && !u.username && !u.password && (u.pathname === base || u.pathname.startsWith(`${base}/`));
  } catch {
    return false;
  }
}
