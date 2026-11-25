import { configDefaults, defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.VITE_API_PROXY_TARGET || "http://localhost:8080";

  // Encaminha as chamadas da API (/api) para o backend Spring em desenvolvimento,
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
    resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
    server: {
      proxy: {
        "/api": backend,
      },
    },
    build: {
      // Versões mínimas suportadas (as mesmas exigidas pelo Tailwind CSS v4):
      // Chrome/Edge 111+, Firefox 128+ e Safari 16.4+ (desktop e mobile).
      target: ["chrome111", "edge111", "firefox128", "safari16.4"],
    },
    test: {
      globals: true,
      coverage: {
        provider: "v8",
        include: ["src/**/*.{ts,tsx}"],
        exclude: ["src/test/**", "src/mocks/**", "src/main.tsx", "src/**/*.d.ts"],
        reporter: ["text-summary", "html"],
        // Piso para evitar regressões; aumente conforme a cobertura crescer.
        thresholds: { statements: 70, branches: 65, functions: 60, lines: 70 },
      },
      projects: [
        {
          extends: true,
          test: {
            name: "unit",
            environment: "jsdom",
            setupFiles: "./src/test/setup.ts",
            include: ["src/**/*.test.{ts,tsx}"],
            exclude: [...configDefaults.exclude, "src/**/*.integration.test.ts"],
          },
        },
        {
          extends: true,
          test: {
            // Exige o backend rodando (BACKEND_URL, padrão http://localhost:8080).
            name: "integration",
            environment: "jsdom",
            include: ["src/**/*.integration.test.ts"],
            testTimeout: 20_000,
            fileParallelism: false,
          },
        },
      ],
    },
  };
});
