/**
 * Banco em memória do modo de simulação (`pnpm dev:mock`). Segue o formato
 * JSON do backend (branch `feat/gerencia-por-projeto`) para exercitar os
 * mesmos mapeadores da aplicação real. Fica salvo no sessionStorage até
 * "Restaurar dados".
 */

/** Papéis globais: o gerente é definido por projeto (`gerenteId`). */
export type RoleName = "ADMINISTRADOR" | "MEMBRO";

export interface MockUser {
  id: number;
  username: string;
  email: string;
  roles: RoleName[];
}

export interface MockProject {
  id: number;
  nome: string;
  descricao: string | null;
  arquivado: boolean;
  criadorId: number;
  gerenteId: number;
  equipeIds: number[];
  createdAt: string;
}

export interface MockTask {
  id: number;
  titulo: string;
  conteudo: string | null;
  requisitos: string | null;
  tecnologias: string[];
  status: string;
  prioridade: string;
  complexidade: number | null;
  prazo: string | null;
  responsavelId: number | null;
  /** Interno da simulação; exposto em `/api/tarefas/{id}/dependencias`. */
  dependenciasIds: number[];
  projetoId: number;
  /** Coluna do quadro em que a tarefa está (`null`: posicionada só pelo status). */
  colunaId: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Quadro do projeto, como em `/api/projetos/{id}/quadros`. */
export interface MockBoard {
  id: number;
  projetoId: number;
  nome: string;
  colunas: { id: number; nome: string; posicao: number; status: string | null }[];
}

export interface MockSkill {
  usuarioId: number;
  tecnologia: string;
  tipoAtividade: string;
  nivel: number;
}

export interface MockComment {
  id: number;
  tarefaId: number;
  texto: string;
  autorId: number;
  criadoEm: string;
}

export interface MockAttachment {
  id: number;
  tarefaId: number;
  nome: string;
  tamanho: number;
  autorId: number;
  criadoEm: string;
}

export interface MockHistory {
  id: number;
  tarefaId: number;
  acao: string;
  atorId: number | null;
  responsavelId: number | null;
  status: string | null;
  criadoEm: string;
}

export interface MockDocument {
  id: number;
  projetoId: number;
  nome: string;
  tipo: string;
  trechos: string[];
  criadoEm: string;
}

export interface MockRecommendation {
  id: number;
  tarefaId: number;
  ranking: { usuarioId: number; pontuacao: number; justificativa: string; fontes: string[] }[];
  contexto: unknown;
  decisao: string | null;
  escolhidoId: number | null;
}

export interface MockDb {
  seq: number;
  users: MockUser[];
  projects: MockProject[];
  tasks: MockTask[];
  boards: MockBoard[];
  skills: MockSkill[];
  comments: MockComment[];
  attachments: MockAttachment[];
  history: MockHistory[];
  documents: MockDocument[];
  domain: { regras: string; vocabulario: string };
  recommendations: MockRecommendation[];
}

const STORAGE_KEY = "gestor.mock.db.v3";
export const DEMO_PASSWORD = "123456";

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const dateIn = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

function task(partial: Partial<MockTask> & Pick<MockTask, "id" | "titulo" | "projetoId">): MockTask {
  return {
    conteudo: null,
    requisitos: null,
    tecnologias: [],
    status: "PENDENTE",
    prioridade: "MEDIA",
    complexidade: 3,
    prazo: null,
    responsavelId: null,
    colunaId: null,
    dependenciasIds: [],
    createdAt: daysAgo(12),
    updatedAt: daysAgo(2),
    ...partial,
  };
}

const skills = (usuarioId: number, tipoAtividade: string, nivel: number, techs: string[]): MockSkill[] =>
  techs.map((tecnologia) => ({ usuarioId, tecnologia, tipoAtividade, nivel }));

export function seed(): MockDb {
  return {
    seq: 1000,
    users: [
      { id: 1, username: "ana.souza", email: "ana@demo.com", roles: ["ADMINISTRADOR", "MEMBRO"] },
      { id: 2, username: "bruno.lima", email: "bruno@demo.com", roles: ["MEMBRO"] },
      { id: 3, username: "carla.dias", email: "carla@demo.com", roles: ["MEMBRO"] },
      { id: 4, username: "diego.alves", email: "diego@demo.com", roles: ["MEMBRO"] },
      { id: 5, username: "elisa.melo", email: "elisa@demo.com", roles: ["MEMBRO"] },
    ],
    projects: [
      {
        id: 10,
        nome: "Sistema de biblioteca",
        descricao: "Catálogo de livros, empréstimos e autenticação de usuários.",
        arquivado: false,
        criadorId: 2,
        gerenteId: 2,
        equipeIds: [2, 1, 3, 4],
        createdAt: daysAgo(30),
      },
      {
        id: 11,
        nome: "App de agendamentos",
        descricao: "Aplicativo para agendar atendimentos em clínicas.",
        arquivado: false,
        criadorId: 1,
        gerenteId: 1,
        equipeIds: [1, 3, 5],
        createdAt: daysAgo(14),
      },
      {
        id: 12,
        nome: "Portal antigo",
        descricao: "Projeto encerrado, mantido para consulta.",
        arquivado: true,
        criadorId: 2,
        gerenteId: 2,
        equipeIds: [2, 4],
        createdAt: daysAgo(200),
      },
    ],
    boards: [
      {
        id: 1,
        projetoId: 10,
        nome: "Quadro",
        colunas: [
          { id: 1, nome: "A fazer", posicao: 0, status: "PENDENTE" },
          { id: 2, nome: "Em andamento", posicao: 1, status: "EM_ANDAMENTO" },
          { id: 3, nome: "Em revisão", posicao: 2, status: null },
          { id: 4, nome: "Concluído", posicao: 3, status: "CONCLUIDA" },
        ],
      },
    ],
    tasks: [
      task({
        id: 101, projetoId: 10, titulo: "Autenticação JWT",
        conteudo: "Implementar login, geração e validação de tokens e proteção das rotas da API.",
        requisitos: "- Expiração do token em 1h\n- Senhas com BCrypt\n- Rotas públicas apenas para login e cadastro",
        tecnologias: ["Spring Security", "JWT", "PostgreSQL"], prioridade: "ALTA", complexidade: 4,
        prazo: dateIn(5),
      }),
      task({
        id: 102, projetoId: 10, titulo: "Tela de cadastro de livros",
        conteudo: "Formulário com validação para cadastrar e editar livros do acervo.",
        tecnologias: ["React", "TypeScript"], prioridade: "MEDIA", complexidade: 3,
        responsavelId: 3, prazo: dateIn(8),
      }),
      task({
        id: 103, projetoId: 10, titulo: "Modelagem do banco",
        conteudo: "Definir entidades de livros, exemplares, usuários e empréstimos.",
        tecnologias: ["PostgreSQL"], prioridade: "ALTA", complexidade: 3,
        status: "EM_ANDAMENTO", responsavelId: 4, prazo: dateIn(-2), updatedAt: daysAgo(9),
      }),
      task({
        id: 104, projetoId: 10, titulo: "Endpoint de empréstimos",
        conteudo: "API REST para registrar empréstimos e devoluções.",
        tecnologias: ["Java", "Spring Boot"], prioridade: "MEDIA", complexidade: 4,
        status: "EM_ANDAMENTO", responsavelId: 4, dependenciasIds: [103],
      }),
      task({
        id: 105, projetoId: 10, titulo: "Relatório de empréstimos atrasados",
        tecnologias: ["Java", "PostgreSQL"], prioridade: "BAIXA", complexidade: 2,
        status: "PENDENTE", responsavelId: 4, dependenciasIds: [104, 103],
      }),
      task({
        id: 106, projetoId: 10, titulo: "Busca de livros por título e autor",
        tecnologias: ["React", "Spring Boot"], prioridade: "MEDIA", complexidade: 3,
        status: "EM_ANDAMENTO", colunaId: 3, responsavelId: 3,
      }),
      task({
        id: 107, projetoId: 10, titulo: "Configurar repositório",
        tecnologias: ["Git"], prioridade: "BAIXA", complexidade: 1,
        status: "CONCLUIDA", responsavelId: 1, updatedAt: daysAgo(20),
      }),
      task({
        id: 108, projetoId: 10, titulo: "Notificação de devolução por e-mail",
        tecnologias: ["Spring Boot"], prioridade: "URGENTE", complexidade: 3,
        status: "PENDENTE", dependenciasIds: [104],
      }),
      task({
        id: 201, projetoId: 11, titulo: "Protótipo das telas de agenda",
        tecnologias: ["Figma"], prioridade: "ALTA", status: "EM_ANDAMENTO", responsavelId: 5,
      }),
      task({ id: 202, projetoId: 11, titulo: "Cadastro de clínicas", tecnologias: ["React Native"], status: "PENDENTE" }),
      task({ id: 301, projetoId: 12, titulo: "Migrar conteúdo", status: "CONCLUIDA", responsavelId: 4 }),
    ],
    skills: [
      ...skills(1, "BACKEND", 4, ["Spring Security", "JWT", "Java"]),
      ...skills(1, "DEVOPS", 3, ["Git", "Docker"]),
      ...skills(2, "BACKEND", 3, ["Java", "Spring Boot"]),
      ...skills(2, "GESTAO", 4, ["Scrum"]),
      ...skills(3, "FRONTEND", 4, ["React", "TypeScript"]),
      ...skills(4, "BANCO_DE_DADOS", 3, ["PostgreSQL", "Java"]),
      ...skills(5, "DESIGN", 5, ["Figma"]),
    ],
    comments: [
      { id: 1, tarefaId: 103, texto: "Falta decidir se exemplar vira tabela própria.", autorId: 4, criadoEm: daysAgo(9) },
      { id: 2, tarefaId: 103, texto: "Sim, separa exemplar de livro.", autorId: 2, criadoEm: daysAgo(8) },
    ],
    attachments: [
      { id: 1, tarefaId: 103, nome: "diagrama-er.pdf", tamanho: 184_320, autorId: 4, criadoEm: daysAgo(9) },
    ],
    history: [
      { id: 1, tarefaId: 103, acao: "CRIACAO", atorId: 2, responsavelId: null, status: "PENDENTE", criadoEm: daysAgo(12) },
      { id: 2, tarefaId: 103, acao: "ATRIBUICAO", atorId: 2, responsavelId: 4, status: "PENDENTE", criadoEm: daysAgo(11) },
      { id: 3, tarefaId: 103, acao: "STATUS", atorId: 4, responsavelId: 4, status: "EM_ANDAMENTO", criadoEm: daysAgo(9) },
    ],
    documents: [
      {
        id: 1, projetoId: 10, nome: "Guia de API.pdf", tipo: "PDF", criadoEm: daysAgo(1),
        trechos: [
          "Todas as rotas exigem autenticação JWT, exceto login e cadastro.",
          "O prazo padrão de empréstimo é de 14 dias, renovável uma vez.",
        ],
      },
    ],
    domain: {
      regras: "Tarefas de segurança só devem ser recomendadas a integrantes de nível 4 ou 5.\nEvite recomendar integrantes com mais de 3 tarefas em andamento.",
      vocabulario: "Exemplar: cópia física de um livro do acervo.\nSprint: ciclo de duas semanas de desenvolvimento.",
    },
    recommendations: [],
  };
}

function load(): MockDb {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MockDb;
  } catch {
    /* usa os dados iniciais */
  }
  return seed();
}

export const db: MockDb = load();

export function persist() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    /* armazenamento cheio ou indisponível: segue só em memória */
  }
}

export function resetDb() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function nextId() {
  db.seq += 1;
  return db.seq;
}
