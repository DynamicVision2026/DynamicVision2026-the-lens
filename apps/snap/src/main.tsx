import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "../theme/tokens.css";
import "./styles.css";
import { App } from "./App";
import { initLayout } from "./lib/layout";
import { initPwa } from "./lib/pwa";

initPwa();
initLayout(); // phone / tablet / wide on <html> before the first paint (rotation handled live)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
