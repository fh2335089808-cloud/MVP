import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ErrorBoundary } from "react-error-boundary";
import App from "./app";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={process.env.CLIENT_BASE_PATH || "/"}>
      <ErrorBoundary
        fallbackRender={({ resetErrorBoundary }) => (
          <main className="flex min-h-screen items-center justify-center bg-[#FAF8F3] px-4">
            <div className="max-w-md rounded-xl border border-[#D4D8CD] bg-white p-8 text-center shadow-sm">
              <h1 className="text-xl font-medium text-[#171611]">页面暂时无法显示</h1>
              <p className="mt-3 text-sm leading-relaxed text-[#6B7280]">
                请刷新页面后重试。若您刚刚提交过登记，请先联系工作人员确认，避免重复提交。
              </p>
              <button
                type="button"
                onClick={resetErrorBoundary}
                className="mt-6 rounded-md bg-[#4A5D42] px-5 py-2.5 text-sm font-medium text-white"
              >
                重新加载页面
              </button>
            </div>
          </main>
        )}
      >
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
);
