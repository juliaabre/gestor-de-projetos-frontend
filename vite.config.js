import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var env = loadEnv(mode, process.cwd(), "");
    var target = env.VITE_API_PROXY_TARGET || "http://localhost:8080";
    // Encaminha as chamadas da API para o backend Spring em desenvolvimento,
    // evitando CORS. Navegações do navegador (Accept: text/html) não são
    // encaminhadas, para não conflitar com rotas do próprio frontend.
    var backend = {
        target: target,
        changeOrigin: true,
        bypass: function (req) { var _a; return ((_a = req.headers.accept) === null || _a === void 0 ? void 0 : _a.includes("text/html")) ? req.url : undefined; },
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
