import type { PlayStatus } from "./types";

export const STATUS_ORDER: PlayStatus[] = ["playing", "backlog", "completed", "dropped", "wishlist"];

export const STATUS_LABEL: Record<PlayStatus, string> = {
  playing: "Jogando",
  backlog: "Quero jogar",
  completed: "Zerado",
  dropped: "Abandonado",
  wishlist: "Wishlist",
};

export const STATUS_COLOR: Record<PlayStatus, string> = {
  playing: "#46f0c1",
  backlog: "#a56bff",
  completed: "#5cc8ff",
  dropped: "#8e93a8",
  wishlist: "#ffc15e",
};
