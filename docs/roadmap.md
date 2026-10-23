# Roadmap: funcionalidades e integrações

Pesquisa de 2026-10-22. Não repete o [README](../README.md) nem [competitors.md](competitors.md); aprofunda a Fase 2 e acrescenta metadados, preços, interop e produto.

Legenda: **não confirmado** = não apareceu em fonte primária lida nesta pesquisa. Nenhum endpoint ou campo foi inventado. Números entre colchetes referem-se à seção Fontes.

## Regras transversais

- **Chaves de terceiros não vão no bundle.** Variáveis `VITE_*` ficam públicas no build. IGDB e segredos Twitch ficam no backend Rust; chaves de usuário (SteamGridDB, Steam, ITAD) ficam em memória, como a RAWG hoje.
- **Só conteúdo que o usuário já possui.** O app não baixa, indica fonte de download, nem integra fontes de ROM/BIOS/jogo pirata (modelo Hydra fica fora; ver competitors.md, "Riscos").
- **Atribuição e ToS antes de cache persistente.** Cada fonte com cache exige checagem de termos; onde não foi lido, está marcado.
- **Toda PR que muda comportamento público** atualiza README (seção Fase 2) no mesmo commit.

## Tabela

Esforço: **P** = um PR pequeno, sem rede. **M** = um PR com cliente de rede (testado por fixture). **G** = várias PRs ou decisão de arquitetura.

| # | Item | Valor | Esforço | Dependências | Risco | Fonte |
|---|---|---|---|---|---|---|
| 1 | Backup/export/import JSON com `schemaVersion` | Alto: hoje tudo está em `localStorage` | P | nenhuma | Import de arquivo não confiável: validar tipos e tamanho | interno |
| 2 | Export de playlist RetroArch `.lpl` | Médio: leva a biblioteca para o RetroArch | P | caminho absoluto de ROM (já existe no Tauri) | `crc32` = `DETECT` limita Netplay; usar só campos documentados | [11] |
| 3 | Hash CRC32 de ROM e match contra DAT do usuário | Alto: resolve `.bin`/`.iso` ambíguos | M | leitura em streaming no Rust; DAT fornecido pelo usuário | Arquivo grande trava a UI: fazer no backend; licença dos DATs não confirmada | [12][13][11] |
| 4 | Import da biblioteca Steam (GetOwnedGames + playtime) | Alto: PC sem scan manual | M | chave Web API do usuário; perfil público | Perfil privado volta vazio; chave vai na query: redigir em logs | [14] |
| 5 | Tempo de jogo por sessão (início/fim do processo) | Alto: substitui o campo "horas" manual | M | launch real (Fase 2, item 2) | Launcher que delega e fecha mede errado: não confirmado | [competitors.md] (GOG Galaxy) |
| 6 | Capas SteamGridDB (chave gratuita) com cache local | Alto: capas melhores e offline | M | chave do usuário; diretório de cache | Termos de cache e de uso não lidos (página sem corpo) | [15][16] |
| 7 | Metadados IGDB (capas, plataformas, datas) | Alto: maior cobertura | M | credenciais Twitch no backend | Docs oficiais bloqueadas (403); limite 4 req/s vs concorrência: não confirmado | [17] |
| 8 | Calendário de lançamentos | Médio | M | item 7 ou fonte a confirmar | Campos de data no IGDB: não confirmado | não confirmado |
| 9 | Alertas de preço e wishlist (IsThereAnyDeal) | Alto para quem tem lista de desejos | M | app registrado no ITAD; chave | Não alterar preços/afiliados; atribuição recomendada; 1000 req/5 min por padrão | [18] |
| 10 | Ofertas sem chave (CheapShark) | Médio | P | nenhuma (se confirmado) | Fontes secundárias conflitam quanto a chave; docs oficiais não abertas | [19] não confirmado |
| 11 | Compatibilidade Linux/Proton (ProtonDB) | Baixo-médio (app é Windows-first) | P | appId Steam | API comunitária não oficial; auth e limites não confirmados; dados ODbL | [20][21] |
| 12 | Tempo para terminar (HowLongToBeat) | Alto | não integrar | — | Sem API oficial encontrada; ToS bloqueado para leitura. Usar campo manual | [22] |
| 13 | Interop Pegasus `metadata.pegasus.txt` e ES-DE `gamelist.xml` | Médio: reduz lock-in | M | modelo de dados estável (item 1) | Escapar XML; campos completos do USERGUIDE não lidos | competitors.md (d) |
| 14 | Atalhos Windows `.lnk` | Médio | M | launch argv-only | Argumentos são string única no `.lnk`: quoting precisa de teste; via COM | [23] |
| 15 | Auto-update Tauri (updater) | Alto em produção | M | par de chaves de assinatura; hospedagem do manifest | Assinatura obrigatória; chave perdida = sem updates | [24] |
| 16 | SQLite com `tauri-plugin-sql` | Médio: escala e sessões | M | ADR: `localStorage` x SQLite | Plugin Tauri (sqlx); migrations transacionais; exige Rust 1.90+ | [25] |
| 17 | Navegação por gamepad e modo TV | Médio | M | foco e teclado já acessíveis | Mapeamento padrão e suporte WebView2: não confirmado | [26] |
| 18 | Detecção de duplicatas (título normalizado + plataforma + hash) | Médio | P | item 3 para hash | Falso positivo em regiões e edições | interno |
| 19 | Estatísticas e "wrapped" anual | Médio | P | item 5 | Depende de dados de sessão | interno |
| 20 | Conquistas (Steam) | Baixo-médio | M | item 4 | Lojas sem API pública confirmada | [9] |

