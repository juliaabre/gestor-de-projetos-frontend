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

Em desenvolvimento, deixe `VITE_API_BASE_URL` vazio: o Vite encaminha `/api` para `VITE_API_PROXY_TARGET` (padrão `http://localhost:8080`), evitando CORS. Em produção, `VITE_API_BASE_URL` deve ser a raiz do backend, **sem** `/api` no final.

## Integração com o backend

Contrato alinhado com `gestor-de-projetos-com-retrieval-augmented-generation`. Todas as rotas ficam em `src/lib/endpoints.ts`:

| Recurso      | Rotas                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| Autenticação | `POST /api/v1/auth/login` `{ email, password }` · `POST /api/v1/auth/register` `{ username, email, password }` |
| Usuários     | `/api/usuarios`                                                                                                |
| Projetos     | `/api/projetos`, `PATCH /api/projetos/{id}/arquivar` e `/desarquivar`                                          |
| Tarefas      | `/api/tarefas`, `/api/tarefas/projeto/{projetoId}`                                                             |

### Fluxo de autenticação

1. Login/cadastro devolvem o JWT (texto puro; `{ token }` também é aceito), com os papéis no claim `roles`.
2. O e-mail é lido do `sub` do JWT e o perfil (`id`, `username`) é buscado em `GET /api/usuarios`, já que não existe endpoint `/me`.
3. O token fica em `sessionStorage` e é enviado em `Authorization: Bearer` pelo interceptor do Axios. Na carga da página a sessão é restaurada se o token não tiver expirado; uma resposta 401 encerra a sessão.

Erros da API seguem o formato `{ status, erro, mensagem, erros? }`; `src/lib/apiError.ts` os converte em mensagens para a interface. Permissões no frontend são apenas controle visual; a autorização real é do backend.

### Projetos (`/projects`)

- Lista os projetos que a API devolve para o usuário, em abas **Ativos** e **Arquivados**, com nome, descrição, equipe e papel do usuário no projeto. Há estados de carregamento, lista vazia e erro.
- Qualquer usuário autenticado cria projetos e se torna o gerente deles. Editar, definir a equipe e arquivar só aparecem quando o projeto tem `canManage: true`, calculado pelo backend (criador, gerente membro da equipe ou administrador).
- Arquivar pede confirmação e a interface aplica o projeto devolvido pelo backend. Projetos arquivados não podem ser editados até serem desarquivados.

## Estrutura

`src/app` rotas · `src/features/auth` autenticação e cadastro · `src/features/dashboard` área protegida · `src/features/projects` página, formulário e serviços de projetos · `src/features/tasks`, `users` tipos e serviços da API · `src/components` modal e diálogo de confirmação · `src/lib` infraestrutura.
