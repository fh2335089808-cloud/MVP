import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ErrorBoundary } from "react-error-boundary";
import { AppContainer, ErrorRender } from "@lark-apaas/client-toolkit-lite";
import { Toaster } from "@/components/ui/sonner";
import App from "./app";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={process.env.CLIENT_BASE_PATH || "/"}>
      <AppContainer>
        <ErrorBoundary
          fallbackRender={({ error, resetErrorBoundary }) => (
            <ErrorRender error={error} resetErrorBoundary={resetErrorBoundary} />
          )}
        >
          <App />
          <Toaster richColors closeButton />
        </ErrorBoundary>
      </AppContainer>
    </BrowserRouter>
  </StrictMode>,
);
