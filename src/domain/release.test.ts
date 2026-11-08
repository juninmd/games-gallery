import capabilityText from "../../src-tauri/capabilities/default.json?raw";
import cargoToml from "../../src-tauri/Cargo.toml?raw";
import cargoLock from "../../src-tauri/Cargo.lock?raw";
import tauriConf from "../../src-tauri/tauri.conf.json?raw";
import { describe, expect, it } from "vitest";
import {
  bumpLevel, bumpVersion, compareSemver, parseCommit, parseSemver, planRelease, renderNotes, stampCargoLock, stampCargoToml, stampJson, titleProblem,
} from "../../scripts/release/lib.mjs";
import { isReleasePageUrl, isUpdateAvailable, parseLatestRelease, summarizeNotes } from "./release";

describe("semver", () => {
  it("parses versions with or without the v prefix and rejects junk", () => {
    expect(parseSemver("v1.2.3")).toEqual({ major: 1, minor: 2, patch: 3, pre: [] });
    expect(parseSemver("1.2.3-rc.1")?.pre).toEqual(["rc", "1"]);
    for (const bad of ["1.2", "01.2.3", "1.2.3.4", "latest", "", "v"]) expect(parseSemver(bad), bad).toBeNull();
  });

  it("orders versions by precedence", () => {
    const ordered = ["0.9.0", "0.10.0", "1.0.0-alpha", "1.0.0-alpha.1", "1.0.0-alpha.beta", "1.0.0-beta", "1.0.0-rc.1", "1.0.0", "1.0.1", "2.0.0"];
    for (let i = 1; i < ordered.length; i++) expect(compareSemver(ordered[i - 1]!, ordered[i]!), `${ordered[i - 1]} < ${ordered[i]}`).toBe(-1);
    expect(compareSemver("1.2.3+build.5", "1.2.3")).toBe(0);
  });
});

describe("parseCommit", () => {
  it("reads type, scope, subject and the squash-merge PR number", () => {
    expect(parseCommit('feat(library): modo "Caixas" com embalagens 3D (#38)')).toEqual({
      type: "feat", scope: "library", breaking: false, subject: 'modo "Caixas" com embalagens 3D', pr: 38,
    });
    expect(parseCommit("fix: corrige a busca")).toMatchObject({ type: "fix", scope: null, pr: null });
  });

  it("detects breaking changes from ! and from the footer", () => {
    expect(parseCommit("feat(api)!: remove o formato antigo")?.breaking).toBe(true);
    expect(parseCommit("refactor: troca o store\n\nBREAKING CHANGE: o backup antigo não abre mais")?.breaking).toBe(true);
    expect(parseCommit("fix: algo\n\nNão é BREAKING CHANGE: no meio da frase")?.breaking).toBe(false);
  });

  it("rejects messages that are not Conventional Commits", () => {
    for (const bad of ["Update README", "Merge pull request #3 from x/y", "feat:sem espaço", "Feat: maiúscula", "wip: algo", "feat(): vazio", "feat: "]) {
      expect(parseCommit(bad), bad).toBeNull();
    }
  });
});

describe("version bump", () => {
  const c = (message: string) => parseCommit(message)!;

  it("feat is minor, fix/perf/revert are patch, the rest releases nothing", () => {
    expect(bumpLevel([c("fix: a"), c("feat: b")], "1.2.3")).toBe("minor");
    expect(bumpLevel([c("fix: a"), c("chore: b")], "1.2.3")).toBe("patch");
    expect(bumpLevel([c("perf: a")], "1.2.3")).toBe("patch");
    expect(bumpLevel([c("docs: a"), c("ci: b"), c("chore(deps): c"), c("test: d"), c("refactor: e")], "1.2.3")).toBeNull();
    expect(bumpLevel([], "1.2.3")).toBeNull();
  });

  it("a breaking change is major from 1.0 and minor while the app is 0.x", () => {
    expect(bumpLevel([c("fix: a"), c("feat!: b")], "1.2.3")).toBe("major");
    expect(bumpLevel([c("feat!: b")], "0.4.1")).toBe("minor");
    expect(bumpLevel([c("chore!: drop node 20")], "2.0.0")).toBe("major");
  });

  it("computes the next version", () => {
    expect(bumpVersion("1.2.3", "patch")).toBe("1.2.4");
    expect(bumpVersion("1.2.3", "minor")).toBe("1.3.0");
    expect(bumpVersion("1.2.3", "major")).toBe("2.0.0");
  });
});

