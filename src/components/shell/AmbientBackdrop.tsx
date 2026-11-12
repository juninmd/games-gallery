import { useEffect } from "react";
import { useUi } from "../../state/ui";

/** Full-window color field that fades to the game in focus; the signature colors otherwise. */
export function AmbientBackdrop() {
  const ambient = useUi((s) => s.ambient);

  useEffect(() => {
    const root = document.documentElement.style;
    if (ambient) {
      root.setProperty("--amb-1", ambient[0]);
      root.setProperty("--amb-2", ambient[1]);
    } else {
      root.removeProperty("--amb-1");
      root.removeProperty("--amb-2");
    }
  }, [ambient]);

  return (
    <div aria-hidden className="ambient">
      <span className="ambient-field" />
      <span className="ambient-vignette" />
    </div>
  );
}
