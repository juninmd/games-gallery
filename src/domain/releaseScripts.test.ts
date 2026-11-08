/// <reference types="node" />
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// End-to-end checks of the CI scripts against a throwaway git repository.
const scripts = resolve(__dirname, "../../scripts/release");
const sandboxes: string[] = [];
afterAll(() => { for (const dir of sandboxes) rmSync(dir, { recursive: true, force: true }); });

const identity = { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), "release-test-"));
  sandboxes.push(dir);
  const git = (...args: string[]) => execFileSync("git", ["-c", "commit.gpgsign=false", ...args], { cwd: dir, env: { ...process.env, ...identity }, encoding: "utf8" });
  git("init", "-q");
  writeFileSync(join(dir, "package.json"), '{ "name": "x", "version": "0.1.0" }\n');
  const commit = (message: string) => git("commit", "-q", "--allow-empty", "-m", message);
  const plan = (env: Record<string, string> = {}) => {
    const out = join(dir, "github-output.txt");
    writeFileSync(out, "");
    execFileSync("node", [join(scripts, "plan.mjs")], { cwd: dir, env: { ...process.env, GITHUB_OUTPUT: out, GITHUB_REPOSITORY: "o/r", ...env }, encoding: "utf8" });
    const outputs = Object.fromEntries(readFileSync(out, "utf8").trim().split("\n").map((l) => l.split("=") as [string, string]));
    return { outputs, notes: () => readFileSync(join(dir, "release-notes.md"), "utf8") };
  };
  git("add", "-A");
  return { dir, git, commit, plan };
}

describe("plan.mjs", () => {
  it("publishes the package version first, then bumps from the last tag", () => {
    const repo = sandbox();
    repo.commit("feat: primeira versão");
    expect(repo.plan().outputs).toMatchObject({ release: "true", version: "0.1.0", tag: "v0.1.0", previous: "" });

    repo.git("tag", "v0.1.0");
    repo.commit("docs: leia-me");
    expect(repo.plan().outputs.release).toBe("false");

    repo.commit("fix(ui): corrige o botão (#7)");
    repo.commit("feat(api): novo endpoint (#8)");
    const next = repo.plan();
    expect(next.outputs).toMatchObject({ release: "true", version: "0.2.0", tag: "v0.2.0", previous: "0.1.0" });
    expect(next.notes()).toContain("- **api:** novo endpoint ([#8](https://github.com/o/r/pull/8))");
    expect(next.notes()).toContain("[v0.1.0...v0.2.0](https://github.com/o/r/compare/v0.1.0...v0.2.0)");
  });

  it("respects [skip release], an existing tag and a forced version", () => {
    const repo = sandbox();
    repo.commit("feat: base");
    repo.git("tag", "v1.0.0");
    repo.commit("fix: algo [skip release]");
    expect(repo.plan().outputs.release).toBe("false");
    expect(repo.plan({ FORCE_VERSION: "v1.4.0" }).outputs).toMatchObject({ release: "true", version: "1.4.0" });
    expect(repo.plan({ FORCE_VERSION: "1.0.0" }).outputs.release).toBe("false");
  });

  it("ignores pre-release tags and picks the highest stable one", () => {
    const repo = sandbox();
    repo.commit("feat: base");
    repo.git("tag", "v1.9.0");
    repo.commit("feat: mais");
    repo.git("tag", "v1.10.0");
    repo.git("tag", "v2.0.0-rc.1");
    repo.commit("fix: ajuste");
    expect(repo.plan().outputs).toMatchObject({ release: "true", version: "1.10.1", previous: "1.10.0" });
  });
});

describe("stamp.mjs", () => {
  it("stamps every version file and refuses anything but major.minor.patch", () => {
    const dir = mkdtempSync(join(tmpdir(), "stamp-test-"));
    sandboxes.push(dir);
    const root = resolve(__dirname, "../..");
    mkdirSync(join(dir, "scripts/release"), { recursive: true });
    mkdirSync(join(dir, "src-tauri"), { recursive: true });
    for (const f of ["lib.mjs", "stamp.mjs"]) copyFileSync(join(scripts, f), join(dir, "scripts/release", f));
    for (const f of ["package.json", "src-tauri/tauri.conf.json", "src-tauri/Cargo.toml", "src-tauri/Cargo.lock"]) copyFileSync(join(root, f), join(dir, f));

    const bad = spawnSync("node", [join(dir, "scripts/release/stamp.mjs"), "1.2.3-rc.1"], { encoding: "utf8" });
    expect(bad.status).toBe(1);

    execFileSync("node", [join(dir, "scripts/release/stamp.mjs"), "v7.8.9"]);
    expect(JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).version).toBe("7.8.9");
    expect(JSON.parse(readFileSync(join(dir, "src-tauri/tauri.conf.json"), "utf8")).version).toBe("7.8.9");
    expect(readFileSync(join(dir, "src-tauri/Cargo.toml"), "utf8")).toContain('version = "7.8.9"');
    expect(readFileSync(join(dir, "src-tauri/Cargo.lock"), "utf8")).toContain('name = "games-gallery"\nversion = "7.8.9"');
  });
});

describe("check-title.mjs", () => {
  const run = (title: string) => spawnSync("node", [join(scripts, "check-title.mjs")], { env: { ...process.env, PR_TITLE: title }, encoding: "utf8" });

  it("passes Conventional Commit titles and fails the rest with an explanation", () => {
    expect(run("feat(library): modo Caixas").status).toBe(0);
    const bad = run("Atualiza o README");
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain("Conventional Commits");
  });
});