describe("planRelease", () => {
  const commits = (...messages: string[]) => messages.map((m) => parseCommit(m)!);

  it("publishes the package version as the first release", () => {
    expect(planRelease({ previous: null, baseVersion: "0.1.0", commits: [] })).toMatchObject({ release: true, version: "0.1.0" });
  });

  it("bumps from the previous tag using the commits since it", () => {
    expect(planRelease({ previous: "0.1.0", baseVersion: "0.1.0", commits: commits("feat: x", "fix: y") })).toMatchObject({ release: true, version: "0.2.0" });
    expect(planRelease({ previous: "1.4.2", baseVersion: "0.1.0", commits: commits("fix: y") })).toMatchObject({ release: true, version: "1.4.3" });
  });

  it("does not release when nothing publishable landed", () => {
    const plan = planRelease({ previous: "1.0.0", baseVersion: "1.0.0", commits: commits("docs: a", "chore(deps): b") });
    expect(plan.release).toBe(false);
    expect(plan.version).toBeNull();
  });

  it("accepts a forced version only when it is newer and plain", () => {
    expect(planRelease({ previous: "1.0.0", baseVersion: "1.0.0", commits: [], forced: "1.5.0" })).toMatchObject({ release: true, version: "1.5.0" });
    expect(planRelease({ previous: "1.0.0", baseVersion: "1.0.0", commits: [], forced: "1.0.0" }).release).toBe(false);
    expect(planRelease({ previous: "1.0.0", baseVersion: "1.0.0", commits: [], forced: "0.9.0" }).release).toBe(false);
    expect(planRelease({ previous: "1.0.0", baseVersion: "1.0.0", commits: [], forced: "2.0.0-rc.1" }).release).toBe(false);
    expect(planRelease({ previous: null, baseVersion: "0.1.0", commits: [], forced: "oops" }).release).toBe(false);
  });
});

describe("renderNotes", () => {
  const repoUrl = "https://github.com/juninmd/games-gallery";
  const entry = (hash: string, message: string) => ({ hash, commit: parseCommit(message) });

  it("groups by type, links PRs and commits, and ends with the compare link", () => {
    const notes = renderNotes({
      version: "1.1.0", previous: "1.0.0", repoUrl,
      commits: [
        entry("a".repeat(40), "feat(library): modo Caixas (#38)"),
        entry("b".repeat(40), "fix: corrige a busca"),
        entry("c".repeat(40), "chore(deps): bump x"),
        entry("d".repeat(40), "feat(api)!: remove o formato antigo (#40)"),
        { hash: "e".repeat(40), commit: null },
      ],
    });
    expect(notes).toContain("### ⚠️ Mudanças incompatíveis\n\n- **api:** remove o formato antigo ([#40](https://github.com/juninmd/games-gallery/pull/40))");
    expect(notes).toContain("### Novidades\n\n- **library:** modo Caixas ([#38](https://github.com/juninmd/games-gallery/pull/38))");
    expect(notes).toContain("### Correções\n\n- corrige a busca ([bbbbbbb](https://github.com/juninmd/games-gallery/commit/" + "b".repeat(40) + "))");
    expect(notes).not.toContain("bump x");
    expect(notes).toContain("[v1.0.0...v1.1.0](https://github.com/juninmd/games-gallery/compare/v1.0.0...v1.1.0)");
    expect(notes.indexOf("Mudanças incompatíveis")).toBeLessThan(notes.indexOf("Novidades"));
  });

  it("defuses @mentions so a release note cannot ping people", () => {
    const notes = renderNotes({ version: "1.0.1", previous: "1.0.0", repoUrl, commits: [entry("f".repeat(40), "fix(@team): obrigado @someone")] });
    expect(notes).not.toMatch(/@(?!​)/);
  });

  it("has a fallback body for the first release", () => {
    expect(renderNotes({ version: "0.1.0", previous: null, repoUrl, commits: [] })).toBe("Primeira versão publicada.\n");
  });
});

describe("pull request title check", () => {
  it("accepts Conventional Commit titles and explains the rest", () => {
    expect(titleProblem("feat(library): modo Caixas")).toBeNull();
    expect(titleProblem("chore(deps): bump the actions group with 5 updates")).toBeNull();
    expect(titleProblem("Update README")).toMatch(/Conventional Commits/);
    expect(titleProblem("")).toMatch(/vazio/);
    expect(titleProblem(undefined)).toMatch(/vazio/);
  });
});

describe("version stamping", () => {
  it("rewrites the version of the real project files", () => {
    expect(stampCargoToml(cargoToml, "3.4.5")).toContain('[package]\nname = "games-gallery"\nversion = "3.4.5"');
    expect(stampCargoToml(cargoToml, "3.4.5").split("\n").filter((l) => l.startsWith("version =")).length).toBe(1);
    expect(stampCargoLock(cargoLock, "games-gallery", "3.4.5")).toContain('name = "games-gallery"\nversion = "3.4.5"');
    const conf = JSON.parse(stampJson(tauriConf, "3.4.5"));
    expect(conf.version).toBe("3.4.5");
    expect(conf.productName).toBe("Games Gallery");
  });

  it("changes only the version line in the lock file and keeps JSON indentation", () => {
    const before = cargoLock.split("\n");
    const after = stampCargoLock(cargoLock, "games-gallery", "9.9.9").split("\n");
    expect(after).toHaveLength(before.length);
    expect(after.flatMap((line, i) => (line === before[i] ? [] : [line]))).toEqual(['version = "9.9.9"']);
    expect(stampJson('{\n    "version": "1.0.0",\n    "a": 1\n}\n', "2.0.0")).toBe('{\n    "version": "2.0.0",\n    "a": 1\n}\n');
  });

  it("fails loudly when a file has no version to stamp", () => {
    expect(() => stampJson('{"name":"x"}', "1.0.0")).toThrow();
    expect(() => stampCargoToml("[dependencies]\nfoo = 1\n", "1.0.0")).toThrow();
    expect(() => stampCargoLock(cargoLock, "does-not-exist", "1.0.0")).toThrow();
  });
});

