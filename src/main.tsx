import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./shared/errors/ErrorBoundary";
import { installErrorReporting } from "./shared/errors/error-report";
import { applyTheme, readTheme } from "./shared/ui/theme";
import "./index.css";

installErrorReporting();
applyTheme(readTheme());

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root não encontrado no index.html");

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
