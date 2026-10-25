import capabilityText from "../../src-tauri/capabilities/default.json?raw";
import { describe, expect, it } from "vitest";
import { EMULATORS } from "./emulators";

const capability = JSON.parse(capabilityText);
const permission = capability.permissions.find((p: unknown) => typeof p === "object" && p !== null && "identifier" in p && p.identifier === "opener:allow-open-url");
const urls: string[] = permission.allow.map((entry: { url: string }) => entry.url);

describe("opener capability boundary", () => {
  it("does not grant broad default URL or filesystem-reveal permissions", () => {
    expect(capability.permissions).not.toContain("opener:default");
    expect(capability.permissions).not.toContain("opener:allow-default-urls");
    expect(urls).not.toContain("https://*");
    expect(urls).not.toContain("http://*");
  });

  it("keeps every catalog homepage and official download link explicitly permitted", () => {
    for (const emulator of EMULATORS) {
      for (const url of [emulator.homepage, emulator.install?.downloadUrl]) {
        if (url) expect(urls, `${emulator.id}: ${url}`).toContain(new URL(url).href);
      }
    }
  });

  it("does not authorize arbitrary GitHub repositories through a wildcard", () => {
    expect(urls.filter((url) => url.startsWith("https://github.com/"))).not.toHaveLength(0);
    expect(urls.filter((url) => url.startsWith("https://github.com/"))).not.toContain("https://github.com/*");
  });
});
