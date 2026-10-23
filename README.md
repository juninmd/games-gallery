# Games Gallery

Protótipo navegável (Tauri 2 + React 19 + TypeScript + Vite) para catalogar jogos de **PC** (Steam, GOG, Epic, Ubisoft, EA, Battle.net, Game Pass, Amazon, itch.io, Humble, Rockstar, Playnite/Heroic) e de **consoles** (PS1–PS5, PSP, Vita, Xbox → Series, NES → Switch, Sega, retrô), com capas, status (jogando / quero jogar / zerado / abandonado / wishlist) e gerenciamento de **emuladores**.

![Biblioteca](docs/library.png)

## Rodar

```bash
pnpm install
pnpm dev            # só a UI, em http://localhost:1420
pnpm tauri dev      # janela nativa (requer Rust + WebView2)
pnpm test           # lógica de domínio
VITE_CHECK_COVERS=1 pnpm test   # também confere que todas as URLs de capa respondem
```

## Telas

| Tela | O que mostra |
|---|---|
| Biblioteca / Instalados | grid de capas, busca (sem acento), filtros por provedor, plataforma, status; ordenação |
| Quero jogar | kanban com drag & drop entre os status |
| Pastas | escolher pasta de ROMs ou biblioteca Steam, revisar o que foi reconhecido (novo / vincular / já importado), ver o emulador de cada jogo e importar |
| Plataformas | 34 plataformas e se há emulador pronto, a instalar, ou nenhum viável (PS5, Xbox One, Series) |
| Provedores | 18 lojas/serviços: método de importação, conectar, sincronizar |
| Emuladores | 20 emuladores, plataformas, BIOS exigida, comando de launch, instalar/remover, e os jogos da biblioteca que usam cada um (quantos estão prontos para jogar) |
| Drawer do jogo | status, nota, horas, emulador escolhido, caminho da ROM e o comando exato que seria executado |

![Emuladores](docs/emulators.png)

## Pastas e varredura

![Pastas](docs/folders.png)

- **ROMs:** uma subpasta por plataforma, com os mesmos nomes do ES-DE/RetroArch (`ps2`, `psx`, `snes`, `gc`, “Sony - PlayStation 2”…). Extensões que identificam uma plataforma sozinhas (`.gba`, `.sfc`, `.nsp`…) dispensam a pasta; `.iso/.bin/.chd/.zip/.cso/.gcz/.md…` são compartilhadas entre sistemas e só entram com a pasta. Discos múltiplos e `.cue`+`.bin` viram um jogo só.
- **Jogos de PC:** lê `appmanifest_*.acf` de uma biblioteca Steam (appid, nome, tamanho em disco). GOG e Epic: fase 2.
- Cada ROM é ligada a um jogo que você já tem (mesmo título, sem acento/caixa) ou vira um jogo novo; o emulador padrão da plataforma aparece em cada linha, com botão para instalar o que falta.
- No Tauri o seletor é nativo e o caminho salvo é absoluto; o escopo de leitura vale só para a pasta escolhida e some ao fechar o app (reescanear = escolher de novo). No browser (`pnpm dev`) o caminho salvo é relativo à pasta escolhida.
- **RetroArch:** na tela Emuladores, “Exportar playlists (.lpl)” gera uma playlist por plataforma (formato JSON documentado no libretro; core e CRC ficam `DETECT`, o RetroArch pergunta o core na primeira vez).
- Pesquisa de concorrentes (Playnite, LaunchBox, Pegasus, ES-DE, RetroArch…): [docs/competitors.md](docs/competitors.md).

## Notas (sua nota + notas públicas)

Suas estrelas (1–5) viram 0–100 e são comparadas com a média pública no drawer do jogo.

| Fonte | Acesso | Estado |
|---|---|---|
| Steam Reviews (`appreviews`) | pública, sem chave | ativo (testado ao vivo) |
| RAWG (traz a nota do Metacritic + comunidade) | chave gratuita, em Ajustes | implementado; **não testado com chave real** (só o caminho de erro 401) |
| IGDB, OpenCritic | segredo Twitch / RapidAPI | fase 2: o token só pode viver no backend Rust |
| Metacritic direto | não há API pública | só via campo do RAWG |

Nenhuma dessas APIs envia CORS: em `pnpm dev` as chamadas passam por proxy do Vite (`/proxy/*`); no Tauri usam o plugin HTTP com escopo restrito a `store.steampowered.com` e `api.rawg.io`. O cache é de 24h e a chave RAWG fica só em memória.

![Notas](docs/ratings.png)

## O que é real e o que é simulado

**Real:** navegação, filtros, kanban, persistência (`localStorage`), notas públicas da Steam, catálogos de plataformas/provedores/emuladores, capas (Steam CDN e [libretro-thumbnails](https://thumbnails.libretro.com), com capa gerada quando não existe), montagem do comando de launch, abertura de URIs de loja no Tauri (`steam://rungameid/…`, allow-list em `src-tauri/capabilities/default.json`).

**Simulado:** conectar/sincronizar lojas, instalar jogos e emuladores (barra de progresso), execução de emulador (o app mostra `exe + argv`, não executa).

## Estrutura

```
src/domain/     tipos, catálogos (platforms, providers, emulators), launch.ts, filter.ts, seed/
src/state/      zustand: library (persistido), ui (navegação/filtros), tasks (jobs simulados)
src/components/ Cover, GameCard, GameDrawer, LaunchPanel, FilterBar, ...
src/views/      uma view por tela
src/platform/   runtime.ts, folders.ts, http.ts: ponte browser ↔ Tauri
src-tauri/      shell Tauri 2 (plugins opener, http, dialog, fs)
```

## Decisões de segurança

- O launch de emulador é um **array de argumentos** (`args: ["-batch", "--", "{rom}"]`), nunca uma string de shell: um caminho como `a & calc.exe` vira um único argv (teste em `launch.test.ts`).
- `storeId` é validado (`/^[\w.-]+$/`) antes de entrar em URI de loja; o Tauri só abre os esquemas da allow-list.
- CSP restringe imagens a `self`, Steam CDN e libretro.
- O app **não baixa nem distribui BIOS, firmware, chaves ou ROMs**; o usuário fornece os dele.

## Fase 2 (não feito)

1. Importação real: Steam Web API + `appmanifest_*.acf`, GOG Galaxy DB, manifests da Epic, registro do Windows.
2. Comando Rust com escopo para executar emuladores (exe resolvido pelo catálogo, argv-only, sem shell) e baixar emuladores de releases oficiais com verificação de hash.
3. Persistência em SQLite; cache local de capas; fonte de capas com chave própria (IGDB, SteamGridDB ou ScreenScraper) — o hotlink atual é só para o protótipo.
4. Identificação das ROMs por hash (CRC32/serial contra No-Intro/Redump, como o RetroArch); hoje o scan usa pasta + extensão.
5. `exe`/`args` de cada emulador são heurísticos: validar contra a build instalada antes de habilitar execução real.
6. Status dos forks (Ryubing, Eden, Azahar) muda rápido: revisar o catálogo periodicamente.
