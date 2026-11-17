# ADR 0001: estado do app em arquivo, não em localStorage (SQLite adiado)

- Status: aceito
- Data: 2026-11-17

## Contexto
A biblioteca (`games-gallery:v1`) e o histórico de sessões (`games-gallery:sessions:v1`) eram salvos no
`localStorage` do WebView. Isso tem três problemas: limite de poucos MB por origem (bibliotecas grandes
com capas e notas chegam perto), dados apagados junto com o perfil do WebView, e nenhum arquivo que o
usuário possa copiar.

## Opções
| Opção | Prós | Contras |
|---|---|---|
| **SQLite** (`tauri-plugin-sql` ou `rusqlite`) | consultas, escrita parcial, escala | nova dependência, esquema e migrações para cada campo do `Game`, reescreve todos os stores zustand; o app hoje carrega tudo em memória e não consulta nada no disco |
| **Um arquivo JSON por store** (comando Rust próprio) | zero dependência nova, mesmo formato e mesmas migrações do `persist`, troca isolada no `storage` do zustand | regrava o JSON inteiro a cada mudança (igual ao localStorage hoje) |
| Manter localStorage | nada a fazer | limite e fragilidade continuam |

## Decisão
Arquivo JSON por store em `$APPDATA/state/<nome>.json`, via `state_read` / `state_write` / `state_remove`
(`src-tauri/src/state_store.rs`). Só chaves `games-gallery:<a-z0-9:->` viram arquivo; o nome é derivado,
nunca usado como caminho. Escrita atômica (arquivo `.part` + rename), limite de 64 MB. Um arquivo que não é JSON
válido é renomeado para `.corrupt.json` (nunca sobrescrito); se a leitura falhar por erro de disco, o app usa a
cópia do localStorage e não grava naquela sessão.

No front, `src/platform/stateStorage.ts` serializa e agrupa as escritas por chave e descarta qualquer
escrita feita antes da primeira leitura (o zustand salva em todo `set`, inclusive antes de uma hidratação
assíncrona; sem isso o estado vazio inicial sobrescreveria a biblioteca). O boot só roda a detecção
automática depois que a biblioteca carregou (`whenHydrated`).

Aplicado à biblioteca e às sessões, os dois stores que crescem. Os demais continuam no localStorage.
No navegador (`pnpm dev`) e nos testes, tudo segue no localStorage, síncrono.

SQLite fica para quando houver consulta real no disco (ex.: histórico de preços ou sessões sem limite).

## Migração e rollback
- Primeira leitura sem arquivo cai no localStorage e a próxima escrita cria o arquivo: migração automática.
- O localStorage não é apagado. Voltar para a versão anterior volta a ler de lá (com os dados de antes
  da atualização).
