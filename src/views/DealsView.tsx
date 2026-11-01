import { RefreshCw } from "lucide-react";
import { useEffect, useMemo } from "react";
import { DealCard } from "../components/DealCard";
import { dealInsights, opportunities, type DealInsight } from "../domain/dealInsights";
import { formatMoney } from "../domain/deals";
import { type Deal, type DealStore, liveDeals, sortDeals } from "../domain/deals";
import { fold } from "../domain/scan/fold";
import { isValidSteamId } from "../platform/steamApi";
import { recomputeHits } from "../state/alertWatcher";
import { useDeals } from "../state/deals";
import { usePriceAlerts } from "../state/priceAlerts";
import { useLibrary } from "../state/library";
import { useSecrets } from "../state/secrets";
import { useUi } from "../state/ui";

const STORES: { id: DealStore; name: string; source: string }[] = [
  { id: "steam", name: "Steam", source: "Prateleira de ofertas da própria loja (store.steampowered.com)." },
  { id: "gog", name: "GOG", source: "Catálogo público filtrado por desconto (catalog.gog.com)." },
  { id: "epic", name: "Epic Games Store", source: "Mesmo endpoint dos jogos grátis, só com descontos parciais." },
];

const stamp = (t?: number) => (t ? new Date(t).toLocaleString("pt-BR") : "nunca");
const until = (iso?: string) => (iso ? `Até ${new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}` : undefined);

function WishlistSection() {
  const { wishlist, loading, errors, refreshWishlist } = useDeals();
  const steamId = useSecrets((s) => s.steamId);
  const go = useUi((s) => s.go);
  const owned = useLibrary((s) => s.games);
  const ownedIds = useMemo(() => new Set(owned.filter((g) => g.providerId === "steam").map((g) => g.storeId)), [owned]);
  const ready = isValidSteamId(steamId);
  useEffect(() => { if (ready) void refreshWishlist(); }, [ready, steamId, refreshWishlist]);
  const onSale = wishlist?.items.filter((w) => (w.price?.discountPercent ?? 0) > 0).length ?? 0;

  return (
    <section className="section-group">
      <div className="section-head">
        <h2>Wishlist da Steam{wishlist ? ` (${wishlist.items.length}, ${onSale} em promoção)` : ""}</h2>
        <button className="btn ghost" disabled={!ready || loading.wishlist} onClick={() => void refreshWishlist(true)}>
          <RefreshCw size={13} aria-hidden /> {loading.wishlist ? "Atualizando…" : "Atualizar"}
        </button>
      </div>
      {!ready && (
        <p className="empty">Informe o SteamID64 em <button className="link" onClick={() => go("connections")}>Conexões</button> para ver a wishlist.</p>
      )}
      {ready && <p className="muted small">Atualizado em {stamp(wishlist?.fetchedAt)}. Os detalhes de jogos do perfil precisam estar públicos.</p>}
      {errors.wishlist && <p className="note warn" role="alert">Não foi possível ler a wishlist: {errors.wishlist}</p>}
      {ready && wishlist && !wishlist.items.length && !errors.wishlist && (
        <p className="empty">Wishlist vazia ou perfil privado. Em Steam → Perfil → Privacidade, deixe “Detalhes do jogo” público.</p>
      )}
      <div className="freebie-grid">
        {wishlist?.items.map((w) => (
          <DealCard
            key={w.appId}
            title={w.title}
            url={w.url}
            imageUrl={w.imageUrl}
            currency={w.price?.currency ?? "BRL"}
            originalCents={w.price?.originalCents ?? 0}
            finalCents={w.price?.finalCents}
            discountPercent={w.price?.discountPercent ?? 0}
            note={w.price ? undefined : "Sem preço (não lançado ou indisponível na região)"}
            owned={ownedIds.has(String(w.appId))}
          />
        ))}
      </div>
    </section>
  );
}

