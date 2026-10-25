import { useEffect, useRef } from "react";

/** Opens a mounted native dialog and returns focus to the element that opened it. */
export function useNativeDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const backdropPress = useRef(false);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) {
        returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        dialog.showModal();
      }
      return () => {
        if (dialog.open) dialog.close();
        returnFocus.current?.focus({ preventScroll: true });
      };
    }
    return undefined;
  }, [open]);

  return {
    ref,
    onCancel: (event: React.SyntheticEvent<HTMLDialogElement>) => {
      event.preventDefault();
      onCloseRef.current();
    },
    onPointerDown: (event: React.PointerEvent<HTMLDialogElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      backdropPress.current = event.button === 0 &&
        (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom);
    },
    onPointerUp: (event: React.PointerEvent<HTMLDialogElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const endedOutside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
      if (backdropPress.current && endedOutside) onCloseRef.current();
      backdropPress.current = false;
    },
  };
}
