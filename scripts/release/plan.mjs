#!/usr/bin/env node
// Decides whether main needs a new release and what its notes say, from Conventional Commits
// since the last `v*` tag. Writes `release`, `version`, `tag` and `previous` to $GITHUB_OUTPUT and the
// notes to $NOTES_FILE. Input comes only from git and the environment, never from a shell string.
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { compareSemver, parseCommit, parseSemver, planRelease, renderNotes } from "./lib.mjs";

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const repo = process.env.GITHUB_REPOSITORY || "juninmd/games-gallery";
const repoUrl = `https://github.com/${repo}`;
const notesFile = process.env.NOTES_FILE || "release-notes.md";
const forced = (process.env.FORCE_VERSION || "").trim().replace(/^v/, "") || null;

function lastTag() {
  const tags = git("tag", "--list", "v[0-9]*", "--merged", "HEAD").split("\n").map((t) => t.trim())
    .filter((t) => { const v = parseSemver(t); return v && !v.pre.length; });
  tags.sort((a, b) => compareSemver(b, a));
  return tags[0] ?? null;
}

function commitsSince(tag) {
  const out = git("log", "--no-merges", "--format=%H%x1f%B%x1e", tag ? `${tag}..HEAD` : "HEAD");
  return out.split("\x1e").map((r) => r.trim()).filter(Boolean).map((record) => {
    const [hash, ...rest] = record.split("\x1f");
    return { hash: hash.trim(), message: rest.join("\x1f") };
  });
}

function output(values) {
  const lines = Object.entries(values).map(([k, v]) => `${k}=${v}`).join("\n");
  console.log(lines);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${lines}\n`);
}

const tag = lastTag();
const previous = tag ? tag.replace(/^v/, "") : null;
const head = git("log", "-1", "--format=%B").trim();
const baseVersion = JSON.parse(readFileSync("package.json", "utf8")).version;
const raw = commitsSince(tag);
const parsed = raw.map(({ hash, message }) => ({ hash, commit: parseCommit(message) }));

let plan = planRelease({ previous, baseVersion, commits: parsed.flatMap((c) => (c.commit ? [c.commit] : [])), forced });
if (plan.release && !forced && head.includes("[skip release]")) plan = { release: false, version: null, reason: "O commit mais recente pede [skip release]." };
if (plan.release && git("tag", "--list", `v${plan.version}`).trim()) plan = { release: false, version: null, reason: `A tag v${plan.version} já existe.` };

console.log(`Última release: ${tag ?? "nenhuma"} · ${raw.length} commit(s) analisado(s)\n${plan.reason}`);
if (!plan.release) {
  output({ release: "false", version: "", tag: "", previous: previous ?? "" });
} else {
  writeFileSync(notesFile, renderNotes({ version: plan.version, previous, repoUrl, commits: parsed }));
  output({ release: "true", version: plan.version, tag: `v${plan.version}`, previous: previous ?? "" });
}
