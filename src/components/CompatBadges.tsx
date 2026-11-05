import { ExternalLink } from "lucide-react";
import { useEffect, useMemo } from "react";
import { DECK_LABEL, PROTON_LABEL, inGamePass, gamePassIndex } from "../domain/compat";
import { steamAppIdOf } from "../domain/ratings";
import type { Game } from "../domain/types";
import { openExternal } from "../platform/runtime";
import { useCompat } from "../state/compat";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";

const TONE: Record<string, string> = {
  platinum: "ok", gold: "ok", verified: "ok", silver: "", playable: "", bronze: "warn", unsupported: "bad", borked: "bad",
};

function Chip({ label, value, tone, hint }: { label: string; value: string; tone?: string; hint?: string }) {
  return <span className={`tag ${tone ?? ""}`} title={hint}><span className="muted">{label}</span> {value}</span>;
}

/** Where the game stands on Linux/Deck and in Game Pass: free, community-made hints that load only when the drawer opens. */
export function CompatBadges({ game }: { game: Game }) {
  const toast = useUi((s) => s.toast);
  const games = useLibrary((s) => s.games);
  const appId = useMemo(() => steamAppIdOf(game) ?? games.filter((g) => g.title === game.title).map(steamAppIdOf).find(Boolean), [game, games]);
  const entry = useCompat((s) => (appId ? s.entries[String(appId)] : undefined));
  const pass = useCompat((s) => s.gamePass);
  const index = useMemo(() => (pass ? new Set(pass.keys) : undefined), [pass]);
  const load = useCompat((s) => s.load);
  const loadGamePass = useCompat((s) => s.loadGamePass);

  useEffect(() => { if (appId) void load(appId); }, [appId, load]);
  useEffect(() => { if (game.platformId === "pc") void loadGamePass(); }, [game.platformId, loadGamePass]);

  const open = async (url: string) => {
    try {
      if (!(await openExternal(url))) toast("Link bloqueado: endereço fora da lista permitida");
    } catch (e) {
      toast(`Não foi possível abrir: ${String(e)}`);
    }
  };

  const onPass = Boolean(index) && game.platformId === "pc" && inGamePass(index ?? gamePassIndex([]), game.title);
  if (game.platformId !== "pc") return null;
  if (!appId && !onPass) return null;

  return (
    <section className="glass grid gap-2.5 rounded-2xl p-4" aria-label="Compatibilidade e assinaturas">
      <h3>Compatibilidade</h3>
      <div className="flex flex-wrap items-center gap-2">
        {entry?.proton && <Chip label="ProtonDB" value={`${PROTON_LABEL[entry.proton.tier]} · ${entry.proton.total.toLocaleString("pt-BR")} relatos`} tone={TONE[entry.proton.tier]} hint="Avaliação da comunidade para rodar no Linux via Proton" />}
        {entry?.deck && entry.deck !== "unknown" && <Chip label="Steam Deck" value={DECK_LABEL[entry.deck]} tone={TONE[entry.deck]} hint="Classificação oficial da Valve" />}
        {onPass && <Chip label="Game Pass" value="No catálogo do PC" tone="ok" hint="Consta no catálogo público do PC Game Pass (confira a região na loja)" />}
        {appId && entry && !entry.proton && (!entry.deck || entry.deck === "unknown") && <span className="muted small">Sem dados de compatibilidade para este jogo.</span>}
        {appId && !entry && <span className="muted small" role="status">Consultando…</span>}
      </div>
      {appId && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn ghost" onClick={() => void open(`https://www.protondb.com/app/${appId}`)}><ExternalLink size={13} aria-hidden /> ProtonDB</button>
          <button type="button" className="btn ghost" onClick={() => void open(`https://www.pcgamingwiki.com/api/appid.php?appid=${appId}`)}><ExternalLink size={13} aria-hidden /> PCGamingWiki</button>
        </div>
      )}
      <p className="muted small">Dados de terceiros (ProtonDB, Steam, catálogo público do Game Pass), sem chave e em cache local; servem de dica, não de garantia.</p>
    </section>
  );
}