Itens de produto sem fonte nesta rodada: **i18n** e **temas** (não pesquisados); **coleções e filtros salvos** cobertos pelo LaunchBox Premium (competitors.md).

## Lojas e fontes sem API pública confirmada

- **GOG, Epic, Xbox, PSN:** nenhuma API oficial pública confirmada. Epic tem wrapper não oficial (`epicstore-api`, PyPI) [27]. Caminho seguro: importar de dados locais (GOG Galaxy DB, manifests Epic), como já previsto na Fase 2.
- **Steam store `appdetails`:** não pesquisado nesta rodada; só `appreviews` (já ativo) é usado.
- **OpenCritic:** API oficial não encontrada; o domínio de referência não resolveu.
- **TheGamesDB:** documentação sem corpo; endpoints e chave não confirmados.
- **ScreenScraper:** exige conta e credenciais de dev; cotas por nível de doação (50 mil / 100 mil requests por dia, por página pública). Termos de API não lidos.
- **PCGamingWiki:** página de API bloqueada (403); licença de conteúdo não confirmada.
- **itch.io:** documentação da API retornou 404; não confirmado.
- **No-Intro e Redump:** licença de uso dos DATs não confirmada. Dumps não são hospedados no redump.org. Relato antigo (2012) de DAT restrito a cadastro, não verificado.
- **Playnite e LaunchBox:** formato de banco de dados não confirmado.
- **Desktop Entry (`.desktop`):** a página lida foi só o índice da spec 1.5. Regras de escape de `Exec` não confirmadas.

## Fontes

1. https://api-docs.igdb.com/ (403, não lido)
2. https://www.steamgriddb.com/api/v2 (sem corpo)
3. https://howlongtobeat.com/ (bloqueado)
4. https://protondb.max-p.me/ (lido)
5. https://github.com/bdefore/protondb-data (lido, ODbL)
6. https://apidocs.cheapshark.com/ (só título)
7. https://docs.isthereanydeal.com/ (lido)
8. https://partner.steamgames.com/doc/webapi (lista de interfaces)
9. https://partner.steamgames.com/doc/webapi/iplayerservice (busca)
10. https://api.screenscraper.fr/ (lido)
11. https://docs.libretro.com/guides/roms-playlists-thumbnails/ (lido: campos `.lpl`, modos de scan, miniaturas)
12. https://datomatic.no-intro.org/ (interface de busca, sem detalhes de DAT)
13. http://redump.org/downloads/ (erro de conexão; busca secundária)
14. https://developer.valvesoftware.com/wiki/Steam_Web_API (busca: rota e parâmetros de GetOwnedGames, não lida na íntegra)
15. https://github.com/SteamGridDB/node-steamgriddb (README lido: `getGrids`, `getGridsBySteamAppId`, chave no construtor)
16. https://www.steamgriddb.com/profile/preferences/api (sem corpo)
17. https://discuss.dev.twitch.com/t/response-headers-oauth-access-tokens-getting-rate-limited/46963 (busca secundária)
18. https://docs.isthereanydeal.com/ (lido; endpoints e termos)
19. https://jentic.com/apis/cheapshark.com/cheapshark.md (busca secundária)
20. https://protondb.max-p.me/ (lido)
21. https://github.com/bdefore/protondb-data (lido)
22. https://community.muos.dev/t/howlongtobeat-com-integration-scraper/455 (busca secundária, opinião de usuário)
23. https://learn.microsoft.com/en-us/windows/win32/shell/links (lido: campos do `.lnk`, `IShellLink`)
24. https://v2.tauri.app/plugin/updater/ (lido: assinatura, `endpoints`, manifest)
25. https://v2.tauri.app/plugin/sql/ (lido: sqlx, migrations, Rust 1.90+)
26. https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API (lido parcialmente: Baseline desde 2017)
27. https://pypi.org/project/epicstore-api (busca)

