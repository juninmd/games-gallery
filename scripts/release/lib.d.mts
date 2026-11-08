export interface Semver { major: number; minor: number; patch: number; pre: string[] }
export interface Commit { type: string; scope: string | null; breaking: boolean; subject: string; pr: number | null }
export type BumpLevel = "major" | "minor" | "patch";

export const COMMIT_TYPES: string[];
export function parseSemver(text: string): Semver | null;
export function compareSemver(a: string | Semver, b: string | Semver): -1 | 0 | 1;
export function parseCommit(message: string): Commit | null;
export function titleProblem(title: string | null | undefined): string | null;
export function bumpLevel(commits: Commit[], current: string | Semver): BumpLevel | null;
export function bumpVersion(current: string, level: BumpLevel): string;
export function planRelease(input: {
  previous: string | null;
  baseVersion: string;
  commits: Commit[];
  forced?: string | null;
}): { release: boolean; version: string | null; reason: string };
export function renderNotes(input: {
  version: string;
  previous: string | null;
  repoUrl: string;
  commits: Array<{ hash: string; commit: Commit | null }>;
}): string;
export function stampCargoToml(text: string, version: string): string;
export function stampCargoLock(text: string, name: string, version: string): string;
export function stampJson(text: string, version: string): string;
