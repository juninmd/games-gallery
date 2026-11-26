import { CommandPalette as SonidoPalette, defaultCommandFilter, type Command } from "@juninmd/sonido";
import { Copy, Gamepad2, Keyboard, Plus, RefreshCw, HandCoins } from "lucide-react";
import { useCallback } from "react";
import { groupGames } from "../domain/duplicates";
import { createGameQueryMatcher } from "../domain/filter";
import { PLATFORM_BY_ID } from "../domain/platforms";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";
import { NAV_GROUPS } from "./nav";
import { storeSummary } from "./StoreChips";

const MAX_GAMES = 8;

/** Ctrl/⌘+K: jump to any screen, add a game or open a title without leaving the keyboard. */
export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen);
  const setOpen = useUi((s) => s.setPaletteOpen);
  const go = useUi((s) => s.go);
  const select = useUi((s) => s.select);
  const setAddOpen = useUi((s) => s.setAddOpen);
  const games = useLibrary((s) => s.games);

  const commands = useCallback((query: string): Command[] => {
    const base: Command[] = [
      { id: "add", group: "Ações", label: "Adicionar jogo", hint: "novo", icon: <Plus size={17} />, run: () => setAddOpen(true) },
      { id: "detect", group: "Ações", label: "Detectar bibliotecas agora", hint: "launchers", icon: <RefreshCw size={17} />, keywords: "ler varrer atualizar steam epic gog ubisoft ea battle.net", run: () => { go("library"); void useLibrary.getState().detect(); } },
      { id: "keys", group: "Ações", label: "Atalhos do teclado", hint: "?", icon: <Keyboard size={17} />, keywords: "ajuda teclas atalhos help", run: () => useUi.getState().setShortcutsOpen(true) },
      { id: "dupes", group: "Ações", label: "Mostrar jogos em mais de uma loja", hint: "repetidos", icon: <Copy size={17} />, keywords: "duplicados unificados lojas repetido", run: () => go("library", { multiStoreOnly: true }) },
      { id: "loans", group: "Ações", label: "Mostrar jogos emprestados", hint: "empréstimos", icon: <HandCoins size={17} />, keywords: "emprestado emprestimo fisico midia amigo", run: () => go("library", { loanedOnly: true }) },
      ...([["rails", "Trilhos"], ["comfortable", "Grade"], ["compact", "Grade compacta"], ["list", "Lista"], ["boxes", "Caixas 3D"]] as const).map(([d, label]) => ({
        id: `mode:${d}`, group: "Exibição", label: `Mostrar como ${label}`, hint: "biblioteca", icon: <Gamepad2 size={17} />,
        keywords: "modo densidade grade lista caixas trilhos capas exibir",
        run: () => { useUi.getState().setDensity(d); if (useUi.getState().view !== "installed") go("library"); },
      })),
      ...NAV_GROUPS.flatMap((g) => g.items.map((n) => ({
        id: `go:${n.view}`, group: "Ir para", label: n.label, hint: g.title, icon: n.icon, run: () => go(n.view),
        keywords: n.keywords ?? "",
      }))),
    ].filter((c) => defaultCommandFilter(c, query));
    if (!query.trim()) return base;
    const match = createGameQueryMatcher(query);
    // One result per game: a title owned in three stores is listed once, with its stores as the hint.
    const found = groupGames(games.filter(match)).slice(0, MAX_GAMES).map<Command>(({ primary: g, members }) => ({
      id: `game:${g.id}`, group: "Jogos", label: g.title,
      hint: members.length > 1 ? storeSummary(members).names.join(" · ") : PLATFORM_BY_ID[g.platformId]?.short,
      icon: <Gamepad2 size={17} />, run: () => select(g.id),
    }));
    return [...base, ...found];
  }, [games, go, select, setAddOpen]);


  return (
    <SonidoPalette
      open={open}
      onClose={() => setOpen(false)}
      onOpen={() => setOpen(!useUi.getState().paletteOpen)}
      commands={commands}
      label="Paleta de comandos"
      placeholder="Buscar telas, ações e jogos…"
      emptyText={(q) => `Nada encontrado para “${q}”.`}
    />
  );
}