## Ordem sugerida

Seis PRs pequenos e independentes. Testes unitários não usam rede: clientes recebem `fetch` injetado e fixtures sintéticas. Cada PR tem rollback por remoção da ação ou flag.

### PR 1: backup JSON (export e import)

- **Escopo:** exporta biblioteca, status, notas, horas e emulador por jogo com `schemaVersion: 1`. Import valida tudo antes de substituir o estado.
- **Aceite:**
  - round-trip preserva todos os campos (fixture);
  - `schemaVersion` desconhecido é rejeitado;
  - JSON malformado ou tipo errado não altera o estado atual;
  - arquivo acima de 5 MB é rejeitado.
- **Dependências:** nenhuma. **Rollback:** remover a ação de import; export é só leitura.

### PR 2: exporta playlist RetroArch `.lpl`

- **Escopo:** gera um `.lpl` por plataforma com as ROMs da biblioteca.
- **Aceite:**
  - golden test contra fixture com os campos documentados (`version`, `items`, `path`, `label`, `core_path`, `core_name`, `crc32`, `db_name`);
  - sem hash, `crc32` é `DETECT`;
  - jogo sem ROM não entra na playlist.
- **Dependências:** nenhuma. **Rollback:** remover o botão.

### PR 3: CRC32 e match contra DAT (núcleo, sem parser de DAT)

- **Escopo:** função CRC32 em streaming no backend Rust, exposta por comando Tauri. Parser de DAT fica para PR seguinte, porque o formato não foi confirmado.
- **Aceite:**
  - CRC32 de `"123456789"` = `CBF43926` (valor de verificação padrão do CRC-32, conhecido da especificação; não lido nesta pesquisa);
  - hash em blocos igual ao hash de buffer único;
  - arquivo vazio = `00000000`;
  - arquivo inexistente retorna erro, não zero.
- **Dependências:** nenhuma. **Rollback:** scan volta a pasta + extensão.

### PR 4: modelo de sessões de jogo (função pura)

- **Escopo:** `PlaySession { gameId, startedAt, endedAt? }`, reducer que soma minutos. O hook no processo lançado vem em PR separado.
- **Aceite:**
  - sessão sem `endedAt` (queda do app) não soma;
  - `endedAt < startedAt` (relógio voltou) é descartado;
  - fechar a mesma sessão duas vezes não duplica minutos;
  - relógio injetado; sem `Date.now()` direto no reducer.
- **Dependências:** nenhuma. **Rollback:** campo manual de horas continua.

### PR 5: import da biblioteca Steam (backend)

- **Escopo:** `IPlayerService/GetOwnedGames` com `include_appinfo`; rota e parâmetros vêm de busca secundária e precisam ser confirmados na página oficial antes do código. Adicionar `api.steampowered.com` ao escopo HTTP do Tauri. Hoje o escopo cobre só `store.steampowered.com` e `api.rawg.io`.
- **Aceite:**
  - parser puro de fixture retorna `{appid, name, playtimeMinutes}`;
  - lista vazia vira estado "perfil privado ou sem jogos", não erro;
  - resposta 403 mostra "chave inválida" sem ecoar a chave;
  - log e mensagem de erro não contêm `key=`;
  - sem rede nos testes (fetch injetado).
- **Dependências:** chave Web API do usuário. **Rollback:** remover o provedor.

### PR 6: cache local de capas com ordem de fallback

- **Escopo:** ordem: cache local, libretro sem chave, SteamGridDB se houver chave, capa gerada. Cache em disco com limite de tamanho (LRU simples). Antes, ADR curta sobre onde o cache vive.
- **Aceite:**
  - a ordem é respeitada com fontes simuladas;
  - falha de uma fonte cai para a próxima;
  - sem chave, SteamGridDB não é chamado;
  - tentativas no libretro seguem a ordem documentada: nome da ROM, label, label sem parênteses [11];
  - chave de cache é determinística e não contém caminho absoluto;
  - ao atingir o limite, remove o item menos usado.
- **Dependências:** diretório de dados do app; ADR. **Rollback:** flag de cache desligada.

## Checkpoint

- **Alterado:** `docs/roadmap.md` (novo).
- **Verificado:** o arquivo foi criado; ver linha de contagem no relato.
- **Não verificado:** nenhum endpoint foi testado ao vivo; a rota de GetOwnedGames e os termos de SteamGridDB, IGDB e HLTB dependem de confirmação na fonte oficial.