function StoreSection({ store, insights }: { store: (typeof STORES)[number]; insights: Map<string, DealInsight> }) {
  const { deals, loading, errors, refreshDeals } = useDeals();
  const slot = deals[store.id];
  useEffect(() => void refreshDeals(store.id), [store.id, refreshDeals]);
  const items = useMemo(() => sortDeals(liveDeals(slot?.items ?? [])), [slot]);
  const games = useLibrary((s) => s.games);
  const owned = useMemo(() => {
    const own = games.filter((g) => g.providerId === store.id);
    return { ids: new Set(own.map((g) => g.storeId)), titles: new Set(own.map((g) => fold(g.title))) };
  }, [games, store.id]);
  // Epic deals carry offer ids (library ids are app names), so titles are the only common key there.
  const isOwned = (d: Deal) => owned.ids.has(String(d.steamAppId ?? d.id.slice(store.id.length + 1))) || owned.titles.has(fold(d.title));

  return (
    <section className="section-group">
      <div className="section-head">
        <h2>{store.name}</h2>
        <button className="btn ghost" disabled={loading[store.id]} onClick={() => void refreshDeals(store.id, true)}>
          <RefreshCw size={13} aria-hidden /> {loading[store.id] ? "Atualizando…" : "Atualizar"}
        </button>
      </div>
      <p className="muted small">Atualizado em {stamp(slot?.fetchedAt)}. {store.source} Fonte não oficial; pode mudar.</p>
      {errors[store.id] && <p className="note warn" role="alert">Não foi possível ler {store.name}: {errors[store.id]}</p>}
      {slot && !items.length && !errors[store.id] && <p className="empty">Nenhuma promoção encontrada agora.</p>}
      <div className="freebie-grid">
        {items.map((d) => <DealCard key={d.id} {...d} note={until(d.endsAt)} owned={isOwned(d)} insight={insights.get(d.id)} />)}
      </div>
    </section>
  );
}

function ForYouSection({ list, insights }: { list: Deal[]; insights: Map<string, DealInsight> }) {
  if (!list.length) return null;
  return (
    <section className="section-group">
      <div className="section-head"><h2>Para você ({list.length})</h2></div>
      <p className="muted small">Jogos da sua wishlist (Steam ou do app) em promoção agora e que você ainda não tem em nenhuma loja.</p>
      <div className="freebie-grid">
        {list.slice(0, 12).map((d) => <DealCard key={d.id} {...d} note={until(d.endsAt)} insight={insights.get(d.id)} />)}
      </div>
    </section>
  );
}

function AlertsSection() {
  const hits = usePriceAlerts((s) => s.hits);
  const targets = usePriceAlerts((s) => s.targets);
  const count = Object.keys(targets).length;
  if (!count) return null;
  return (
    <section className="section-group" aria-label="Alertas de preço">
      <div className="section-head"><h2>Alertas de preço ({hits.length} de {count} atingidos)</h2></div>
      {hits.length === 0 ? (
        <p className="muted small">Nenhum dos {count} jogos com aviso chegou ao preço-alvo agora. Os avisos ficam só neste computador e são conferidos quando o app abre e quando você atualiza as ofertas.</p>
      ) : (
        <ul className="plain">
          {hits.map((h) => (
            <li key={h.title}>
              <strong>{h.title}</strong> por <b>{formatMoney(h.finalCents, h.currency)}</b> na {h.store}{" "}
              <span className="tag ok">alvo {formatMoney(h.targetCents, h.currency)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function DealsView() {
  const deals = useDeals((s) => s.deals);
  const wishlist = useDeals((s) => s.wishlist);
  const games = useLibrary((s) => s.games);
  const live = useMemo(() => STORES.flatMap((s) => sortDeals(liveDeals(deals[s.id]?.items ?? []))), [deals]);
  const insights = useMemo(() => dealInsights(live, games, wishlist?.items.map((w) => w.title) ?? []), [live, games, wishlist]);
  const forYou = useMemo(() => opportunities(live, insights), [live, insights]);
  const targets = usePriceAlerts((s) => s.targets);
  // Keep the hits (and the sidebar badge) in step with whatever was just fetched or edited.
  useEffect(() => { recomputeHits(); }, [deals, wishlist, targets]);
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Promoções</h1>
          <p className="muted">Ofertas da Steam, GOG e Epic, mais a sua wishlist da Steam com o preço de agora. A compra acontece na própria loja.</p>
        </div>
      </header>
      <AlertsSection />
      <ForYouSection list={forYou} insights={insights} />
      <WishlistSection />
      {STORES.map((s) => <StoreSection key={s.id} store={s} insights={insights} />)}
    </>
  );
}
