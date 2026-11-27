import { Button, Dialog, Kbd } from "@juninmd/sonido";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import type { GameGroup } from "../../domain/duplicates";
import { PLATFORM_BY_ID } from "../../domain/platforms";
import { PROVIDER_BY_ID } from "../../domain/providers";
import { STATUS_LABEL } from "../../domain/status";
import { boxSpecFor } from "./boxFormats";
import { GameBox } from "./GameBox";
import { useFullScan } from "./useScan";

const FRONT = 24;
const SPINE = 90;
const BACK = 180;
const OPEN_DEG = -158;

/** Inspection bench: drag to turn the box, open the lid and take the disc or cartridge out. */
function StageBody({ group, onDetails }: { group: GameGroup; onDetails: (id: string) => void }) {
  const game = group.primary;
  const spec = boxSpecFor(game.platformId);
  const scan = useFullScan(game);
  const platform = PLATFORM_BY_ID[game.platformId];
  const boxRef = useRef<HTMLDivElement>(null);
  const angle = useRef({ ry: -70, rx: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [out, setOut] = useState(false);

  // Fits the box and its open lid inside the scene.
  const [scale] = useState(() => {
    const sceneW = Math.min(560, (typeof window === "undefined" ? 560 : window.innerWidth) - 56);
    return Math.min(2, 340 / spec.h, (sceneW * 0.94) / (spec.w * 2));
  });

  const turn = (ry: number, rx: number, ease: boolean) => {
    const el = boxRef.current;
    if (!el) return;
    angle.current = { ry, rx };
    el.classList.toggle("is-easing", ease);
    el.style.setProperty("--bx-ry", `${ry}deg`);
    el.style.setProperty("--bx-rx", `${rx}deg`);
  };

  useEffect(() => {
    turn(angle.current.ry, 0, false);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => turn(FRONT, 0, true)));
    return () => cancelAnimationFrame(id);
  }, []);

  const setLid = (next: boolean) => {
    setOpen(next);
    if (!next) setOut(false);
    const el = boxRef.current;
    el?.style.setProperty("--bx-open", next ? `${OPEN_DEG}deg` : "0deg");
    el?.style.setProperty("--bx-ox", next ? `${spec.w / 2}px` : "0px");
    if (next) turn(4, -6, true); else turn(FRONT, 0, true);
  };
  const setMedia = (next: boolean) => {
    if (next && !open) setLid(true);
    setOut(next);
  };
  const face = (ry: number) => { if (open) setLid(false); turn(ry, 0, true); };

  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === "o") setLid(!open);
    else if (key === "t") setMedia(!out);
    else if (key === "f") turn(angle.current.ry + 180, 0, true);
    else if (e.key === "ArrowLeft") turn(angle.current.ry - 25, angle.current.rx, true);
    else if (e.key === "ArrowRight") turn(angle.current.ry + 25, angle.current.rx, true);
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const { ry, rx } = angle.current;
    turn(ry + (e.clientX - d.x) * 0.55, Math.max(-35, Math.min(35, rx - (e.clientY - d.y) * 0.3)), false);
    drag.current = { x: e.clientX, y: e.clientY };
  };

  const stores = [...new Set(group.members.map((m) => PROVIDER_BY_ID[m.providerId]?.name ?? m.providerId))];
  const facts: [string, string][] = [
    ["Mídia", spec.mediaLabel],
    ["Jogadas", `${group.members.reduce((s, m) => s + m.playtimeH, 0)} h`],
    ["Ano", game.year ? String(game.year) : "—"],
    ["Status", STATUS_LABEL[game.status]],
  ];

  return (
    <div className="bx-bench" onKeyDown={onKey}>
      <div className="bx-scene" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <GameBox
          ref={boxRef}
          game={game}
          members={group.members}
          detail="stage"
          className={`bx-stage-box ${out ? "is-out" : ""}`}
          style={{ "--bx-ss": scale } as CSSProperties}
        />
        <i className="bx-floor" />
      </div>
      <div className="bx-info">
        <span className="bx-tag">{platform?.name}{game.genres[0] ? ` · ${game.genres[0]}` : ""}</span>
        <p className="bx-title" aria-hidden>{game.title}</p>
        <dl className="bx-facts">
          {facts.map(([k, v]) => <div key={k}><dd>{v}</dd><dt>{k}</dt></div>)}
        </dl>
        {stores.length > 0 && <p className="bx-note">{stores.length > 1 ? "Lojas" : "Loja"}: {stores.join(", ")}</p>}
        <div className="bx-acts">
          <Button variant="primary" onClick={() => onDetails(game.id)}>Ver detalhes</Button>
          <Button variant="secondary" aria-pressed={open} onClick={() => setLid(!open)}>{open ? "Fechar caixa" : "Abrir caixa"}</Button>
          <Button variant="secondary" aria-pressed={out} onClick={() => setMedia(!out)}>{out ? "Guardar" : "Tirar"} {spec.take}</Button>
        </div>
        <div className="bx-acts" role="group" aria-label="Girar a caixa">
          <Button variant="ghost" onClick={() => face(FRONT)}>Frente</Button>
          <Button variant="ghost" onClick={() => face(SPINE)}>Lombada</Button>
          <Button variant="ghost" onClick={() => face(BACK)}>Verso</Button>
        </div>
        <p className="bx-note">
          {scan ? "Caixa completa escaneada (GameTDB)." : game.coverUrl ? "Capa carregada da loja." : "Sem capa oficial: arte gerada."} Arraste para girar · <Kbd>O</Kbd> abre · <Kbd>T</Kbd> tira a mídia · <Kbd>F</Kbd> vira
        </p>
      </div>
    </div>
  );
}

export function BoxStage({ group, onClose, onDetails }: { group?: GameGroup; onClose: () => void; onDetails: (id: string) => void }) {
  return (
    <Dialog open={Boolean(group)} onClose={onClose} title={group?.primary.title ?? "Caixa"} className="bx-stage">
      {group && <StageBody key={group.primary.id} group={group} onDetails={onDetails} />}
    </Dialog>
  );
}
