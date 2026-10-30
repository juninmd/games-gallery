import { useEffect, useRef, useState } from "react";

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));

/** Counts from the previous value to `value`; jumps straight there under reduced motion. */
export function CountUp({ value }: { value: number }) {
  const from = useRef(0);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || start === value) {
      setShown(value);
      return;
    }
    const t0 = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - t0) / 900);
      setShown(Math.round(start + (value - start) * easeOutExpo(t)));
      if (t < 1) raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{shown.toLocaleString("pt-BR")}</>;
}
