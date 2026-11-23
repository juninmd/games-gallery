import { CHART_DAYS } from "../domain/playChart";

const H = 20;
const fmtHours = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** Hours played and a fixed-height bar per day of the last two weeks, in the game's accent color. */
export function CardStats({ hours, row }: { hours: number; row?: number[] }) {
  const max = Math.max(1, ...(row ?? []));
  const recent = row?.reduce((s, m) => s + m, 0) ?? 0;
  const label = `${hours ? `${fmtHours.format(hours)} h jogadas` : "Nunca jogado"}${recent ? `, ${Math.round(recent)} min nas últimas 2 semanas` : ""}`;
  return (
    <div className="card-stats" role="img" aria-label={label}>
      <span className="card-hours">{hours ? `${fmtHours.format(hours)} h` : "—"}</span>
      <svg className="card-bars" viewBox={`0 0 ${CHART_DAYS * 4} ${H}`} preserveAspectRatio="none" aria-hidden>
        {Array.from({ length: CHART_DAYS }, (_, i) => {
          const h = row?.[i] ? Math.max(2, (row[i]! / max) * H) : 1;
          return <rect key={i} x={i * 4} y={H - h} width={3} height={h} rx={1} data-on={row?.[i] ? "" : undefined} />;
        })}
      </svg>
    </div>
  );
}
