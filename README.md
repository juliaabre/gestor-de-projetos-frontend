# orbit — frontend de gestão

Base inicial da plataforma de gestão de projetos e equipes da APS.

## Tecnologias
React, TypeScript, Vite, Tailwind CSS, React Router, Axios, React Hook Form, Zod, Lucide React e Vitest.

## Executar
Pré-requisitos: Node.js 20+ e pnpm.

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Testes: `pnpm test` · Build: `pnpm build` · Preview: `pnpm preview`

## Configuração
`VITE_API_BASE_URL` define a URL base, por padrão `http://localhost:8080/api`.

## Fluxo de autenticação
`LoginPage` valida os campos com Zod, chama `authService.login`, que usa o cliente Axios centralizado, e atualiza o `AuthContext`. Rotas protegidas usam `ProtectedRoute`; o logout limpa o estado em memória e redireciona na próxima navegação.

A implementação usa `withCredentials: true`, priorizando cookie HttpOnly, Secure e SameSite configurado pelo backend. Não há armazenamento de JWT em localStorage. Se o backend devolver token no corpo, o contrato deve ser alinhado antes de escolher uma estratégia segura de sessão.

## Contrato provisório
`POST /auth/login` recebe `{ email, password }` e espera `{ token?, user: { id, name, email, role } }`. Os campos e o endpoint estão isolados em `src/features/auth/services/authService.ts`.

O backend precisa confirmar CORS com credenciais, política de cookies/CSRF, formato de erros, validação da sessão e eventual endpoint de logout. A autorização real deve continuar no servidor; permissões no frontend são apenas controle visual.

## Estrutura
`src/app` rotas · `src/features/auth` autenticação · `src/features/dashboard` área protegida · `src/components` componentes compartilhados futuros · `src/lib` infraestrutura.