describe("parseLatestRelease", () => {
  const release = (over: Record<string, unknown> = {}) => ({
    tag_name: "v1.4.0",
    html_url: "https://github.com/juninmd/games-gallery/releases/tag/v1.4.0",
    draft: false,
    prerelease: false,
    body: "### Novidades\n\n- **library:** modo Caixas",
    published_at: "2026-11-08T17:00:00Z",
    ...over,
  });

  it("reads a published stable release", () => {
    expect(parseLatestRelease(release())).toEqual({
      version: "1.4.0", tag: "v1.4.0", url: "https://github.com/juninmd/games-gallery/releases/tag/v1.4.0",
      notes: "### Novidades\n\n- **library:** modo Caixas", publishedAt: "2026-11-08T17:00:00Z",
    });
  });

  it("rejects drafts, pre-releases, odd tags, foreign links and non-objects", () => {
    expect(parseLatestRelease(release({ draft: true }))).toBeNull();
    expect(parseLatestRelease(release({ prerelease: true }))).toBeNull();
    expect(parseLatestRelease(release({ tag_name: "v1.4.0-rc.1" }))).toBeNull();
    expect(parseLatestRelease(release({ tag_name: "1.4.0" }))).toBeNull();
    expect(parseLatestRelease(release({ tag_name: "nightly" }))).toBeNull();
    expect(parseLatestRelease(release({ html_url: "https://evil.example/releases/tag/v1.4.0" }))).toBeNull();
    expect(parseLatestRelease(release({ html_url: "https://github.com/other/repo/releases/tag/v1.4.0" }))).toBeNull();
    expect(parseLatestRelease(release({ html_url: 42 }))).toBeNull();
    for (const junk of [null, undefined, "x", 5, [], { message: "Not Found" }]) expect(parseLatestRelease(junk)).toBeNull();
  });

  it("tolerates a missing body and date", () => {
    expect(parseLatestRelease(release({ body: null, published_at: null }))).toMatchObject({ notes: "", publishedAt: null });
  });
});

describe("update helpers", () => {
  it("offers an update only for a strictly newer version", () => {
    expect(isUpdateAvailable("0.1.0", "0.2.0")).toBe(true);
    expect(isUpdateAvailable("0.9.0", "0.10.0")).toBe(true);
    expect(isUpdateAvailable("1.0.0", "1.0.0")).toBe(false);
    expect(isUpdateAvailable("1.1.0", "1.0.9")).toBe(false);
    expect(isUpdateAvailable("dev", "1.0.0")).toBe(false);
    expect(isUpdateAvailable("1.0.0", "latest")).toBe(false);
  });

  it("summarises release notes as plain text", () => {
    const text = summarizeNotes("### Novidades\n\n- **library:** modo Caixas ([#38](https://github.com/x/y/pull/38))\n\n\n\n**Changelog completo:** [a](http://b)");
    expect(text).toBe("Novidades\n\n- library: modo Caixas (#38)\n\nChangelog completo: a");
    expect(summarizeNotes("x".repeat(2000), 50)).toHaveLength(51);
  });

  it("only opens release pages of this repository", () => {
    expect(isReleasePageUrl("https://github.com/juninmd/games-gallery/releases")).toBe(true);
    expect(isReleasePageUrl("https://github.com/juninmd/games-gallery/releases/tag/v1.0.0")).toBe(true);
    for (const bad of ["https://github.com/juninmd/games-gallery", "https://github.com/juninmd/games-gallery/releases-evil", "https://github.com.evil.com/juninmd/games-gallery/releases", "http://github.com/juninmd/games-gallery/releases", "https://user@github.com/juninmd/games-gallery/releases", "not a url", "javascript:alert(1)"]) {
      expect(isReleasePageUrl(bad), bad).toBe(false);
    }
  });
});

describe("updater capabilities", () => {
  const capability = JSON.parse(capabilityText);
  const permission = (id: string) => capability.permissions.find((p: unknown) => typeof p === "object" && p !== null && "identifier" in p && p.identifier === id);

  it("allows the updater, a restart and only this repository's release API and pages", () => {
    expect(capability.permissions).toContain("updater:default");
    expect(capability.permissions).toContain("process:allow-restart");
    expect(capability.permissions).not.toContain("process:default");
    expect(permission("http:default").allow.map((e: { url: string }) => e.url)).toContain("https://api.github.com/repos/juninmd/games-gallery/releases/latest");
    const opener: string[] = permission("opener:allow-open-url").allow.map((e: { url: string }) => e.url);
    expect(opener).toContain("https://github.com/juninmd/games-gallery/releases/*");
  });
});
