/** `url` normalized when it is https, carries no credentials and points at one of `hosts`; otherwise undefined. */
export function safeUrl(url: string | undefined, hosts: Set<string>): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !u.username && !u.password && hosts.has(u.host) ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}
