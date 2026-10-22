# Concorrentes: catalogadores e launchers PC + emuladores

Pesquisa feita em 2026-10-22 com fontes primárias (site oficial, docs, GitHub/GitLab). Itens sem fonte primária lida nesta pesquisa estão marcados **não confirmado**. Sem versões, preços ou estrelas inventados: o que não apareceu na fonte ficou sem número.

## (a) Tabela comparativa

Legenda: ✅ confirmado na fonte · ❌ não existe · ❔ não confirmado

| App | Licença | Stack | Scan de pasta de ROM | Emulador por plataforma / por jogo | Scrapers / metadados | Preço | Diferenciais |
|---|---|---|---|---|---|---|---|
| **Playnite** | MIT ✅ | C# / .NET ❔ (plugins .NET, PowerShell, temas ✅) | ❔ não localizado nas docs lidas | Emuladores com **perfis** por plataforma; argumentos com `{ImagePath}` / `{ImageName}` / `{ImageNameNoExt}` ✅. Override por jogo: ❔ (issue #1934 pede variáveis por jogo) | IGDB embutido ✅; SteamGridDB exige chave ✅ (via plugin); ScreenScraper exige conta + credenciais de dev ✅ (via docs de extensão) | Grátis ✅ | Extensões, temas, lojas (Steam, Epic, GOG, EA, Battle.net) ✅ |
| **LaunchBox / Big Box** | Proprietário ❔ | ❔ | ❔ | "Countless emulators" ✅; detalhes ❔ | Base própria (LaunchBox DB) ✅; parceria EmuMovies (vídeo, manual) ✅; ScreenScraper/IGDB ❔ | Core grátis; **Premium US$ 30** (conforme site, 2026-10-22) ✅ | Big Box (modo arcade/TV) só no Premium ✅; campos customizados e filtros salvos no Premium ✅; auto-import Steam/GOG/Epic/EA/Xbox/Amazon ✅ |
| **Pegasus** | GPLv3 ✅ | C++ ❔ | Por **coleção** (diretórios ou regex/extensão) ✅ | Campo `launch` por coleção, com `{file.path}` ✅; uma regra por coleção, não há perfil global | Não faz scrape; lê gamelist do EmulationStation ✅; "Skraper" e outras fontes de mídia ✅ | Grátis ✅ | Temas com shaders ✅; roda em Android, Linux, Mac, Windows, Raspberry ✅ |
| **ES-DE** (EmulationStation-DE) | MIT ✅ | C++ ❔ | Uma pasta por sistema (`%ROMPATH%/snes`) ✅; extensões por sistema em `es_systems.xml` ✅ | Comando por sistema com `%ROM%` ✅; sem override por jogo ❔ | Scraper embutido ❔ (lista não lida); ScreenScraper e TheGamesDB citados ✅; chaves/contas ❔ | Grátis ✅ | `gamelist.xml` por sistema ✅; mídia em `downloaded_media/<sistema>/<tipo>` ✅; `noload.txt` para ocultar pasta ✅ |
| **Steam ROM Manager** | GPLv3 ✅ | ❔ | Parsers por glob/regex/manual ✅ | ❔ (wiki lida sem detalhe) | Artwork via SteamGridDB ✅; ScreenScraper ❌ na página lida | Grátis ❔ | Cria atalhos na Steam; artwork-only para Steam/Non-SRM ✅ |
| **GOG Galaxy 2.0** | Proprietário ✅ | ❔ | ❌ (jogo manual) | ❌ (sem emulador citado) | Integrações Steam/Epic/Xbox via plugins oficiais/comunitários ✅ | Grátis ✅ | Cloud saves ✅; tempo de jogo ✅; amigos/chat ✅; Win/Mac ✅ (Linux ❔) |
| **Heroic** | GPLv3 ✅ | ❔ (Electron/React ❔) | ❌ | ❌ (sem ROM/emulador citado) | ❔ não especificado | Grátis ✅ | Epic (Legendary), GOG (gogdl), Amazon (Nile) ✅; sideload ✅; Wine/Proton/umu ✅; cloud saves ✅; ProtonDB ✅ |
| **Lutris** | GPLv3 ✅ | ❔ | ❔ | Config em 3 níveis (jogo > runner > sistema, YAML) ✅; runners incluem emuladores ✅ | Banners/ícones locais ✅; fontes IGDB/SGDB ❔ | Grátis ✅ | Installers em JSON/YAML ✅; lutris.net sincroniza biblioteca ✅; import Steam ✅ |
| **Hydra Launcher** | MIT ✅ | Electron, React, TS, Rust ✅ | ❔ não informado | ❔ | ❔ | Grátis ❔ | Descreve biblioteca, achievements, cloud save ✅; **fontes de download de terceiros ✅ (libtorrent)**: ver Riscos |
| **RetroArch** | ❔ (não verificado) | C ❔ | Scan "estrito" por **CRC32 / serial** contra libretro-database ✅; scan solto disponível ✅ | Core por playlist (`core_path`), `DETECT`, `default_core_path` ✅; core por pasta ❔ | Thumbnails de `thumbnails.libretro.com` (boxart, snaps, titles), sem chave ✅ | Grátis ❔ | Playlists `.lpl` em JSON ✅; "Portable Playlists" com caminho relativo ✅ |
| Daijishō / RetroBat / Batocera | — | — | — | — | — | — | **Não pesquisado** (fora do tempo disponível) |

