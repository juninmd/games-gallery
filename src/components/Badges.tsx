import { Badge } from "@juninmd/sonido";
import { PLATFORM_BY_ID } from "../domain/platforms";
import { PROVIDER_BY_ID } from "../domain/providers";
import { STATUS_COLOR, STATUS_LABEL } from "../domain/status";
import type { PlayStatus } from "../domain/types";

export function PlatformTag({ id }: { id: string }) {
  const p = PLATFORM_BY_ID[id];
  return (
    <Badge style={{ borderColor: p?.color, color: p?.color }} title={p?.name}>
      {p?.short ?? id}
    </Badge>
  );
}

export function ProviderTag({ id }: { id: string }) {
  const p = PROVIDER_BY_ID[id];
  return (
    <Badge className="tag-provider" title={p?.name}>
      <i className="dot" style={{ background: p?.color }} />
      {p?.name ?? id}
    </Badge>
  );
}

export function StatusPill({ status }: { status: PlayStatus }) {
  return <Badge style={{ color: STATUS_COLOR[status] }}>{STATUS_LABEL[status]}</Badge>;
}
