import { StrictMode, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "@/features/auth/hooks/AuthContext";
import { router } from "@/app/router";
import { api } from "@/lib/axios";
import "./styles.css";

async function start() {
  // `pnpm dev:mock`: troca a API real por um backend simulado em memória.
  // O bloco é removido do build de produção (import.meta.env.DEV é falso).
  let MockControls: ComponentType | null = null;
  if (import.meta.env.DEV && import.meta.env.MODE === "mock") {
    const mock = await import("./mocks");
    mock.installMockApi(api);
    MockControls = mock.MockControls;
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <AuthProvider>
        <RouterProvider router={router} />
        {MockControls && <MockControls />}
      </AuthProvider>
    </StrictMode>,
  );
}

void start();
