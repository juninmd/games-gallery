// Pure helpers for the automatic release pipeline. No I/O here so the app, the CI scripts and the
// tests all share the same rules (the app imports the semver half to compare versions).

const SEMVER = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z.-]+)?$/;

/** @param {string} text */
export function parseSemver(text) {
  const m = SEMVER.exec(String(text).trim());
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), pre: m[4] ? m[4].split(".") : [] };
}

/** Semver precedence (build metadata ignored); a pre-release sorts before its release. */
export function compareSemver(a, b) {
  const x = typeof a === "string" ? parseSemver(a) : a;
  const y = typeof b === "string" ? parseSemver(b) : b;
  if (!x || !y) throw new Error("Versão inválida");
  for (const k of ["major", "minor", "patch"]) {
    if (x[k] !== y[k]) return x[k] < y[k] ? -1 : 1;
  }
  if (!x.pre.length || !y.pre.length) return x.pre.length === y.pre.length ? 0 : x.pre.length ? -1 : 1;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i], q = y.pre[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    if (p === q) continue;
    const pn = /^\d+$/.test(p), qn = /^\d+$/.test(q);
    if (pn && qn) return Number(p) < Number(q) ? -1 : 1;
    if (pn !== qn) return pn ? -1 : 1;
    return p < q ? -1 : 1;
  }
  return 0;
}

export const COMMIT_TYPES = ["feat", "fix", "perf", "revert", "docs", "style", "refactor", "test", "build", "ci", "chore"];
const HEADER = /^(?<type>[a-z]+)(?:\((?<scope>[^()\s][^()]*)\))?(?<bang>!)?: (?<subject>\S.*)$/;

/**
 * Parses a Conventional Commit message. Returns null when the first line does not follow
 * `type(scope)!: subject` with one of COMMIT_TYPES.
 * @param {string} message
 */
