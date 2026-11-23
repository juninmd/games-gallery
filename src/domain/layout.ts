/** From this window width on the navigation is a side rail; below it, a tab bar at the bottom. */
export const SIDEBAR_MIN_WIDTH = 768;

export type ShellLayout = "sidebar" | "tabs";

export const layoutFor = (width: number): ShellLayout => (width >= SIDEBAR_MIN_WIDTH ? "sidebar" : "tabs");
