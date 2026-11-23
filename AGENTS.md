# AGENTS.md

Games Gallery: desktop app (Tauri 2) that catalogs PC and console games, with cover art, play status and emulator management. The library comes from locally installed launchers.

## Stack

- Tauri 2 (Rust in `src-tauri/`), React 19, TypeScript, Vite
- Tailwind CSS v4, motion
- pnpm 10.34.5, Node 22.12+ / 24.x / 26+
- Vitest (tests), actionlint-validated GitHub Actions

## Commands

- Install: `pnpm install`
- UI only (no native detection or launch): `pnpm dev` (http://localhost:1420)
- Native app: `pnpm tauri dev` (requires Rust + WebView2 on Windows)
- Typecheck: `pnpm typecheck`
- Test: `pnpm test` (add `VITE_CHECK_COVERS=1` to also check cover URLs)
- Smoke: `pnpm smoke` (typecheck + test + `smoke:live` + `smoke:native`)
- Build: `pnpm build` (`tsc --noEmit && vite build`)
- README screenshots: `pnpm shots` (builds, serves `dist`, Playwright writes `docs/screenshots/`)

## Structure

- `src/domain/` — pure logic (search tokens, profile/XP, release helpers)
- `src/components/`, `src/views/`, `src/styles/` — UI (`theme.css` holds tokens)
- `src/state/` — app state
- `src/platform/` — native bridge; the browser shows a notice instead of simulating
- `src/smoke/` — smoke tests (`vitest.smoke.config.ts`)
- `src-tauri/` — Rust backend, capabilities, icons, `examples/detect`
- `scripts/release/` — release planning and stamping (`lib.mjs`, `lib.d.mts`)
- `docs/` — screenshots, ADRs, competitor notes

## Conventions

- Commits and PR titles: Conventional Commits (`feat(scope): ...`, `fix: ...`, `feat!: ...`).
- `auto-release` computes the version and publishes from those commits: `feat` → minor, `fix`/`perf`/`revert` → patch, breaking → major. `docs`, `chore`, `ci` do not publish.
- CI runs `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm typecheck`, `pnpm build`, and `cargo check --locked`.

## Gotchas

- Do not edit the version by hand in `package.json`, `tauri.conf.json` or `Cargo.toml` to release. The tag is the source.
- Changing `scripts/release/lib.mjs` also requires updating `lib.d.mts` and `src/domain/release.test.ts`.
- Browser-only runs cannot detect launchers, install emulators or launch games; that needs `pnpm tauri dev`.

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
