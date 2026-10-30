import logo from "../assets/logo.svg";

export function Logo({ size = 36 }: { size?: number }) {
  return <img src={logo} width={size} height={size} alt="" aria-hidden className="shrink-0 rounded-[28%] shadow-glow" />;
}
