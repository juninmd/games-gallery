import { useToast } from "@juninmd/sonido";
import { useEffect, useRef } from "react";
import { useUi } from "../state/ui";

/** Relays the app's toast queue to Sonido's toaster; needs to sit inside <ToastProvider>. */
export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  const show = useToast();
  const lastId = useRef(0);

  useEffect(() => {
    for (const t of toasts) {
      if (t.id <= lastId.current) continue;
      lastId.current = t.id;
      show({ title: t.msg });
    }
  }, [toasts, show]);

  return null;
}
