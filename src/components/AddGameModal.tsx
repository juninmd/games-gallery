import { Button, Dialog, Select, TextField } from "@juninmd/sonido";
import { useState, type FormEvent } from "react";
import { FAMILY_LABEL, PLATFORMS } from "../domain/platforms";
import { PROVIDERS } from "../domain/providers";
import { STATUS_LABEL, STATUS_ORDER } from "../domain/status";
import type { PlayStatus } from "../domain/types";
import { game as makeGame } from "../domain/gameFactory";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";

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

  const platformOptions = (Object.keys(FAMILY_LABEL) as (keyof typeof FAMILY_LABEL)[]).flatMap((fam) =>
    PLATFORMS.filter((p) => p.family === fam).map((p) => ({ value: p.id, label: `${FAMILY_LABEL[fam]} · ${p.name}` })));

  return (
    <Dialog
      open={addOpen}
      onClose={close}
      title="Adicionar jogo"
      footer={<>
        <Button variant="ghost" onClick={close}>Cancelar</Button>
        <Button type="submit" form="add-game-form" disabled={!title.trim()}>Adicionar</Button>
      </>}
    >
      <form id="add-game-form" className="fields" onSubmit={submit}>
        <TextField label="Título" autoFocus required maxLength={300} value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="two">
          <Select label="Plataforma" value={platformId} onChange={onPlatform} options={platformOptions} />
          <Select label="Origem" value={providerId} onChange={setProviderId} options={providers.map((p) => ({ value: p.id, label: p.name }))} />
        </div>
        <div className="two">
          <TextField label="Ano" type="number" min={1970} max={2100} value={year} onChange={(e) => setYear(Number(e.target.value))} />
          <Select label="Status" value={status} onChange={(v) => setStatus(v as PlayStatus)} options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
        </div>
        {platformId === "pc" && (
          <TextField label="ID na loja (opcional, necessário para o botão Jogar)" maxLength={100} value={storeId} placeholder="ex.: 1245620" onChange={(e) => setStoreId(e.target.value)} />
        )}
      </form>
    </Dialog>
  );
}
