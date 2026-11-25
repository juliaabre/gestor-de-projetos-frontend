# orbit — frontend de gestão

Base inicial da plataforma de gestão de projetos e equipes da APS.

## Tecnologias

React, TypeScript, Vite, Tailwind CSS, React Router, Axios, React Hook Form, Zod, Lucide React e Vitest.

## Executar

Pré-requisitos: Node.js 20.11+ e pnpm.

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Testes: `pnpm test` · Build: `pnpm build` · Preview: `pnpm preview`

### Modo simulação (sem backend)

```bash
pnpm dev:mock
```

Sobe o frontend com um backend falso em memória (`src/mocks`) que implementa todas as rotas descritas abaixo, inclusive IA e administração, com dados de exemplo. Um botão **Simulação** no canto da tela permite entrar como qualquer usuário de demonstração (senha `123456`: `ana@demo.com` é administradora e gerente, `bruno@demo.com` gerente, `carla`, `diego` e `elisa@demo.com` membros), alternar o estado da IA (funcionando, só alocação simples ou fora do ar) e restaurar os dados. As alterações ficam salvas na aba do navegador (sessionStorage). O código da simulação só é carregado nesse modo e não entra no build de produção.

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
| Colunas      | `/api/projetos/{id}/colunas`, `PUT /api/projetos/{id}/colunas/{colunaId}`                                      |
| Competências | `/api/usuarios/{id}/competencias`, `PUT`/`DELETE /api/usuarios/{id}/competencias/{competenciaId}`              |
| Comentários  | `GET`/`POST /api/tarefas/{id}/comentarios`                                                                     |
| Anexos       | `GET`/`POST` (multipart, campo `arquivo`) `/api/tarefas/{id}/anexos`, `GET .../anexos/{anexoId}/download`      |
| Histórico    | `GET /api/tarefas/{id}/historico`                                                                              |
| IA           | `/api/ia/recomendar-responsaveis` (+ `/decisao`), `/api/ia/consultar`, `/historico`, `/resumo`, `/gargalos`, `/gerar-descricao`, `/sugerir-dependencias` |
| Admin        | `/api/admin/documentos`, `/api/admin/regras-dominio`, `/api/admin/vocabulario` (somente Administrador)         |

### Fluxo de autenticação

1. Login/cadastro devolvem o JWT (texto puro; `{ token }` também é aceito), com os papéis no claim `roles`.
2. O e-mail é lido do `sub` do JWT e o perfil (`id`, `username`) é buscado em `GET /api/usuarios`, já que não existe endpoint `/me`.
3. O token fica em `sessionStorage` e é enviado em `Authorization: Bearer` pelo interceptor do Axios. Na carga da página a sessão é restaurada se o token não tiver expirado; uma resposta 401 encerra a sessão.

Erros da API seguem o formato `{ status, erro, mensagem, erros? }`; `src/lib/apiError.ts` os converte em mensagens para a interface. Permissões no frontend são apenas controle visual; a autorização real é do backend.

### Projetos (`/projects`)

- Lista os projetos que a API devolve para o usuário, em abas **Ativos** e **Arquivados**, com nome, descrição, equipe e papel do usuário no projeto. Há estados de carregamento, lista vazia e erro.
- Qualquer usuário autenticado cria projetos e se torna o gerente deles. Editar, definir a equipe e arquivar só aparecem quando o projeto tem `canManage: true`, calculado pelo backend (criador, gerente membro da equipe ou administrador).
- Arquivar pede confirmação e a interface aplica o projeto devolvido pelo backend. Projetos arquivados não podem ser editados até serem desarquivados.

### Quadro do projeto (`/projects/:id`)

- Aba **Quadro**: colunas Kanban com cartões (título, prioridade, complexidade, tecnologias, responsável, prazo e dependências pendentes). As tarefas são movidas arrastando o cartão ou, de forma acessível e em telas pequenas, pelo seletor **Mover para** de cada cartão. A mudança é aplicada na hora e enviada à API (`PUT /api/tarefas/{id}` com a tarefa completa); se a API recusar, a tarefa volta para a coluna original e o erro é exibido.
- Criação, edição e exclusão (com confirmação) de tarefas atualizam o quadro sem recarregar a página. Em caso de erro, o formulário continua aberto com os dados preenchidos.
- Detalhes da tarefa: descrição, requisitos, tecnologias, dependências (de quem depende e quem bloqueia), comentários, anexos (até 10 MB, extensões permitidas validadas no cliente) e histórico.
- Aba **Equipe** (`?aba=equipe`): integrantes e competências (tecnologias, tipo de atividade e nível). Cada usuário mantém as próprias competências; administradores podem manter as de qualquer integrante.
- Permissões visuais: integrantes da equipe criam, editam e movem tarefas; excluir tarefas e gerenciar colunas exige `canManage`. Projetos arquivados ficam somente leitura.

Campos de tarefa além dos existentes no backend atual — `requisitos`, `tecnologias` (lista), `complexidade` (`BAIXA`/`MEDIA`/`ALTA`), `prazo` (`YYYY-MM-DD`), `responsavelId` e `dependenciasIds` — são enviados no mesmo `TarefaRequestDTO` e lidos do `TarefaResponseDTO` quando presentes. Competências usam `{ tecnologias: string[], tipoAtividade, nivelExperiencia }`; colunas, `{ id, nome, status, ordem }`, em que `status` é o valor do enum para colunas padrão ou uma chave própria (ex.: `EM_REVISAO`) para colunas personalizadas. Comentários: `{ id, conteudo, autor: { id, username }, createdAt }`; anexos: `{ id, nomeArquivo, tipoConteudo, tamanho, autor, createdAt }`; histórico: `{ id, campo, valorAnterior, valorNovo, descricao, autor, createdAt }`.

