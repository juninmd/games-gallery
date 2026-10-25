import { useState, type FormEvent } from "react";
import { FAMILY_LABEL, PLATFORMS } from "../domain/platforms";
import { PROVIDERS } from "../domain/providers";
import { STATUS_LABEL, STATUS_ORDER } from "../domain/status";
import type { PlayStatus } from "../domain/types";
import { game as makeGame } from "../domain/seed/build";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";
import { useNativeDialog } from "./useNativeDialog";

export function AddGameModal() {
  const { addOpen, setAddOpen, toast, select } = useUi();
  const addGame = useLibrary((s) => s.addGame);
  const [title, setTitle] = useState("");
  const [platformId, setPlatformId] = useState("pc");
  const [providerId, setProviderId] = useState("steam");
  const [year, setYear] = useState(new Date().getFullYear());
  const [status, setStatus] = useState<PlayStatus>("backlog");
  const [storeId, setStoreId] = useState("");
  const close = () => {
    setAddOpen(false);
    setTitle("");
    setStoreId("");
  };
  const dialog = useNativeDialog(addOpen, close);

  // PC accepts any store/aggregator; consoles accept their own service plus local sources.
  const providers = PROVIDERS.filter((p) =>
    platformId === "pc" ? p.kind === "pc-store" || p.kind === "aggregator" || p.kind === "local" : p.platforms.includes(platformId) || p.kind === "local",
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = title.trim();
    if (!name) return;
    const g = makeGame(platformId, providerId, name, year, "Sem gênero", { s: status, store: storeId.trim() || undefined });
    g.id = `custom-${crypto.randomUUID()}`;
    addGame(g);
    close();
    toast(`${name} adicionado`);
    select(g.id);
  };

  const onPlatform = (id: string) => {
    setPlatformId(id);
    const first = PROVIDERS.find((p) => (id === "pc" ? p.kind === "pc-store" : p.platforms.includes(id)));
    setProviderId(first?.id ?? "physical");
  };

  return (
    <dialog ref={dialog.ref} className="native-dialog modal" aria-labelledby="add-game-title" onCancel={dialog.onCancel} onPointerDown={dialog.onPointerDown} onPointerUp={dialog.onPointerUp}>
      <form className="dialog-content" onSubmit={submit}>
        <h2 id="add-game-title">Adicionar jogo</h2>
        <label>Título<input autoFocus required maxLength={300} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <div className="two">
          <label>Plataforma
            <select value={platformId} onChange={(e) => onPlatform(e.target.value)}>
              {(Object.keys(FAMILY_LABEL) as (keyof typeof FAMILY_LABEL)[]).map((fam) => (
                <optgroup key={fam} label={FAMILY_LABEL[fam]}>
                  {PLATFORMS.filter((p) => p.family === fam).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label>Origem
            <select value={providerId} onChange={(e) => setProviderId(e.target.value)}>
              {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        </div>
        <div className="two">
          <label>Ano<input type="number" min={1970} max={2100} value={year} onChange={(e) => setYear(Number(e.target.value))} /></label>
          <label>Status
            <select value={status} onChange={(e) => setStatus(e.target.value as PlayStatus)}>
              {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </label>
        </div>
        {platformId === "pc" && (
          <label>ID na loja (opcional, necessário para o botão Jogar)
            <input maxLength={100} value={storeId} placeholder="ex.: 1245620" onChange={(e) => setStoreId(e.target.value)} />
          </label>
        )}
        <div className="actions">
          <button type="button" className="btn ghost" onClick={close}>Cancelar</button>
          <button type="submit" className="btn primary" disabled={!title.trim()}>Adicionar</button>
        </div>
      </form>
    </dialog>
  );
}
