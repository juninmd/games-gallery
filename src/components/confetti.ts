import { prefersReducedMotion } from "./shell/ambient";

const COLORS = ["#ff8a4c", "#ff4d8d", "#a56bff", "#46f0c1", "#5cc8ff", "#ffc15e"];

/** A short burst of confetti from a point on screen (finishing a game deserves it). */
export function confetti(x: number, y: number, pieces = 42) {
  if (typeof document === "undefined" || prefersReducedMotion()) return;
  for (let i = 0; i < pieces; i++) {
    const p = document.createElement("i");
    p.className = "confetti";
    p.style.cssText = `left:${x}px;top:${y}px;background:${COLORS[i % COLORS.length]}`;
    document.body.append(p);
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 170;
    const anim = p.animate(
      [
        { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
        { transform: `translate(${Math.cos(angle) * speed}px, ${Math.sin(angle) * speed + 150}px) rotate(${Math.random() * 720}deg)`, opacity: 0 },
      ],
      { duration: 1100 + Math.random() * 500, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
    );
    anim.onfinish = () => p.remove();
  }
}

/** Confetti centred on an element, e.g. the button that was just pressed. */
export function confettiFrom(el: Element | null | undefined) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  confetti(r.left + r.width / 2, r.top + r.height / 2);
}
