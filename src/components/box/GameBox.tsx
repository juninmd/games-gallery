import { useId, useState, type CSSProperties, type Ref } from "react";
import { PLATFORM_BY_ID } from "../../domain/platforms";
import { PROVIDER_BY_ID } from "../../domain/providers";
import type { Game } from "../../domain/types";
import { artSeed, boxSpecFor, type BoxSpec, type Motif } from "./boxFormats";
import { brandPath } from "./brandIcons";

export function BrandIcon({ d, className }: { d: string | null; className?: string }) {
  if (!d) return null;
  return <svg className={`bx-ico ${className ?? ""}`} viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
}

function motifShapes(motif: Motif, dark: string, light: string) {
  switch (motif) {
    case "sun": return <><circle cx="50" cy="66" r="26" fill={light} opacity=".9" /><path d="M0 112 Q30 98 50 110 T100 106 V168 H0Z" fill={dark} opacity=".7" /></>;
    case "peaks": return <><path d="M-5 120 L28 56 L50 96 L70 48 L108 120 V168 H-5Z" fill={light} opacity=".85" /><path d="M-5 138 L34 92 L58 124 L84 86 L108 138 V168 H-5Z" fill={dark} opacity=".85" /></>;
    case "rings": return <g fill="none" stroke={light} strokeWidth="2.2"><circle cx="50" cy="70" r="14" opacity=".85" /><circle cx="50" cy="70" r="26" opacity=".6" /><circle cx="50" cy="70" r="40" opacity=".4" /><circle cx="50" cy="70" r="56" opacity=".22" /></g>;
    case "blade": return <><g fill={light} opacity=".85"><path d="M62 0 L74 0 L30 120 L20 120Z" /><path d="M82 10 L88 10 L58 96 L52 96Z" opacity=".6" /></g><path d="M0 130 L100 90 V168 H0Z" fill={dark} opacity=".75" /></>;
    case "moon": return <><circle cx="56" cy="62" r="28" fill={light} /><circle cx="68" cy="54" r="26" fill={dark} /><g fill={light} opacity=".8"><circle cx="18" cy="30" r="1.2" /><circle cx="84" cy="22" r="1" /><circle cx="26" cy="100" r="1.1" /><circle cx="90" cy="96" r="1.4" /></g></>;
    case "grid": return <><g stroke={light} strokeWidth="1" opacity=".7" fill="none"><path d="M0 100 H100 M0 112 H100 M0 128 H100 M0 150 H100" /><path d="M50 84 L-20 168 M50 84 L10 168 M50 84 L50 168 M50 84 L90 168 M50 84 L120 168" /></g><circle cx="50" cy="66" r="20" fill={light} opacity=".9" /><path d="M30 66 H70 M32 72 H68 M36 78 H64" stroke={dark} strokeWidth="2" /></>;
    case "wave": return <g fill="none" stroke={light} strokeWidth="3"><path d="M-5 70 Q25 44 50 70 T105 70" opacity=".85" /><path d="M-5 88 Q25 62 50 88 T105 88" opacity=".6" /><path d="M-5 106 Q25 80 50 106 T105 106" opacity=".4" /></g>;
  }
}

/** Placeholder cover for games without art: same title, same picture, tinted by platform. */
function GeneratedArt({ game }: { game: Pick<Game, "title" | "platformId"> }) {
  const id = useId().replace(/:/g, "");
  const seed = artSeed(game.title, game.platformId);
  return (
    <svg className="bx-gen" viewBox="0 0 100 168" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={seed.dark} />
          <stop offset="1" stopColor={seed.mid} />
        </linearGradient>
      </defs>
      <rect width="100" height="168" fill={`url(#${id})`} />
      {motifShapes(seed.motif, seed.dark, seed.light)}
    </svg>
  );
}

/** Official art when it loads; otherwise the generated one with the title printed on it. */
function BoxArt({ game, title = false, className = "" }: { game: Game; title?: boolean; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const src = game.coverUrl && game.coverUrl !== failed ? game.coverUrl : null;
  return (
    <div className={`bx-art ${src ? "is-real" : ""} ${className}`}>
      {src ? (
        <img src={src} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setFailed(src)} />
      ) : (
        <>
          <GeneratedArt game={game} />
          {title && <div className={`bx-title ${game.title.length > 15 ? "is-long" : ""}`}>{game.title}</div>}
        </>
      )}
    </div>
  );
}

/** Stacked copies of the shell silhouette give a cartridge its thickness when it turns. */
const SLABS = [0, 1, 2, 3, 4, 5, 6, 7];

