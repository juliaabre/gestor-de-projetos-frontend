# orbit — frontend de gestão

Base inicial da plataforma de gestão de projetos e equipes da APS.

## Tecnologias

React, TypeScript, Vite, Tailwind CSS, React Router, Axios, React Hook Form, Zod, Lucide React e Vitest.

## Executar

Pré-requisitos: Node.js 20.19+ ou 22.12+ (exigência do Vite 8/Vitest 5) e pnpm.

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Testes: `pnpm test` (detalhes em [Testes](#testes)) · Build: `pnpm build` · Preview: `pnpm preview`

### Modo simulação (sem backend)

```bash
pnpm dev:mock
```

Sobe o frontend com um backend falso em memória (`src/mocks`) que segue o mesmo contrato do backend real (e a proposta de colunas personalizadas), inclusive IA e administração, com dados de exemplo. Um botão **Simulação** no canto da tela permite entrar como qualquer usuário de demonstração (senha `123456`: `ana@demo.com` é administradora e gerente do App de agendamentos, `bruno@demo.com` gerente do Sistema de biblioteca, `carla`, `diego` e `elisa@demo.com` membros), alternar o estado da IA (funcionando, sem síntese como o backend sem Gemini, ou fora do ar) e restaurar os dados. As alterações ficam salvas na aba do navegador (sessionStorage). O código da simulação só é carregado nesse modo e não entra no build de produção.

## Testes

A suíte usa **Vitest** + **Testing Library** (jsdom), com **axe-core** para auditoria automática de acessibilidade. Ela é dividida em dois projetos (configurados em `vite.config.ts`):

| Comando | O que executa |
| --- | --- |
| `pnpm test` | Testes unitários e de componentes/telas, com a API simulada por mocks. Não precisa de backend. |
| `pnpm test:watch` | O mesmo, reexecutando a cada alteração. |
| `pnpm test:coverage` | Testes unitários com relatório de cobertura (resumo no terminal e HTML em `coverage/`). Falha se a cobertura cair abaixo do mínimo configurado. |
| `pnpm test:integration` | Testes de integração contra o **backend real**: usa os mesmos serviços e mapeadores das telas. |

Para rodar só um arquivo ou um teste: `pnpm test src/test/authFlow.test.tsx` ou `pnpm test -t "Esc fecha"`.

**Integração com o backend.** Suba o backend (de preferência com um banco de desenvolvimento ou testes, pois os testes criam usuários, projetos e tarefas e removem o que criaram) e rode:

```bash
BACKEND_URL=http://localhost:8080 \
BACKEND_ADMIN_EMAIL=admin@exemplo.com BACKEND_ADMIN_PASSWORD=senha \
pnpm test:integration
```

`BACKEND_URL` é opcional (padrão `http://localhost:8080`). As variáveis de administrador são as mesmas `ADMIN_EMAIL`/`ADMIN_PASSWORD` usadas pelo `DataInitializer` do backend; sem elas os cenários do perfil Administrador são pulados.

O que cada arquivo em `src/test` cobre:

- `validation.test.ts`: validações dos formulários (login, cadastro, projeto, tarefa, competência) e funções de formatação.
- `components.test.tsx`: componentes compartilhados (estados de carregamento/erro/vazio, mensagens, modal com foco preso e Esc, abas pelo teclado, campo de etiquetas).
- `mappers.test.ts`, `aiMappers.test.ts`, `authService.test.ts`: conversão entre o JSON do backend e o modelo do frontend.
- `authFlow.test.tsx`, `LoginPage.test.tsx`, `RegisterPage.test.tsx`: login e cadastro (sucesso, credenciais inválidas, servidor fora do ar).
- `ProjectsPage.test.tsx`, `ProjectBoardPage.test.tsx`: projetos, quadro, tarefas, detalhes e equipe.
- `aiFeatures.test.tsx`, `adminKnowledge.test.tsx`: recomendação de responsáveis, assistente, resumo, descrição, dependências e base de conhecimento.
- `permissions.test.tsx`: permissões por perfil (Administrador, Gerente, Membro e usuário fora da equipe).
- `apiFailures.test.tsx`: falhas da API (mensagens por código HTTP, rede fora do ar, sessão expirada, IA indisponível, erro inesperado em tela).
- `a11y.test.tsx`: auditoria axe das telas principais e uso por teclado.
- `integration/backend.integration.test.ts`: integração com o backend real.

## Navegadores suportados

Chrome e Edge 111+, Firefox 128+ e Safari 16.4+, em desktop e mobile (mínimos do Tailwind CSS v4; definidos em `build.target`). As telas principais foram validadas em Chrome e Firefox nos tamanhos de celular (375 px), tablet (768 px) e desktop (1366 px).

## Responsividade, acessibilidade e desempenho

- **Telas pequenas:** no quadro, as colunas ficam lado a lado com rolagem horizontal e um seletor "Ir para a coluna" leva direto a cada uma. "Mover para" em cada cartão substitui o arrastar e soltar no toque e no teclado.
- **Teclado e leitores de tela:** atalho "Pular para o conteúdo", foco sempre visível, diálogos que prendem o foco e o devolvem ao fechar, abas navegáveis pelas setas, título da página por tela, rótulos em todos os campos e botões e anúncio de carregamento, erros e sucesso (`role="status"`/`role="alert"`). Respeita "reduzir movimento" do sistema.
- **Contraste:** texto secundário em `slate-500` ou mais escuro (≥ 4,5:1 sobre branco).
- **Desempenho:** as telas de projetos, quadro e base de conhecimento são carregadas sob demanda. Medição no build de produção com o backend local: login, início, projetos e quadro abrem em menos de 1 s; com rede 4G e CPU 4x mais lenta, o quadro abre em cerca de 1 s (meta: até 2 s).
- **Falhas:** toda requisição mostra carregamento e erro; recursos ainda inexistentes no backend (404) mostram aviso de indisponibilidade; sessão expirada volta ao login; um erro inesperado em uma tela mostra uma tela de recuperação em vez de quebrar a aplicação.

## Configuração

Em desenvolvimento, deixe `VITE_API_BASE_URL` vazio: o Vite encaminha `/api` para `VITE_API_PROXY_TARGET` (padrão `http://localhost:8080`), evitando CORS. Em produção, `VITE_API_BASE_URL` deve ser a raiz do backend, **sem** `/api` no final.

## Integração com o backend

Contrato alinhado com a branch `feat/gerencia-por-projeto` de `gestor-de-projetos-com-retrieval-augmented-generation` (referência completa em `src/docs/MANUAL_API.md` daquele repositório). Todas as rotas ficam em `src/lib/endpoints.ts`, e `src/test/backendSamples.ts` guarda respostas reais do backend usadas como teste de contrato.

| Recurso | Rotas |
| --- | --- |
| Autenticação | `POST /api/v1/auth/login` · `POST /api/v1/auth/register` (JWT em texto puro, papéis no claim `roles`) |
| Usuários | `GET /api/usuarios` (só gerentes de projeto e administradores) |
| Projetos | `/api/projetos`, `PATCH .../arquivar` e `/desarquivar`; `gerenteId` no `PUT` transfere a gerência |
| Tarefas | `/api/tarefas`, `/api/tarefas/projeto/{projetoId}`, `PATCH /api/tarefas/{id}/status?novoStatus=` |
| Dependências | `GET /api/tarefas/{id}/dependencias`, `PUT`/`DELETE .../dependencias/{prerequisitoId}` |
| Comentários | `GET`/`POST /api/tarefas/{id}/comentarios` `{ texto }` |
| Anexos | `GET`/`POST` (multipart `arquivo`, até 5 MB) `/api/tarefas/{id}/anexos`, `GET`/`DELETE .../anexos/{anexoId}` |
| Histórico | `GET /api/tarefas/{id}/historico` → `{ acao, atorId, responsavelId, status, criadoEm }` |
| Competências | `GET`/`PUT /api/usuarios/{id}/competencias` (lista completa de `{ tecnologia, tipoAtividade, nivel 1–5 }`; só o titular ou administrador) |
| IA | `POST /api/ia/consultar?projetoId=` `{ pergunta }` · `GET /api/ia/projetos/{id}/resumo?inicio=&fim=` · `GET .../gargalos` · `POST /api/ia/tarefas/{id}/descricao` · `GET .../dependencias` · `POST`/`GET .../recomendacoes` · `POST .../recomendacoes/{id}/feedback` |
| Documentos | `GET /api/projetos/{id}/documentos` (e `/{docId}/trechos`) · `POST`/`DELETE /api/admin/projetos/{id}/documentos` |
| Domínio | `GET`/`POST /api/admin/regras-dominio` `{ regras, vocabulario }` |

### Perfis e permissões

Os papéis globais são **Membro** e **Administrador**; o **gerente** é definido por projeto (o criador, ou quem recebeu a gerência). O frontend só usa as permissões para mostrar ou esconder ações; quem decide é o backend (`podeGerenciar`).

| Ação | Quem |
| --- | --- |
| Ver o projeto, mover tarefas (status), comentar, anexar, usar o assistente | Integrante da equipe |
| Criar, editar e excluir tarefas, dependências, anexos; equipe e gerência; recomendação, resumo, gargalos, descrição e dependências com IA | Gerente do projeto |
| Competências de qualquer usuário, base de conhecimento e regras de domínio | Administrador (documentos exigem integrar a equipe de um projeto ativo) |

### Fluxo de autenticação

1. Login/cadastro devolvem o JWT. O e-mail vem do `sub` e os papéis do claim `roles`.
2. Como não existe `/me` e o diretório de usuários é restrito, o `id` do usuário é obtido na equipe dos projetos dele (`GET /api/projetos`) e, se preciso, em `GET /api/usuarios`.
3. O token fica em `sessionStorage` e vai em `Authorization: Bearer`. Uma resposta 401 encerra a sessão.

Erros seguem `{ status, erro, mensagem, erros? }`; `src/lib/apiError.ts` os converte em mensagens.

### Quadro, tarefas e equipe

- Colunas padrão por status (A fazer, Em andamento, Concluído, Cancelado). Mover usa `PATCH /status`, com atualização otimista e retorno à coluna original se falhar.
- Complexidade de 1 a 5. Dependências são lidas por tarefa e gravadas pela diferença (`PUT`/`DELETE`) depois de salvar a tarefa.
- Se o servidor não devolver algum campo enviado, a tela avisa quais não foram gravados.
- Comentários, anexos e histórico mostram o nome do autor a partir da equipe (o backend envia só o id).
- Na aba **Equipe**, cada integrante vê as próprias competências (o administrador vê todas); as dos demais aparecem como privadas, como o backend exige.

**Colunas personalizadas** estão prontas no frontend (criar, renomear, reordenar e excluir movendo as tarefas), mas dependem de o backend ligar coluna e tarefa: hoje os quadros (`/quadros`) guardam só nomes e a tarefa tem status fixo. Por isso ficam desligadas por padrão (o botão **Nova coluna** explica o motivo) e ligadas na simulação e nos testes; defina `VITE_CUSTOM_COLUMNS=true` quando o backend oferecer as rotas propostas em `endpoints.projects.columns`.

### IA (aba **Assistente IA** e quadro)

Toda saída da IA é sugestão: nada é aplicado sem ação explícita, e nenhuma resposta é inventada localmente se a API falhar.

- As respostas seguem `{ resposta, fontes, alternativa, aviso }`. Sem o provedor (Gemini) configurado, o backend devolve uma resposta **alternativa** extrativa; a tela mostra o aviso do servidor e as fontes citadas.
- **Recomendação** — o gerente aceita (o backend atribui o primeiro do ranking), ajusta (atribui o escolhido) ou recusa (com observação). Sem IA, a atribuição manual edita a tarefa.
- **Assistente** — disponível a todos os integrantes; a conversa fica salva só na aba do navegador, pois o backend não guarda histórico.
- **Resumo e gargalos** — só para o gerente; o resumo aceita período (as duas datas juntas).
- **Descrição** — gerada para tarefas já salvas, com revisão (aceitar, editar ou descartar).
- **Dependências** — as tarefas citadas pela IA aparecem para seleção antes de registrar.
- 404/405/501/502/503/504 e tempo esgotado (60 s) aparecem como "IA indisponível" só na seção afetada.

### Base de conhecimento (`/admin/conhecimento`, somente Administrador)

- **Documentos** — por projeto ativo do qual o administrador participa; PDF com texto, Markdown ou texto até 5 MB. A indexação ocorre na própria requisição e a lista mostra os trechos indexados. Erros do servidor (413, 415, 422, 503 com o provedor desligado) aparecem com a mensagem dele.
- **Regras e vocabulário** — dois textos de até 4000 caracteres (as regras são obrigatórias).

## Estrutura

`src/app` rotas · `src/features/auth` autenticação e cadastro · `src/features/dashboard` área protegida · `src/features/projects` página, formulário e serviços de projetos · `src/features/projects/pages/ProjectBoardPage.tsx` quadro do projeto · `src/features/tasks` quadro Kanban, formulários e detalhes de tarefas · `src/features/skills` equipe e competências · `src/features/ai` recomendação, assistente, resumo, gargalos e sugestões da IA · `src/features/admin` base de conhecimento, regras e vocabulário · `src/features/users` serviços de usuários · `src/components` modal, diálogo de confirmação, estados de carregamento/vazio/erro, mensagens e campo de etiquetas · `src/lib` infraestrutura · `src/test` testes (ver [Testes](#testes)) · `src/mocks` backend simulado do `pnpm dev:mock`.
