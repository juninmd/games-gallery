import { Alert, Button, Skeleton } from "@juninmd/sonido";
import { RotateCw } from "lucide-react";

/** Card-shaped placeholders, the same grid as the library, so nothing jumps when the data lands. */
export function SkeletonGrid({ count = 12, label = "Carregando…" }: { count?: number; label?: string }) {
  return (
    <div className="game-grid" data-density="comfortable" role="status" aria-label={label}>
      {Array.from({ length: count }, (_, i) => <Skeleton key={i} media rows={2} />)}
    </div>
  );
}

/** A failed load: what went wrong and one way out. */
export function LoadError({ title = "Não foi possível carregar.", reason, onRetry }: { title?: string; reason?: string; onRetry: () => void }) {
  return (
    <Alert tone="danger" title={title} action={<Button size="sm" variant="secondary" iconStart={<RotateCw size={14} aria-hidden />} onClick={onRetry}>Tentar de novo</Button>}>
      {reason}
    </Alert>
  );
}