function Media({ game, spec }: { game: Game; spec: BoxSpec }) {
  const icon = brandPath(game.platformId, game.providerId);
  const label = <BoxArt game={game} />;
  if (spec.media === "disc" || spec.media === "minidisc") {
    return (
      <div className={`bx-disc ${spec.media === "minidisc" ? "is-mini" : ""}`} style={{ "--bx-tint": spec.tint } as CSSProperties}>
        <div className="bx-disc-label">{label}<small>{spec.mediaLabel}</small><BrandIcon d={icon} /></div>
        <i className="bx-sheen" />
      </div>
    );
  }
  if (spec.media === "umd") {
    return <div className="bx-umd">{<div className="bx-umd-label">{label}</div>}<i className="bx-umd-disc" /><i className="bx-gloss2" /></div>;
  }
  if (spec.media === "card" || spec.media === "dscart") {
    return <div className={`bx-card ${spec.media === "dscart" ? "is-ds" : ""}`}><div className="bx-card-label">{label}</div><i className="bx-pins" /><i className="bx-gloss2" /></div>;
  }
  return (
    <div className={`bx-cart ${spec.media}`} style={{ "--bx-tint": spec.tint } as CSSProperties}>
      {SLABS.map((k) => <i key={k} className="bx-slab" style={{ "--k": k } as CSSProperties} />)}
      <div className="bx-cart-body">
        <i className="bx-shell" />
        <div className="bx-cart-label">{label}<b>{game.title}</b></div>
        <i className="bx-pins" /><i className="bx-gloss2" />
      </div>
    </div>
  );
}

export interface GameBoxProps {
  game: Game;
  /** Same game in other stores; the back lists them. */
  members?: Game[];
  /** "shelf": cheap closed box. "stage": full interior and media. */
  detail?: "shelf" | "stage";
  ref?: Ref<HTMLDivElement>;
  className?: string;
  style?: CSSProperties;
}

/** Retail-style 3D package for one game. All motion is driven by CSS variables on the root node. */
export function GameBox({ game, members = [game], detail = "shelf", ref, className = "", style }: GameBoxProps) {
  const spec = boxSpecFor(game.platformId);
  const platform = PLATFORM_BY_ID[game.platformId];
  const provider = PROVIDER_BY_ID[game.providerId];
  const seed = artSeed(game.title, game.platformId);
  const icon = brandPath(game.platformId, game.providerId);
  const stores = [...new Set(members.map((m) => PROVIDER_BY_ID[m.providerId]?.name).filter(Boolean))];
  const carton = spec.format === "carton" || spec.format === "cartonSm";
  const vars = {
    "--bx-w": `${spec.w}px`, "--bx-h": `${spec.h}px`, "--bx-d": `${spec.d}px`,
    "--bx-pc": platform?.color ?? "#555", "--bx-c1": seed.dark, "--bx-c2": seed.mid,
    ...style,
  } as CSSProperties;
  const stage = detail === "stage";

  return (
    <div ref={ref} className={`bx bx-f-${spec.format} ${className}`} style={vars} data-media={spec.media}>
      <div className="bx-inner">
        {stage && <div className="bx-mpos"><i className="bx-hub" /><div className="bx-media"><Media game={game} spec={spec} /></div></div>}
      </div>
      <div className="bx-door">
        <div className="bx-face bx-front">
          <div className="bx-band">
            <b><BrandIcon d={icon} />{carton && platform && platform.name.length <= 14 ? platform.name : (platform?.short ?? "")}</b>
            {game.rating ? <span>★ {game.rating}</span> : null}
          </div>
          <BoxArt game={game} title />
          {!carton && (
            <div className="bx-foot">
              <span>{provider?.name}</span>
              {game.installed && <em>Instalado</em>}
            </div>
          )}
          <i className="bx-crease" /><i className="bx-gloss" />
        </div>
        {stage && (
          <div className="bx-face bx-doorin">
            <BoxArt game={game} className="bx-liner-art" />
            <div className="bx-liner-text">
              <BrandIcon d={icon} />
              <h5>{game.title}</h5>
              <p>{game.genres.slice(0, 3).join(" · ") || platform?.name}<br />{spec.mediaLabel}</p>
            </div>
          </div>
        )}
      </div>
      <div className="bx-face bx-back">
        <h4>{game.title}</h4>
        <ul>
          {game.genres.slice(0, 3).map((g) => <li key={g}>{g}</li>)}
          <li>{platform?.name}</li>
          <li>{game.year ? `Lançamento ${game.year}` : spec.mediaLabel}</li>
          {stores.length > 0 && <li>{stores.join(" · ")}</li>}
        </ul>
        <div className="bx-spec">
          <span>{game.playtimeH ? `${game.playtimeH} h jogadas` : "Ainda não jogado"}{game.sizeGb ? <><br />{game.sizeGb} GB</> : null}</span>
          <div className="bx-barcode" />
        </div>
      </div>
      <div className="bx-face bx-sl">
        <div className="bx-sp-top">{icon ? <BrandIcon d={icon} /> : <span>{platform?.short}</span>}</div>
        <div className="bx-sp-body"><b>{game.title}</b></div>
        <div className="bx-sp-dot"><i className={game.installed ? "is-on" : ""} /></div>
      </div>
      <div className="bx-face bx-sr" /><div className="bx-face bx-st" /><div className="bx-face bx-sb" />
    </div>
  );
}
