/** ca.account.sony.com/api/v1/ssocookie shows `{"npsso":"…"}`; users paste either that JSON or just the value. */
export function extractNpsso(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  let candidate = text;
  if (text.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(text);
      const value = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>)["npsso"] : undefined;
      candidate = typeof value === "string" ? value : "";
    } catch {
      return null;
    }
  }
  candidate = candidate.replace(/^["']|["']$/g, "");
  return /^[A-Za-z0-9]{64}$/.test(candidate) ? candidate : null;
}