Enquanto o backend não oferecer colunas, competências, comentários, anexos ou histórico, respostas 404/405/501 dessas rotas são tratadas como recurso indisponível: o quadro usa as colunas padrão e cada seção exibe um aviso em vez de erro.

### Funcionalidades de IA (aba **Assistente IA** e quadro)

Toda saída da IA é tratada como sugestão: nada é aplicado sem uma ação explícita do usuário, e se a API falhar nenhuma resposta é gerada localmente.

- **Recomendação de responsáveis** — tarefas sem responsável exibem **Sugerir** para quem gerencia o projeto. O ranking mostra percentual de adequação, justificativa, competências, carga atual e fontes. O gerente aceita (atribui o primeiro), ajusta (escolhe outro) ou recusa (com motivo opcional); a atribuição usa `PUT /api/tarefas/{id}` e a decisão é registrada em `POST /api/ia/recomendar-responsaveis/decisao` `{ tarefaId, recomendacaoId, decisao: ACEITA|AJUSTADA|RECUSADA, usuarioRecomendadoId, usuarioEscolhidoId, motivo }`.
  - `GET /api/ia/recomendar-responsaveis?tarefaId=` → `{ recomendacaoId, modo, recomendacoes: [{ usuarioId, username, adequacao (0–1 ou 0–100), justificativa, competencias, cargaAtual, fontes }] }` (um array simples também é aceito). `modo: "PONTUACAO_SIMPLES"` indica a alocação alternativa sem LLM (RNF05), sinalizada na tela.
- **Assistente** — `GET /api/ia/consultar?query=&projetoId=` → `{ resposta, fontes: [{ tipo: TAREFA|DOCUMENTO|PROJETO, id, titulo, trecho }], gargalos }`. O envio é travado enquanto houver requisição em andamento. O histórico vem de `GET /api/ia/historico?projetoId=` quando existir; caso contrário a conversa vale só para a sessão.
- **Resumo e gargalos** — `GET /api/ia/resumo?projetoId=&escopo=PROJETO|SPRINT[&atualizar=true]` → `{ resumo, geradoEm, fontes }` e `GET /api/ia/gargalos?projetoId=` → `[{ tipo: TAREFA_PARADA|MEMBRO_SOBRECARREGADO|DEPENDENCIA_BLOQUEANTE, severidade, descricao, tarefas: [{id, titulo}], usuarios: [{id, username}] }]`. Lista vazia mostra "nenhum gargalo"; falha mostra erro — os dois casos são distintos.
- **Descrições** — no formulário de tarefa, `POST /api/ia/gerar-descricao` `{ projetoId, tarefaId, titulo, descricaoAtual, instrucao }` → `{ descricao, justificativa, fontes }`. A sugestão aparece numa área de revisão (aceitar, editar ou descartar) e só vai ao campo ao aceitar; nada é salvo até salvar a tarefa.
- **Dependências** — nos detalhes da tarefa, `GET /api/ia/sugerir-dependencias?tarefaId=` → `[{ tarefaId, titulo, justificativa, confianca }]`. As sugestões ficam separadas (borda tracejada) das confirmadas; sugestões que criariam ciclo ou já existem são descartadas, e só as selecionadas são registradas.
- **Indisponibilidade** — respostas 404/405/501/502/503/504 e tempo esgotado (60 s) são exibidos como "IA indisponível" apenas na seção afetada; quadro, formulários e atribuição manual continuam funcionando.

### Base de conhecimento (`/admin/conhecimento`, somente Administrador)

A rota é protegida por `AdminRoute` (usuários sem o papel `ADMINISTRADOR` vão para `/unauthorized`) e o link só aparece no menu para administradores.

- **Documentos** — upload multipart (`arquivo`, `projetoId` opcional para restringir o acesso) de PDF, Markdown ou texto até 20 MB. `GET /api/admin/documentos` → `[{ id, nomeArquivo, tamanho, status: PENDENTE|PROCESSANDO|PROCESSADO|ERRO, mensagemErro, quantidadeTrechos, projetoId, createdAt }]`; o status é consultado a cada 4 s enquanto houver documento em processamento.
- **Regras de domínio** — `{ id, regra, ativa }`, com criação, edição, ativação/desativação e exclusão.
- **Vocabulário** — `{ id, termo, definicao, sinonimos: string[] }`, com busca, criação, edição e exclusão.

## Estrutura

`src/app` rotas · `src/features/auth` autenticação e cadastro · `src/features/dashboard` área protegida · `src/features/projects` página, formulário e serviços de projetos · `src/features/projects/pages/ProjectBoardPage.tsx` quadro do projeto · `src/features/tasks` quadro Kanban, formulários e detalhes de tarefas · `src/features/skills` equipe e competências · `src/features/ai` recomendação, assistente, resumo, gargalos e sugestões da IA · `src/features/admin` base de conhecimento, regras e vocabulário · `src/features/users` serviços de usuários · `src/components` modal, diálogo de confirmação, estados de carregamento/vazio/erro, mensagens e campo de etiquetas · `src/lib` infraestrutura.
