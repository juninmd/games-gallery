#!/usr/bin/env node
// Writes a release version into every file that carries the app version. Used by the release workflow
// on its own checkout, so the repository keeps no version-bump commits: the git tag is the source of truth.
import { readFileSync, writeFileSync } from "node:fs";
import { parseSemver, stampCargoLock, stampCargoToml, stampJson } from "./lib.mjs";

const version = (process.argv[2] ?? "").replace(/^v/, "");
const parsed = parseSemver(version);
if (!parsed || parsed.pre.length) {
  console.error(`Uso: node scripts/release/stamp.mjs <major.minor.patch> (recebido: "${process.argv[2] ?? ""}")`);
  process.exit(1);
}

const root = new URL("../../", import.meta.url);
const edit = (path, change) => {
  const file = new URL(path, root);
  writeFileSync(file, change(readFileSync(file, "utf8")));
  console.log(`${path} -> ${version}`);
};

edit("package.json", (t) => stampJson(t, version));
edit("src-tauri/tauri.conf.json", (t) => stampJson(t, version));
edit("src-tauri/Cargo.toml", (t) => stampCargoToml(t, version));
edit("src-tauri/Cargo.lock", (t) => stampCargoLock(t, "games-gallery", version));
