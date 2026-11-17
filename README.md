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

Em desenvolvimento, deixe `VITE_API_BASE_URL` vazio: o Vite encaminha `/api` e `/projetos` para `VITE_API_PROXY_TARGET` (padrão `http://localhost:8080`), evitando CORS. Em produção, `VITE_API_BASE_URL` deve ser a raiz do backend, **sem** `/api` no final.

## Integração com o backend

Contrato alinhado com `gestor-de-projetos-com-retrieval-augmented-generation`. Todas as rotas ficam em `src/lib/endpoints.ts`:

| Recurso      | Rotas                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| Autenticação | `POST /api/v1/auth/login` `{ email, password }` · `POST /api/v1/auth/register` `{ username, email, password }` |
| Usuários     | `/api/usuarios`                                                                                                |
| Projetos     | `/projetos` (sem `/api`)                                                                                       |
| Tarefas      | `/api/tarefas`, `/api/tarefas/projeto/{projetoId}`                                                             |

### Fluxo de autenticação

1. Login/cadastro devolvem o JWT (hoje como texto puro; `{ token }` também é aceito).
2. O e-mail é lido do `sub` do JWT e o perfil (`id`, `username`) é buscado em `GET /api/usuarios`, já que não existe endpoint `/me`.
3. O token fica em `sessionStorage` e é enviado em `Authorization: Bearer` pelo interceptor do Axios. Na carga da página a sessão é restaurada se o token não tiver expirado; uma resposta 401 encerra a sessão.

Login com credenciais inválidas retorna **403** (o Spring Security não tem `AuthenticationEntryPoint`), e a tela trata 401 e 403 como credenciais inválidas.

Papéis (`ADMINISTRADOR`, `GERENTE`, `MEMBRO`) ainda não são expostos pelo backend, então `user.roles` fica vazio. Se o backend passar a incluir `roles`/`authorities` no JWT, eles são lidos automaticamente. Permissões no frontend são apenas controle visual.

## Estrutura

`src/app` rotas · `src/features/auth` autenticação e cadastro · `src/features/dashboard` área protegida · `src/features/projetos`, `tarefas`, `usuarios` tipos e serviços da API · `src/components` componentes compartilhados futuros · `src/lib` infraestrutura.
