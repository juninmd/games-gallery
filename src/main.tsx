import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@juninmd/sonido/styles.css";
import "./styles/theme.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
