import { RotateCw, TriangleAlert } from "lucide-react";

/** Placeholder block with the shimmer; size it with a class or inline style. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`skeleton ${className}`} aria-hidden />;
}

/** Card-shaped placeholders, the same grid as the library, so nothing jumps when the data lands. */
export function SkeletonGrid({ count = 12, label = "Carregando…" }: { count?: number; label?: string }) {
  return (
    <div className="game-grid skeleton-grid" data-density="comfortable" role="status" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton-card">
          <Skeleton className="skeleton-cover" />
          <Skeleton className="skeleton-line" />
          <Skeleton className="skeleton-line short" />
        </div>
      ))}
    </div>
  );
}

/** A failed load: what went wrong and one way out. */
export function LoadError({ title = "Não foi possível carregar.", reason, onRetry }: { title?: string; reason?: string; onRetry: () => void }) {
  return (
    <section className="load-error" role="alert">
      <TriangleAlert size={22} aria-hidden />
      <div>
        <p className="load-error-title">{title}</p>
        {reason && <p className="muted small">{reason}</p>}
      </div>
      <button type="button" className="btn" onClick={onRetry}><RotateCw size={14} aria-hidden /> Tentar de novo</button>
    </section>
  );
}
