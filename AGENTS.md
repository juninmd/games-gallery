# AGENTS.md

Instruções para agentes que trabalham neste repositório.

<!-- base-actions-main-policy -->
## GitHub Actions — padrão obrigatório (@main)

- Referencie as actions internas sempre pelo branch, nunca por SHA:
  - `uses: juninmd/base-actions/<action>@main`
  - `uses: juninmd/base-actions/.github/workflows/<arquivo>.yml@main`
- Não fixe `@<sha>` em `juninmd/base-actions`: a atualização é centralizada no
  `main` e passa a valer no próximo run.
- PRs cujos checks não iniciam por billing/spending limit são mesclados pelo bot central
  `juninmd/base-actions/.github/workflows/auto-merge-billing-blocked.yml`.
  Para impedir o merge automático de um PR, aplique a label `do-not-merge`.
## Commits e releases

- Mensagens de commit e títulos de PR seguem Conventional Commits (`feat(escopo): descrição`,
  `fix: ...`, `feat!: ...`). O `auto-release` calcula a versão e publica a release a partir deles
  (`feat` → minor, `fix`/`perf`/`revert` → patch, breaking → major); `docs`, `chore`, `ci` etc. não publicam.
- Não altere a versão à mão em `package.json`, `tauri.conf.json` ou `Cargo.toml` para lançar: a tag é a fonte.
- Mudou o `scripts/release/lib.mjs`? Atualize `lib.d.mts` e `src/domain/release.test.ts`.
