import { useEffect, useState } from "react";
import { prefersReducedMotion } from "./ambient";

const KEY = "games-gallery:intro-seen";
const seen = () => {
  try { return sessionStorage.getItem(KEY) === "1"; } catch { return true; }
};

/** Brand reveal on the first window of a session; skipped under reduced motion. */
export function Intro() {
  const [show, setShow] = useState(() => typeof window !== "undefined" && !seen() && !prefersReducedMotion());

  useEffect(() => {
    if (!show) return;
    try { sessionStorage.setItem(KEY, "1"); } catch { /* storage unavailable: show once per load */ }
    const t = setTimeout(() => setShow(false), 1900);
    return () => clearTimeout(t);
  }, [show]);

  if (!show) return null;
  return <div className="intro" aria-hidden><b>Games Gallery</b></div>;
}
