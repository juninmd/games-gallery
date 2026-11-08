#!/usr/bin/env node
// Fails when the pull request title (read from $PR_TITLE) is not a Conventional Commit. Squash merges
// use the title as the commit message, so it is what drives the automatic version bump.
import { titleProblem } from "./lib.mjs";

const problem = titleProblem(process.env.PR_TITLE);
if (problem) {
  console.error(problem);
  console.error("Exemplos: `feat(library): modo Caixas`, `fix: corrige a busca`, `feat!: remove o formato antigo`.");
  process.exit(1);
}
console.log("Título válido.");