Leitura rápida: só RetroArch e ES-DE tratam **nome de ROM + extensão** como contrato; RetroArch é o único com **hash/CRC** de verdade. Playnite e LaunchBox são os que têm perfil de emulador mais maduro, mas o override por jogo não ficou confirmado.

## (b) Convenções de scan

Pasta-padrão e extensões: **ES-DE** (`resources/systems/linux/es_systems.xml`, lido em 2026-10-22). Extensões em minúsculas; a fonte também lista variantes em maiúsculas. Nome da pasta = atributo `name` do sistema (ex.: `snes`, `psx`); o guia confirma `snes`, `nes`, `psx`, `dos`, `c64`, `atari2600`, `ports`.

| Plataforma (pasta ES-DE) | Extensões de ROM (ES-DE) | Observação |
|---|---|---|
| nes | `.nes .unf .unif .fds .3dsen .zip .7z` | |
| snes | `.sfc .smc .swc .fig .bs .st .mgd .bin .zip .7z` | |
| gb | `.gb .gbc .sgb .cgb .dmg .bs .gbx .zip .7z` | `.gbc` também aparece em `gbc` |
| gbc | `.gbc .gb .cgb .sgb .gbx .zip .7z` | |
| gba | `.gba .agb .gbc .gb .bin .zip .7z` | |
| n64 | `.bin .d64 .appimage .desktop` (parcial) | Fonte truncada na leitura; lista completa não confirmada |
| nds | `.nds .dsi .app .ids .bin .zip .7z` | |
| gc | `.iso .gcz .rvz .wbfs .ciso .gcm .wia .tgc .dol .elf .json .zip .7z` | |
| wii | `.iso .wbfs .rvz .wia .gcz .ciso .gcm .wad .tgc .dol .elf .json .zip .7z` | Mesmas extensões de GC |
| psx | `.cue .bin .chd .img .iso .mdf .pbp .ccd .toc .m3u .z .znx .exe .psexe .psf .minipsf .zip .7z` | `.bin`/`.iso`/`.chd` colidem com outros sistemas |
| ps2 | `.iso .chd .cso .ciso .isz .zso .gz .img .mdf .nrg .bin .elf .dump .desktop .m3u` | |
| psp | `.iso .cso .chd .pbp .elf .prx .zip .7z` | |
| megadrive | `.md .gen .bin .smd .32x .sms .gg .iso .chd .cue .zip .7z` ❔ | Fonte truncada parcialmente; tabela usa só o confirmado |
| mastersystem / gamegear | `.sms .gg .sg .bin .md .gen .smd .zip .7z` ❔ | |
| segacd | `.bin .iso .cue .chd .md .gen .smd .zip .7z` | |
| saturn | `.cue .chd .iso .bin .ccd .mds .toc .m3u .zip .7z` | |
| dreamcast | `.gdi .cdi .chd .cue .iso .lst .dat .elf .m3u .zip .7z` ❔ | Fonte truncada |
| pcengine | `.pce .sgx .cue .chd .iso .ccd .img .toc .m3u .zip .7z` | |
| neogeo | `.neo .zip .7z` | |
| atari2600 | `.a26 .bin .zip .7z` | |
| amiga | `.adf .adz .dms .fdi .ipf .hdf .lha .uae .iso .cue .chd .zip .7z` ❔ | Fonte truncada |
| dos / pc | `.exe .com .bat .conf .cue .img .iso .dosz .zip .7z` | `pc` usa o mesmo conjunto de dos |
| wiiu | `.wua .wux .wud .wuhb .rpx .tmd .elf` | |
| switch | `.nsp .xci .nca .nro .nso` | |
| arcade / mame | `.zip .7z` + `.lindbergh .gam .acgame .sh .cmd .desktop` ✅ | ZIP do MAME é o contrato real |

Referência de cruzamento: **Pegasus** não tem tabela de extensão padrão: o usuário declara `extension` por coleção (`metadata.pegasus.txt`). **RetroArch** usa a lista `supported_extensions` do arquivo `.info` do core ❔ (não lido nesta pesquisa).

