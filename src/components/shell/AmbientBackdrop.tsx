import { AmbientBackdrop as SonidoBackdrop } from "@juninmd/sonido";
import { useEffect } from "react";
import { useUi } from "../../state/ui";

/** Sonido's color field, fed the game in focus; also exposes the colors as --amb-* for accents. */
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

  return <SonidoBackdrop className="app-ambient" colors={ambient ?? undefined} />;
}
