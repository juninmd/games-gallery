import { PLATFORM_BY_ID } from "../domain/platforms";
import { PROVIDER_BY_ID } from "../domain/providers";
import { STATUS_COLOR, STATUS_LABEL } from "../domain/status";
import type { PlayStatus } from "../domain/types";

export function PlatformTag({ id }: { id: string }) {
  const p = PLATFORM_BY_ID[id];
  return (
    <span className="tag" style={{ borderColor: p?.color, color: p?.color }} title={p?.name}>
      {p?.short ?? id}
    </span>
  );
}

export function ProviderTag({ id }: { id: string }) {
  const p = PROVIDER_BY_ID[id];
  return (
    <span className="tag tag-provider" title={p?.name}>
      <i className="dot" style={{ background: p?.color }} />
      {p?.name ?? id}
    </span>
  );
}

export function StatusPill({ status }: { status: PlayStatus }) {
  return (
    <span className="pill" style={{ "--c": STATUS_COLOR[status] } as React.CSSProperties}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div style={{ width: `${value}%` }} />
    </div>
  );
}