export function parseCommit(message) {
  const lines = String(message).replace(/\r\n/g, "\n").split("\n");
  const m = HEADER.exec((lines[0] ?? "").trim());
  const g = m?.groups;
  if (!g || !COMMIT_TYPES.includes(g.type)) return null;
  const body = lines.slice(1).join("\n");
  const pr = /\s\(#(\d+)\)$/.exec(g.subject);
  return {
    type: g.type,
    scope: g.scope ?? null,
    breaking: g.bang === "!" || /^BREAKING[ -]CHANGE: \S/m.test(body),
    subject: pr ? g.subject.slice(0, pr.index).trim() : g.subject.trim(),
    pr: pr ? Number(pr[1]) : null,
  };
}

/** Reason a pull request title is not a valid Conventional Commit, or null when it is. */
export function titleProblem(title) {
  const text = String(title ?? "").trim();
  if (!text) return "O título está vazio.";
  if (!parseCommit(text)) {
    return `O título "${text}" não segue Conventional Commits. Use \`tipo(escopo opcional): descrição\`, com tipo em: ${COMMIT_TYPES.join(", ")}.`;
  }
  return null;
}

const RELEASING = new Set(["feat", "fix", "perf", "revert"]);

/**
 * Bump implied by the commits: breaking -> major (minor while the app is 0.x), feat -> minor,
 * fix/perf/revert -> patch, anything else releases nothing.
 */
export function bumpLevel(commits, current) {
  let level = null;
  for (const c of commits) {
    if (c.breaking) { level = "major"; break; }
    if (c.type === "feat") level = "minor";
    else if (RELEASING.has(c.type) && level === null) level = "patch";
  }
  const base = typeof current === "string" ? parseSemver(current) : current;
  if (level === "major" && base && base.major === 0) return "minor";
  return level;
}

export function bumpVersion(current, level) {
  const v = parseSemver(current);
  if (!v) throw new Error(`Versão inválida: ${current}`);
  if (level === "major") return `${v.major + 1}.0.0`;
  if (level === "minor") return `${v.major}.${v.minor + 1}.0`;
  return `${v.major}.${v.minor}.${v.patch + 1}`;
}

/**
 * Decides what to publish.
 * - no previous release: publish `baseVersion` as the first one;
 * - otherwise bump `previous` from the commits since it (nothing releasable -> no release);
 * - `forced` overrides the computed version but must be newer than `previous`.
 * @returns {{ release: boolean, version: string | null, reason: string }}
 */
export function planRelease({ previous, baseVersion, commits, forced }) {
  const last = previous ? parseSemver(previous) : null;
  if (forced) {
    const f = parseSemver(forced);
    if (!f || f.pre.length) return { release: false, version: null, reason: `Versão forçada inválida: ${forced}` };
    if (last && compareSemver(f, last) <= 0) return { release: false, version: null, reason: `A versão forçada ${forced} não é maior que ${previous}.` };
    return { release: true, version: `${f.major}.${f.minor}.${f.patch}`, reason: "Versão informada manualmente." };
  }
  if (!last) {
    const base = parseSemver(baseVersion);
    if (!base || base.pre.length) return { release: false, version: null, reason: `Versão base inválida: ${baseVersion}` };
    return { release: true, version: `${base.major}.${base.minor}.${base.patch}`, reason: "Primeira release." };
  }
  const level = bumpLevel(commits, last);
  if (!level) return { release: false, version: null, reason: "Nenhum commit publicável (feat, fix, perf, revert ou breaking change) desde a última release." };
  return { release: true, version: bumpVersion(`${last.major}.${last.minor}.${last.patch}`, level), reason: `Bump ${level}.` };
}

const SECTIONS = [
  ["breaking", "⚠️ Mudanças incompatíveis"],
  ["feat", "Novidades"],
  ["fix", "Correções"],
  ["perf", "Desempenho"],
  ["revert", "Reversões"],
];

const mention = (text) => text.replace(/@/g, "@​");

/**
 * Markdown release notes grouped by commit type.
 * @param {{ version: string, previous: string | null, repoUrl: string, commits: Array<{ hash: string, commit: ReturnType<typeof parseCommit> }> }} input
 */
export function renderNotes({ version, previous, repoUrl, commits }) {
  const groups = new Map(SECTIONS.map(([key]) => [key, []]));
  for (const { hash, commit } of commits) {
    if (!commit) continue;
    const key = commit.breaking ? "breaking" : RELEASING.has(commit.type) ? commit.type : null;
    if (!key) continue;
    const ref = commit.pr ? `[#${commit.pr}](${repoUrl}/pull/${commit.pr})` : `[${hash.slice(0, 7)}](${repoUrl}/commit/${hash})`;
    const scope = commit.scope ? `**${mention(commit.scope)}:** ` : "";
    groups.get(key).push(`- ${scope}${mention(commit.subject)} (${ref})`);
  }
  const parts = [];
  for (const [key, title] of SECTIONS) {
    const items = groups.get(key);
    if (items.length) parts.push(`### ${title}\n\n${items.join("\n")}`);
  }
  if (!parts.length) parts.push("Primeira versão publicada.");
  if (previous) parts.push(`**Changelog completo:** [v${previous}...v${version}](${repoUrl}/compare/v${previous}...v${version})`);
  return `${parts.join("\n\n")}\n`;
}

/** Rewrites the `version` of the `[package]` table in a Cargo.toml. */
export function stampCargoToml(text, version) {
  const out = text.replace(/(\[package\][^[]*?\nversion\s*=\s*")[^"]+(")/, `$1${version}$2`);
  if (out === text && !text.includes(`version = "${version}"`)) throw new Error("Cargo.toml: versão do pacote não encontrada");
  return out;
}

/** Rewrites the version of one crate in a Cargo.lock. */
export function stampCargoLock(text, name, version) {
  const re = new RegExp(`(\\[\\[package\\]\\]\\nname = "${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\nversion = ")[^"]+(")`);
  if (!re.test(text)) throw new Error(`Cargo.lock: crate ${name} não encontrado`);
  return text.replace(re, `$1${version}$2`);
}

/** Rewrites the top-level `version` of a JSON file, keeping its indentation. */
export function stampJson(text, version) {
  const data = JSON.parse(text);
  if (typeof data !== "object" || data === null || typeof data.version !== "string") throw new Error("JSON sem campo version");
  data.version = version;
  const indent = /^\{\n( +)"/.exec(text)?.[1].length ?? 2;
  return `${JSON.stringify(data, null, indent)}\n`;
}
