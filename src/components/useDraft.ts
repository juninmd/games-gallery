import { useState } from "react";

/**
 * Editable copy of a stored value, derived during render: untouched, it follows the store
 * (vault hydration, a reset); once typed in, it holds the user's text until `reset`.
 */
export function useDraft(stored: string) {
  const [draft, setDraft] = useState<string | null>(null);
  return [draft ?? stored, setDraft, () => setDraft(null)] as const;
}
