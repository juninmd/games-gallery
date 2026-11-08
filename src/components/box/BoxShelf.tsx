import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { GameGroup } from "../../domain/duplicates";
import { PLATFORM_BY_ID } from "../../domain/platforms";
import { useUi } from "../../state/ui";
import { BoxStage } from "./BoxStage";
import { boxSpecFor, layoutShelves } from "./boxFormats";
import { GameBox } from "./GameBox";

const GAP = 14;
const SIDE = 20;
const scaleFor = (width: number) => (width < 560 ? 0.78 : 1);

/** Tracks the element width without re-rendering on sub-pixel noise. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    setWidth(Math.round(node.clientWidth));
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry?.contentRect.width ?? 0)));
    ro.observe(node);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export function BoxShelf({ groups, busy }: { groups: GameGroup[]; busy: boolean }) {
  const [ref, width] = useWidth();
  const [openId, setOpenId] = useState<string | null>(null);
  const select = useUi((s) => s.select);
  const scale = scaleFor(width);

  const rows = useMemo(() => {
    const widths = groups.map((g) => boxSpecFor(g.primary.platformId).w * scale);
    return layoutShelves(widths, Math.max(0, width - SIDE * 2), GAP).map((row) => row.map((i) => groups[i]!));
  }, [groups, scale, width]);

  const open = openId ? groups.find((g) => g.primary.id === openId) : undefined;

  // Writes the light position straight to the node: no re-render per pointer move.
  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    const node = e.currentTarget;
    const r = node.getBoundingClientRect();
    node.style.setProperty("--bx-mx", `${(((e.clientX - r.left) / r.width) * 100).toFixed(0)}%`);
    node.style.setProperty("--bx-my", `${(((e.clientY - r.top) / r.height) * 100).toFixed(0)}%`);
  };

  let n = 0;
  return (
    <div ref={ref} className="bx-shelves" style={{ "--bx-s": scale } as CSSProperties} aria-busy={busy}>
      {rows.map((row) => (
        <div className="bx-row" key={row[0]!.primary.id}>
          {row.map((g) => {
            const spec = boxSpecFor(g.primary.platformId);
            const stores = g.members.length > 1 ? `, em ${g.members.length} lojas` : "";
            return (
              <button
                key={g.primary.id}
                type="button"
                className="bx-slot"
                style={{ "--bx-w": `${spec.w}px`, "--bx-h": `${spec.h}px`, "--bx-i": n++ } as CSSProperties}
                onPointerMove={onMove}
                onClick={() => setOpenId(g.primary.id)}
                aria-label={`Abrir a caixa de ${g.primary.title}, ${PLATFORM_BY_ID[g.primary.platformId]?.name ?? ""}${stores}`}
              >
                <GameBox game={g.primary} members={g.members} />
              </button>
            );
          })}
        </div>
      ))}
      <BoxStage
        group={open}
        onClose={() => setOpenId(null)}
        onDetails={(id) => { setOpenId(null); select(id); }}
      />
    </div>
  );
}
