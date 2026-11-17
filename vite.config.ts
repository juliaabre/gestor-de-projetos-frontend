import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.VITE_API_PROXY_TARGET || "http://localhost:8080";

  // Encaminha as chamadas da API para o backend Spring em desenvolvimento,
  // evitando CORS. Navegações do navegador (Accept: text/html) não são
  // encaminhadas, para não conflitar com rotas do próprio frontend.
  const backend = {
    target,
    changeOrigin: true,
    bypass: (req: { headers: { accept?: string }; url?: string }) =>
      req.headers.accept?.includes("text/html") ? req.url : undefined,
  };

  return {
    plugins: [react()],
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
    server: {
      proxy: {
        "/api": backend,
        "/projetos": backend,
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
      globals: true,
    },
  };
});
