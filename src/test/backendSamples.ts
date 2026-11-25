/**
 * Respostas reais do backend (branch `feat/gerencia-por-projeto`), capturadas
 * com o servidor rodando. Servem de teste de contrato para os mapeadores: se o
 * formato do backend mudar, atualize estas amostras e os testes apontam onde
 * o frontend precisa acompanhar.
 */
export const projectAsManager = {
  id: 1, nome: "Aurora", descricao: "demo", arquivado: false, criadorId: 2, gerenteId: 2,
  equipe: [{ id: 2, username: "gerente", email: "g@x.dev" }], equipeIds: [2], tarefasIds: [],
  createdAt: "2026-11-25T21:50:12.432+00:00", meuPapelNoProjeto: "ROLE_GERENTE" as const,
  podeGerenciar: true, podeAdicionarMembros: true,
};

export const projectAsMember = {
  ...projectAsManager,
  equipe: [
    { id: 1, username: "admin", email: "admin@gestor.dev" },
    { id: 2, username: "gerente", email: "g@x.dev" },
    { id: 3, username: "membro", email: "m@x.dev" },
  ],
  equipeIds: [1, 2, 3], meuPapelNoProjeto: "ROLE_MEMBRO" as const, podeGerenciar: false, podeAdicionarMembros: false,
};

export const task = {
  id: 1, titulo: "API login", conteudo: null, status: "PENDENTE", prioridade: "ALTA" as const, projetoId: 1,
  createdAt: "2026-11-25T21:50:12.877+00:00", updatedAt: "2026-11-25T21:50:12.877+00:00",
  requisitos: "r", tecnologias: ["Java", "JWT"], complexidade: 4, prazo: "2026-12-01", responsavelId: null,
};

export const comment = { id: 1, autorId: 3, texto: "Olá", criadoEm: "2026-11-25T21:50:13.373277527Z" };
export const attachment = { id: 1, autorId: 3, nome: "a.txt", tamanho: 8, criadoEm: "2026-11-25T21:50:13.462422846Z" };
export const history = [
  { id: 1, acao: "CRIACAO", atorId: 2, responsavelId: null, status: "PENDENTE", criadoEm: "2026-11-25T21:50:12.886444Z" },
  { id: 3, acao: "STATUS", atorId: 3, responsavelId: null, status: "EM_ANDAMENTO", criadoEm: "2026-11-25T21:50:13.104774Z" },
];
export const prerequisites = [{ id: 1, titulo: "API login" }];
export const skills = [{ tecnologia: "Java", tipoAtividade: "BACKEND", nivel: 4 }];

export const fallbackAnswer = {
  resposta: "Síntese automática indisponível. Dados recuperados (sem interpretação do modelo):\n[P1] Total de tarefas: 2.",
  fontes: [
    { id: "P1", tipo: "PROJETO", recursoId: 1, titulo: "Aurora", pagina: null, trecho: "Total de tarefas: 2.", similaridade: 1.0 },
    { id: "T2", tipo: "TAREFA", recursoId: 2, titulo: "Tela login", pagina: null, trecho: "Tarefa 2: Tela login.", similaridade: 1.0 },
    { id: "G1", tipo: "INDICADORES", recursoId: 1, titulo: "Indicadores de gargalo", pagina: null, trecho: "Atrasadas: 0.", similaridade: 1.0 },
  ],
  alternativa: true,
  aviso: "Resposta extrativa; confirme os dados nas fontes. Nenhuma decisão foi aplicada.",
};

export const recommendation = {
  id: 1, tarefaId: 1,
  ranking: [
    { usuarioId: 2, pontuacao: 25.0, justificativa: "Aderência tecnológica: 0%.", fontes: ["T1", "P1"] },
    { usuarioId: 3, pontuacao: 33.0, justificativa: "Aderência tecnológica: 40%.", fontes: ["T1", "P1"] },
  ],
  contexto: {
    resposta: "Síntese automática indisponível.",
    fontes: [
      { id: "T1", tipo: "TAREFA", recursoId: 1, titulo: "API login", pagina: null, trecho: "Tarefa 1", similaridade: 1.0 },
      { id: "P1", tipo: "PROJETO", recursoId: 1, titulo: "Aurora", pagina: null, trecho: "Projeto", similaridade: 1.0 },
    ],
    alternativa: true,
    aviso: "Resposta extrativa; confirme os dados nas fontes. Nenhuma decisão foi aplicada.",
  },
  decisao: null, escolhidoId: null,
};

export const domain = { regras: "Gestão de projetos e tarefas.", vocabulario: "" };
export const documentItem = { id: 7, nome: "regras.md", tipo: "MARKDOWN", trechos: 3, criadoEm: "2026-11-25T21:50:14Z" };
