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
  playing: "#22d3a6",
  backlog: "#7c5cff",
  completed: "#4c8dff",
  dropped: "#8a92a6",
  wishlist: "#f5a524",
};