**Problema que isso expõe:** `.bin`, `.iso`, `.chd`, `.cue` aparecem em 10+ sistemas. Nenhum app lido resolve só por extensão: RetroArch usa CRC/serial contra DAT; ES-DE e Pegasus confiam na pasta. Para o Games Gallery, pasta-por-plataforma + extensão é o mínimo; hash é o desempate.

## (c) Lacunas do Games Gallery (prioridade)

Base: o README já lista scan por hash como fase 2 (item 4), e emulador, import e capas com chave como pendentes. As lacunas abaixo são o que os concorrentes entregam e o app ainda não tem.

1. **Scan de pasta por plataforma** (ES-DE/Pegasus): uma pasta-raiz configurável, subpasta por plataforma, filtro de extensão vindo do catálogo, e desempate por CRC32/serial (modelo RetroArch). Sem isso, `.bin`/`.iso` ficam ambíguos.
2. **Perfil de emulador por plataforma + override por jogo**, com placeholders `{ImagePath}`, `{ImageName}`, `{ImageNameNoExt}` (Playnite) ou `{file.path}`, `{file.basename}`, `{file.dir}` (Pegasus). Hoje o drawer escolhe emulador e mostra o comando; falta o perfil de argumentos por plataforma. Mantém o contrato argv-only já adotado.
3. **Fallback de capas e metadados com chave opcional**: IGDB (Playnite embute), SteamGridDB (chave gratuita), libretro-thumbnails (sem chave, nomes No-Intro). Já há hotlink de libretro; falta cache local e a ordem de fallback.
4. **Tempo de jogo por sessão** (GOG Galaxy confirma): registrar início/fim do processo lançado. Hoje o campo "horas" é manual.
5. **Interop de metadados**: importar/exportar `metadata.pegasus.txt` e `gamelist.xml` (ES-DE). Dá entrada para quem já tem coleção e reduz lock-in. Coleções/filtros salvos (LaunchBox Premium) entram aqui como extensão natural da biblioteca.

## (d) Fontes

Playnite
- https://github.com/JosefNemec/Playnite (MIT, lido)
- https://api.playnite.link/docs/manual/features/emulationSupport/addingNewEmulators.html (perfis, Arguments)
- https://api.playnite.link/docs/manual/features/emulationSupport/troubleshooting.html
- https://api.playnite.link/docs/manual/advanced/gameVariables.html (`{ImagePath}`)
- https://github.com/JosefNemec/Playnite/issues/1934 (variáveis por jogo: pedido)
- https://github.com/cooperate/SteamGridDBMetadata (chave SGDB, extensão comunitária)

LaunchBox / Big Box
- https://www.launchbox-app.com/ (preço Premium US$ 30 conforme página, 2026-10-22)

Pegasus
- https://github.com/mmatyas/pegasus-frontend (GPLv3, lido)
- https://pegasus-frontend.org/docs/user-guide/meta-files/ (`metadata.pegasus.txt`, chaves, placeholders)
- https://pegasus-frontend.org/docs/user-guide/meta-assets/ (nomes de mídia)

ES-DE
- https://gitlab.com/es-de/emulationstation-de (MIT, lido)
- https://gitlab.com/es-de/emulationstation-de/-/raw/master/USERGUIDE.md (pastas, `%ROM%`, `gamelist.xml`, mídia)
- https://gitlab.com/es-de/emulationstation-de/-/raw/master/resources/systems/linux/es_systems.xml (extensões)

Steam ROM Manager
- https://github.com/SteamGridDB/steam-rom-manager (GPLv3, parsers)
- https://github.com/SteamGridDB/steam-rom-manager/wiki (sem detalhe de emulador: não confirmado)

GOG Galaxy
- https://www.gog.com/galaxy (grátis, cloud saves, tempo de jogo, amigos)

Heroic
- https://github.com/Heroic-Games-Launcher/HeroicGamesLauncher (GPLv3, lojas, sideload)

Lutris
- https://github.com/Lutris/lutris (GPLv3, hierarquia de config)

Hydra Launcher
- https://github.com/hydralauncher/hydra (MIT, README lido)

RetroArch
- https://docs.libretro.com/guides/roms-playlists-thumbnails/ (playlists, scan, thumbnails, CRC)

## Riscos e não confirmado

- **Hydra:** baixa de fontes de terceiros com torrent. Não serve de referência para scan local. Qualquer integração exige análise de risco legal e de segurança antes.
- **Playnite per-game override** e **metadados de RetroArch por core**: não confirmados nas docs lidas.
- **ES-DE** scraper embutido e chaves: lista não lida (guia truncado).
- **Stacks** de Steam ROM Manager, LaunchBox, Pegasus, ES-DE, Lutris, Heroic, RetroArch: não confirmados em fonte primária.
- **Daijishō, RetroBat, Batocera**: não pesquisados.
- Preço do LaunchBox Premium vem da página do site na data da consulta; pode ter mudado.
