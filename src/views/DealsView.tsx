import { RefreshCw } from "lucide-react";
import { useEffect, useMemo } from "react";
import { DealCard } from "../components/DealCard";
import { type Deal, type DealStore, liveDeals, sortDeals } from "../domain/deals";
import { fold } from "../domain/scan/fold";
import { isValidSteamId } from "../platform/steamApi";
import { useDeals } from "../state/deals";
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

function StoreSection({ store }: { store: (typeof STORES)[number] }) {
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
        {items.map((d) => <DealCard key={d.id} {...d} note={until(d.endsAt)} owned={isOwned(d)} />)}
      </div>
    </section>
  );
}

export function DealsView() {
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Promoções</h1>
          <p className="muted">Ofertas da Steam, GOG e Epic, mais a sua wishlist da Steam com o preço de agora. A compra acontece na própria loja.</p>
        </div>
      </header>
      <WishlistSection />
      {STORES.map((s) => <StoreSection key={s.id} store={s} />)}
    </>
  );
}
