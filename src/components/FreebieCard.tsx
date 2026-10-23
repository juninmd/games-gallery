import { ExternalLink, Gift } from "lucide-react";
import { useState } from "react";
import { type Freebie, freebieToGame } from "../domain/freebies";
import { openExternal } from "../platform/runtime";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";

const day = (iso?: string) => (iso && !Number.isNaN(Date.parse(iso)) ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "");

function when(f: Freebie): string {
  if (f.status === "now") return f.endsAt ? `Grátis até ${day(f.endsAt)}` : "Grátis agora";
  if (f.status === "upcoming") return f.startsAt ? `Grátis a partir de ${day(f.startsAt)}` : "Em breve";
  return f.startsAt ? `Anunciado em ${day(f.startsAt)}` : "Jogo do mês";
}

/** Store entry with open/add actions. Claiming stays on the store: it needs the user's own login. */
export function FreebieCard({ freebie: f, platformId }: { freebie: Freebie; platformId?: string }) {
  const games = useLibrary((s) => s.games);
  const addGame = useLibrary((s) => s.addGame);
  const toast = useUi((s) => s.toast);
  const [broken, setBroken] = useState(false);
  const inLibrary = freebieToGame(f, "wishlist", games, platformId) === null;

  const add = (mode: "wishlist" | "owned") => {
    const g = freebieToGame(f, mode, games, platformId);
    if (!g) return toast("Já está na biblioteca");
    addGame(g);
    toast(mode === "owned" ? `${f.title} adicionado como resgatado` : `${f.title} adicionado à wishlist`);
  };

  const open = async () => {
    try {
      if (!(await openExternal(f.url))) toast("Link bloqueado: endereço fora da lista permitida");
    } catch (e) {
      toast(`Não foi possível abrir: ${String(e)}`);
    }
  };

  return (
    <article className="freebie">
      <div className="freebie-art">
        {f.imageUrl && !broken ? (
          <img src={f.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        ) : (
          <span className="freebie-fallback"><Gift size={28} aria-hidden /></span>
        )}
      </div>
      <div className="freebie-body">
        <strong title={f.title}>{f.title}</strong>
        <span className="muted small">{when(f)}{f.originalPrice ? ` · de ${f.originalPrice}` : ""}</span>
        <div className="freebie-actions">
          <button className="btn" onClick={open}><ExternalLink size={13} aria-hidden /> {f.store === "epic" ? "Abrir na loja" : "Ver anúncio"}</button>
          {inLibrary ? (
            <span className="tag ok">Na biblioteca</span>
          ) : (
            <>
              <button className="btn ghost" onClick={() => add("wishlist")}>Wishlist</button>
              <button className="btn ghost" onClick={() => add("owned")}>Já resgatei</button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
