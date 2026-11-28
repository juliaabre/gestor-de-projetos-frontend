import { decodeJwt } from "@/lib/session";
import {
  DEMO_PASSWORD,
  db,
  nextId,
  type MockBoard,
  type MockProject,
  type MockTask,
  type MockUser,
} from "./db";
import { bottlenecks, consult, dependencies, describe, recommend, summary } from "./ai";
import { getAiMode } from "./settings";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export interface MockRequest {
  method: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, unknown>;
  body: unknown;
  token: string | null;
}

type Handler = (req: MockRequest) => unknown;
interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
  ai?: boolean;
}

const routes: Route[] = [];
function on(method: string, path: string, handler: Handler, ai = false) {
  const keys: string[] = [];
  const pattern = new RegExp(
    "^" + path.replace(/:(\w+)/g, (_, key: string) => (keys.push(key), "([^/]+)")) + "$",
  );
  routes.push({ method, pattern, keys, handler, ai });
}

export function match(method: string, path: string) {
  for (const route of routes) {
    if (route.method !== method) continue;
    const m = route.pattern.exec(path);
    if (m) {
      return {
        route,
        params: Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])),
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------- utilidades

const now = () => new Date().toISOString();
const json = <T,>(body: unknown) => (body ?? {}) as T;
const id = (value: string) => Number(value);

function base64url(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Como o backend: `roles` com os nomes dos papéis globais (MEMBRO, ADMINISTRADOR). */
function makeToken(user: MockUser) {
  const header = base64url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      sub: user.email,
      roles: [...user.roles].sort(),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 8 * 3600,
    }),
  );
  return `${header}.${payload}.simulado`;
}

function currentUser(req: MockRequest): MockUser {
  const email = req.token ? decodeJwt(req.token)?.sub : null;
  const user = db.users.find((u) => u.email === email);
  if (!user) throw new HttpError(401, "Sessão inválida.");
  return user;
}

// Regras do backend (AccessPolicy): ver exige integrar a equipe; gerenciar
// exige ser o gerente do projeto. Administrador não tem exceção em projetos.
const isAdmin = (user: MockUser) => user.roles.includes("ADMINISTRADOR");
const canView = (project: MockProject, user: MockUser) => project.equipeIds.includes(user.id);
const canManage = (project: MockProject, user: MockUser) => canView(project, user) && project.gerenteId === user.id;

function findProject(projectId: number, user: MockUser) {
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) throw new HttpError(404, "Projeto não encontrado com o ID: " + projectId);
  if (!canView(project, user)) throw new HttpError(403, "Você não tem acesso a este projeto.");
  return project;
}

function findTask(taskId: number, user: MockUser) {
  const task = db.tasks.find((t) => t.id === taskId);
  if (!task) throw new HttpError(404, "Task not found.");
  return { task, project: findProject(task.projetoId, user) };
}

function requireActive(project: MockProject) {
  if (project.arquivado) throw new HttpError(409, "O projeto está arquivado.");
}

function requireManage(project: MockProject, user: MockUser) {
  if (!canManage(project, user)) throw new HttpError(403, "Você não tem permissão para gerenciar este projeto.");
}

function requireAdmin(req: MockRequest) {
  const user = currentUser(req);
  if (!isAdmin(user)) throw new HttpError(403, "Acesso restrito ao perfil Administrador.");
  return user;
}

const member = (u: MockUser) => ({ id: u.id, username: u.username, email: u.email });

function projectDto(p: MockProject, user: MockUser) {
  const team = p.equipeIds.map((uid) => db.users.find((u) => u.id === uid)).filter(Boolean) as MockUser[];
  return {
    id: p.id,
    nome: p.nome,
    descricao: p.descricao,
    arquivado: p.arquivado,
    criadorId: p.criadorId,
    gerenteId: p.gerenteId,
    equipe: team.sort((a, b) => a.username.localeCompare(b.username)).map(member),
    equipeIds: p.equipeIds,
    tarefasIds: db.tasks.filter((t) => t.projetoId === p.id).map((t) => t.id),
    createdAt: p.createdAt,
    meuPapelNoProjeto: canView(p, user) ? (p.gerenteId === user.id ? "ROLE_GERENTE" : "ROLE_MEMBRO") : null,
    podeGerenciar: canManage(p, user),
    podeAdicionarMembros: canManage(p, user),
  };
}

function taskDto(t: MockTask) {
  const { dependenciasIds: _deps, ...rest } = t;
  return rest;
}

function audit(task: MockTask, acao: string, atorId: number) {
  db.history.push({
    id: nextId(), tarefaId: task.id, acao, atorId, responsavelId: task.responsavelId, status: task.status, criadoEm: now(),
  });
}

// ------------------------------------------------------------- autenticação

on("post", "/api/v1/auth/login", (req) => {
  const { email, password } = json<{ email: string; password: string }>(req.body);
  const user = db.users.find((u) => u.email === email?.toLowerCase());
  if (!user || password !== DEMO_PASSWORD) throw new HttpError(401, "E-mail ou senha inválidos.");
  return makeToken(user);
});

on("post", "/api/v1/auth/register", (req) => {
  const { username, email, password } = json<{ username: string; email: string; password: string }>(req.body);
  if (db.users.some((u) => u.email === email.toLowerCase())) throw new HttpError(409, "E-mail já cadastrado.");
  if (!password || password.length < 6) throw new HttpError(400, "Verifique os dados informados.", { password: "A senha deve ter pelo menos 6 caracteres" });
  const user: MockUser = { id: nextId(), username, email: email.toLowerCase(), roles: ["MEMBRO"] };
  db.users.push(user);
  return makeToken(user);
});

// ----------------------------------------------------- usuários e competências

on("get", "/api/usuarios", (req) => {
  const user = currentUser(req);
  const managesSome = db.projects.some((p) => p.gerenteId === user.id && p.equipeIds.includes(user.id));
  if (!isAdmin(user) && !managesSome) {
    throw new HttpError(403, "Diretório disponível a gerentes de projeto e administradores.");
  }
  return db.users.map((u) => ({ ...member(u), papeis: u.roles.map((r) => `ROLE_${r}`) }));
});

function requireSelfOrAdmin(req: MockRequest) {
  const user = currentUser(req);
  if (user.id !== id(req.params.id) && !isAdmin(user)) throw new HttpError(403, "Acesso negado.");
}

on("get", "/api/usuarios/:id/competencias", (req) => {
  requireSelfOrAdmin(req);
  return db.skills
    .filter((s) => s.usuarioId === id(req.params.id))
    .map(({ tecnologia, tipoAtividade, nivel }) => ({ tecnologia, tipoAtividade, nivel }));
});
on("put", "/api/usuarios/:id/competencias", (req) => {
  requireSelfOrAdmin(req);
  const userId = id(req.params.id);
  const list = json<{ competencias: { tecnologia: string; tipoAtividade: string; nivel: number }[] }>(req.body).competencias ?? [];
  const keys = list.map((s) => `${s.tecnologia.trim().toLowerCase()}|${s.tipoAtividade.trim().toLowerCase()}`);
  if (new Set(keys).size !== keys.length) throw new HttpError(400, "Competência duplicada.");
  if (list.length > 50) throw new HttpError(400, "Verifique os dados informados.", { competencias: "Máximo de 50 itens." });
  db.skills = [...db.skills.filter((s) => s.usuarioId !== userId), ...list.map((s) => ({ ...s, usuarioId: userId }))];
  return list;
});

// ------------------------------------------------------------------ projetos

on("get", "/api/projetos", (req) => {
  const user = currentUser(req);
  return db.projects.filter((p) => canView(p, user)).sort((a, b) => b.id - a.id).map((p) => projectDto(p, user));
});
on("get", "/api/projetos/:id", (req) => {
  const user = currentUser(req);
  return projectDto(findProject(id(req.params.id), user), user);
});
on("post", "/api/projetos", (req) => {
  const user = currentUser(req);
  const body = json<{ nome: string; descricao?: string; equipeIds?: number[] }>(req.body);
  if (!body.nome?.trim()) throw new HttpError(400, "Verifique os dados informados.", { nome: "O nome do projeto não pode estar vazio" });
  const project: MockProject = {
    id: nextId(),
    nome: body.nome.trim(),
    descricao: body.descricao?.trim() || null,
    arquivado: false,
    criadorId: user.id,
    gerenteId: user.id,
    equipeIds: [...new Set([user.id, ...(body.equipeIds ?? [])])],
    createdAt: now(),
  };
  db.projects.push(project);
  return projectDto(project, user);
});
on("put", "/api/projetos/:id", (req) => {
  const user = currentUser(req);
  const project = findProject(id(req.params.id), user);
  requireManage(project, user);
  if (project.arquivado) throw new HttpError(409, "Projetos arquivados não podem ser editados. Desarquive o projeto primeiro.");
  const body = json<{ nome: string; descricao?: string; equipeIds?: number[] | null; gerenteId?: number }>(req.body);
  if (!body.nome?.trim()) throw new HttpError(400, "Verifique os dados informados.", { nome: "O nome do projeto não pode estar vazio" });
  project.nome = body.nome.trim();
  project.descricao = body.descricao?.trim() || null;
  const manager = body.gerenteId ?? project.gerenteId;
  if (body.equipeIds) project.equipeIds = [...new Set([project.criadorId, manager, ...body.equipeIds])];
  if (body.gerenteId != null) {
    if (!project.equipeIds.includes(body.gerenteId)) throw new HttpError(400, "O gerente deve integrar a equipe.");
    project.gerenteId = body.gerenteId;
  }
  return projectDto(project, user);
});
for (const [action, archived] of [["arquivar", true], ["desarquivar", false]] as const) {
  on("patch", `/api/projetos/:id/${action}`, (req) => {
    const user = currentUser(req);
    const project = findProject(id(req.params.id), user);
    requireManage(project, user);
    project.arquivado = archived;
    return projectDto(project, user);
  });
}
on("delete", "/api/projetos/:id", (req) => {
  const user = currentUser(req);
  const project = findProject(id(req.params.id), user);
  requireManage(project, user);
  db.projects = db.projects.filter((p) => p.id !== project.id);
  db.tasks = db.tasks.filter((t) => t.projetoId !== project.id);
  db.boards = db.boards.filter((b) => b.projetoId !== project.id);
});

// ------------------------------------------------------- quadros e colunas

type BoardBody = {
  nome?: string;
  colunas?: { id?: number | null; nome?: string; status?: string | null }[];
  realocacoes?: Record<string, number>;
};

const boardDto = (board: MockBoard) => ({
  ...board,
  colunas: [...board.colunas].sort((a, b) => a.posicao - b.posicao),
});

function findColumn(columnId: number) {
  for (const board of db.boards) {
    const column = board.colunas.find((c) => c.id === columnId);
    if (column) return { board, column };
  }
  return null;
}

/** Mesmas regras do `QuadroService` do backend. */
function configureBoard(board: MockBoard, body: BoardBody) {
  const colunas = body.colunas ?? [];
  if (!body.nome?.trim() || colunas.length === 0) throw new HttpError(400, "Informe o nome e ao menos uma coluna.");
  const names = new Set<string>();
  const kept = new Set<number>();
  for (const column of colunas) {
    const name = column.nome?.trim().toLowerCase();
    if (!name) throw new HttpError(400, "Informe o nome de cada coluna.");
    if (names.has(name)) throw new HttpError(400, "Nome de coluna duplicado.");
    names.add(name);
    if (column.id != null) {
      if (!board.colunas.some((c) => c.id === column.id) || kept.has(column.id)) {
        throw new HttpError(400, "ID de coluna inválido ou repetido neste quadro.");
      }
      kept.add(column.id);
    }
  }
  const moves = body.realocacoes ?? {};
  for (const removed of board.colunas.filter((c) => !kept.has(c.id))) {
    const affected = db.tasks.filter((t) => t.colunaId === removed.id);
    if (affected.length === 0) continue;
    const targetId = moves[removed.id];
    if (targetId == null) {
      throw new HttpError(409, `A coluna "${removed.nome}" tem tarefas. Informe em realocacoes para qual coluna mantida elas devem ir.`);
    }
    if (!kept.has(targetId)) throw new HttpError(400, "A coluna de destino deve ser uma coluna mantida deste quadro.");
    const targetStatus = colunas.find((c) => c.id === targetId)?.status ?? null;
    for (const task of affected) {
      task.colunaId = targetId;
      if (targetStatus) task.status = targetStatus;
    }
  }
  board.nome = body.nome.trim();
  board.colunas = colunas.map((column, posicao) => ({
    id: column.id ?? nextId(),
    nome: column.nome!.trim(),
    posicao,
    status: column.status ?? null,
  }));
}

on("get", "/api/projetos/:id/quadros", (req) => {
  const project = findProject(id(req.params.id), currentUser(req));
  return db.boards.filter((b) => b.projetoId === project.id).map(boardDto);
});
on("post", "/api/projetos/:id/quadros", (req) => {
  const user = currentUser(req);
  const project = findProject(id(req.params.id), user);
  requireManage(project, user);
  requireActive(project);
  const board: MockBoard = { id: nextId(), projetoId: project.id, nome: "", colunas: [] };
  configureBoard(board, json<BoardBody>(req.body));
  db.boards.push(board);
  return boardDto(board);
});
on("put", "/api/projetos/:id/quadros/:qid", (req) => {
  const user = currentUser(req);
  const project = findProject(id(req.params.id), user);
  requireManage(project, user);
  requireActive(project);
  const board = db.boards.find((b) => b.id === id(req.params.qid) && b.projetoId === project.id);
  if (!board) throw new HttpError(404, "Quadro não encontrado neste projeto.");
  configureBoard(board, json<BoardBody>(req.body));
  return boardDto(board);
});

/** Como o `posicionar` do backend: a tarefa assume o status da coluna, se houver. */
function placeTask(task: MockTask, columnId: number) {
  const found = findColumn(columnId);
  if (!found) throw new HttpError(400, "Coluna não encontrada.");
  if (found.board.projetoId !== task.projetoId) {
    throw new HttpError(400, "A coluna deve pertencer a um quadro do projeto da tarefa.");
  }
  task.colunaId = columnId;
  if (found.column.status) task.status = found.column.status;
}

/** Ao mudar só o status, a tarefa vai para a coluna desse status no mesmo quadro. */
function syncColumn(task: MockTask) {
  const found = task.colunaId != null ? findColumn(task.colunaId) : null;
  if (!found || !found.column.status || found.column.status === task.status) return;
  task.colunaId =
    [...found.board.colunas].sort((a, b) => a.posicao - b.posicao).find((c) => c.status === task.status)?.id ?? null;
}

// ------------------------------------------------------------------- tarefas

type TaskBody = Partial<Omit<MockTask, "id" | "createdAt" | "updatedAt" | "dependenciasIds">>;

function validateTask(body: TaskBody) {
  const erros: Record<string, string> = {};
  if (!body.titulo?.trim()) erros.titulo = "Title is required";
  if (!body.status) erros.status = "Status is required";
  if (!body.prioridade) erros.prioridade = "Priority is required";
  if (body.complexidade != null && (body.complexidade < 1 || body.complexidade > 5)) erros.complexidade = "deve estar entre 1 e 5";
  if (Object.keys(erros).length) throw new HttpError(400, "Verifique os dados informados.", erros);
}

function applyTask(task: MockTask, body: TaskBody, project: MockProject) {
  if (body.responsavelId != null && !project.equipeIds.includes(body.responsavelId)) {
    throw new HttpError(400, "Responsável deve pertencer à equipe.");
  }
  Object.assign(task, {
    titulo: body.titulo!.trim(),
    conteudo: body.conteudo ?? null,
    requisitos: body.requisitos ?? null,
    tecnologias: [...new Set(body.tecnologias ?? [])],
    status: body.status,
    prioridade: body.prioridade,
    complexidade: body.complexidade ?? null,
    prazo: body.prazo ?? null,
    responsavelId: body.responsavelId ?? null,
    updatedAt: now(),
  });
}

on("get", "/api/tarefas/projeto/:id", (req) => {
  const project = findProject(id(req.params.id), currentUser(req));
  return db.tasks.filter((t) => t.projetoId === project.id).map(taskDto);
});
on("get", "/api/tarefas/:id", (req) => taskDto(findTask(id(req.params.id), currentUser(req)).task));
on("post", "/api/tarefas", (req) => {
  const user = currentUser(req);
  const body = json<TaskBody>(req.body);
  validateTask(body);
  const project = findProject(Number(body.projetoId), user);
  requireManage(project, user);
  requireActive(project);
  const task = { id: nextId(), projetoId: project.id, colunaId: null, dependenciasIds: [], createdAt: now() } as unknown as MockTask;
  applyTask(task, body, project);
  if (body.colunaId != null) placeTask(task, body.colunaId);
  db.tasks.push(task);
  audit(task, "CRIACAO", user.id);
  return taskDto(task);
});
on("put", "/api/tarefas/:id", (req) => {
  const user = currentUser(req);
  const { task, project } = findTask(id(req.params.id), user);
  requireManage(project, user);
  requireActive(project);
  const body = json<TaskBody>(req.body);
  validateTask(body);
  const previous = task.responsavelId;
  applyTask(task, body, project);
  if (body.colunaId != null) placeTask(task, body.colunaId);
  audit(task, previous !== task.responsavelId ? "ATRIBUICAO" : "ATUALIZACAO", user.id);
  return taskDto(task);
});
on("patch", "/api/tarefas/:id/status", (req) => {
  const user = currentUser(req);
  const { task, project } = findTask(id(req.params.id), user);
  requireActive(project);
  const status = req.query.novoStatus;
  if (typeof status !== "string" || !status) throw new HttpError(400, "Status obrigatório.");
  task.status = status;
  syncColumn(task);
  task.updatedAt = now();
  audit(task, "STATUS", user.id);
  return taskDto(task);
});
on("patch", "/api/tarefas/:id/coluna", (req) => {
  const user = currentUser(req);
  const { task, project } = findTask(id(req.params.id), user);
  requireActive(project);
  const columnId = Number(req.query.colunaId);
  if (!columnId) throw new HttpError(400, "Coluna obrigatória.");
  placeTask(task, columnId);
  task.updatedAt = now();
  audit(task, "COLUNA", user.id);
  return taskDto(task);
});
on("delete", "/api/tarefas/:id", (req) => {
  const user = currentUser(req);
  const { task, project } = findTask(id(req.params.id), user);
  requireManage(project, user);
  requireActive(project);
  db.tasks = db.tasks.filter((t) => t.id !== task.id);
  for (const t of db.tasks) t.dependenciasIds = t.dependenciasIds.filter((d) => d !== task.id);
});

on("get", "/api/tarefas/:id/comentarios", (req) => {
  const { task } = findTask(id(req.params.id), currentUser(req));
  return db.comments
    .filter((c) => c.tarefaId === task.id)
    .map(({ id: commentId, autorId, texto, criadoEm }) => ({ id: commentId, autorId, texto, criadoEm }));
});
on("post", "/api/tarefas/:id/comentarios", (req) => {
  const user = currentUser(req);
  const { task, project } = findTask(id(req.params.id), user);
  requireActive(project);
  const texto = json<{ texto: string }>(req.body).texto?.trim();
  if (!texto) throw new HttpError(400, "Verifique os dados informados.", { texto: "não deve estar em branco" });
  const comment = { id: nextId(), tarefaId: task.id, texto, autorId: user.id, criadoEm: now() };
  db.comments.push(comment);
  return { id: comment.id, autorId: comment.autorId, texto, criadoEm: comment.criadoEm };
});

const attachmentDto = (a: (typeof db.attachments)[number]) => ({
  id: a.id, autorId: a.autorId, nome: a.nome, tamanho: a.tamanho, criadoEm: a.criadoEm,
});
on("get", "/api/tarefas/:id/anexos", (req) => {
  const { task } = findTask(id(req.params.id), currentUser(req));
  return db.attachments.filter((a) => a.tarefaId === task.id).map(attachmentDto);
});
on("post", "/api/tarefas/:id/anexos", (req) => {
  const user = currentUser(req);
  const { task, project } = findTask(id(req.params.id), user);
  requireActive(project);
  const file = (req.body as FormData).get("arquivo") as File | null;
  if (!file || file.size === 0) throw new HttpError(400, "Envie um arquivo com conteúdo.");
  if (file.size > 5 * 1024 * 1024) throw new HttpError(413, "O arquivo deve ter até 5 MB.");
  const attachment = { id: nextId(), tarefaId: task.id, nome: file.name, tamanho: file.size, autorId: user.id, criadoEm: now() };
  db.attachments.push(attachment);
  return attachmentDto(attachment);
});
on("get", "/api/tarefas/:id/anexos/:aid", (req) => {
  findTask(id(req.params.id), currentUser(req));
  const attachment = db.attachments.find((a) => a.id === id(req.params.aid));
  if (!attachment) throw new HttpError(404, "Anexo não encontrado.");
  return new Blob([`Arquivo simulado: ${attachment.nome}\n`], { type: "application/octet-stream" });
});
on("delete", "/api/tarefas/:id/anexos/:aid", (req) => {
  const user = currentUser(req);
  const { project } = findTask(id(req.params.id), user);
  requireManage(project, user);
  requireActive(project);
  db.attachments = db.attachments.filter((a) => a.id !== id(req.params.aid));
});

on("get", "/api/tarefas/:id/dependencias", (req) => {
  const { task } = findTask(id(req.params.id), currentUser(req));
  return task.dependenciasIds
    .map((depId) => db.tasks.find((t) => t.id === depId))
    .filter(Boolean)
    .map((t) => ({ id: t!.id, titulo: t!.titulo }));
});
on("put", "/api/tarefas/:id/dependencias/:pid", (req) => {
  const user = currentUser(req);
  const { task, project } = findTask(id(req.params.id), user);
  requireManage(project, user);
  requireActive(project);
  const prerequisite = db.tasks.find((t) => t.id === id(req.params.pid));
  if (!prerequisite || prerequisite.projetoId !== task.projetoId) throw new HttpError(400, "O pré-requisito deve ser uma tarefa do mesmo projeto.");
  if (prerequisite.id === task.id || prerequisite.dependenciasIds.includes(task.id)) throw new HttpError(409, "A dependência criaria um ciclo.");
  if (!task.dependenciasIds.includes(prerequisite.id)) task.dependenciasIds.push(prerequisite.id);
});
on("delete", "/api/tarefas/:id/dependencias/:pid", (req) => {
  const user = currentUser(req);
  const { task, project } = findTask(id(req.params.id), user);
  requireManage(project, user);
  requireActive(project);
  task.dependenciasIds = task.dependenciasIds.filter((d) => d !== id(req.params.pid));
});

on("get", "/api/tarefas/:id/historico", (req) => {
  const { task } = findTask(id(req.params.id), currentUser(req));
  return db.history
    .filter((h) => h.tarefaId === task.id)
    .sort((a, b) => a.id - b.id)
    .map(({ id: historyId, acao, atorId, responsavelId, status, criadoEm }) => ({ id: historyId, acao, atorId, responsavelId, status, criadoEm }));
});

// ------------------------------------------------------------------------ IA

/** Modo "fora do ar" da simulação: falha como um provedor indisponível. */
function aiMode() {
  const mode = getAiMode();
  if (mode === "offline") throw new HttpError(503, "Serviço de IA indisponível no momento.");
  return { fallback: mode === "fallback" };
}

function managedTask(req: MockRequest) {
  const user = currentUser(req);
  const found = findTask(id(req.params.id), user);
  requireManage(found.project, user);
  return { ...found, user };
}

on("post", "/api/ia/consultar", (req) => {
  const { fallback } = aiMode();
  const project = findProject(Number(req.query.projetoId), currentUser(req));
  const pergunta = json<{ pergunta: string }>(req.body).pergunta?.trim();
  if (!pergunta) throw new HttpError(400, "Verifique os dados informados.", { pergunta: "não deve estar em branco" });
  return consult(project, pergunta, fallback);
}, true);
on("get", "/api/ia/projetos/:id/resumo", (req) => {
  const { fallback } = aiMode();
  const user = currentUser(req);
  const project = findProject(id(req.params.id), user);
  requireManage(project, user);
  const start = typeof req.query.inicio === "string" ? req.query.inicio : null;
  const end = typeof req.query.fim === "string" ? req.query.fim : null;
  if (Boolean(start) !== Boolean(end) || (start && end && start > end)) throw new HttpError(400, "Informe um intervalo de datas válido.");
  return summary(project, start, end, fallback);
}, true);
on("get", "/api/ia/projetos/:id/gargalos", (req) => {
  const { fallback } = aiMode();
  const user = currentUser(req);
  const project = findProject(id(req.params.id), user);
  requireManage(project, user);
  return bottlenecks(project, fallback);
}, true);
on("post", "/api/ia/tarefas/:id/descricao", (req) => {
  const { fallback } = aiMode();
  const { task } = managedTask(req);
  return describe(task, json<{ pergunta: string }>(req.body).pergunta ?? "", fallback);
}, true);
on("get", "/api/ia/tarefas/:id/dependencias", (req) => {
  const { fallback } = aiMode();
  return dependencies(managedTask(req).task, fallback);
}, true);
on("post", "/api/ia/tarefas/:id/recomendacoes", (req) => {
  const { fallback } = aiMode();
  const { task, project } = managedTask(req);
  const recommendation = { id: nextId(), tarefaId: task.id, ...recommend(task, project, fallback), decisao: null, escolhidoId: null };
  db.recommendations.push(recommendation);
  return recommendation;
}, true);
on("get", "/api/ia/tarefas/:id/recomendacoes", (req) => {
  const { task } = managedTask(req);
  return db.recommendations.filter((r) => r.tarefaId === task.id);
});
on("post", "/api/ia/tarefas/:id/recomendacoes/:rid/feedback", (req) => {
  const { task, project, user } = managedTask(req);
  requireActive(project);
  const recommendation = db.recommendations.find((r) => r.id === id(req.params.rid) && r.tarefaId === task.id);
  if (!recommendation) throw new HttpError(404, "Recomendação não encontrada.");
  const body = json<{ decisao: string; usuarioId?: number; observacao?: string }>(req.body);
  let chosen: number | null = null;
  if (body.decisao === "ACEITA") chosen = recommendation.ranking[0]?.usuarioId ?? null;
  else if (body.decisao === "AJUSTADA") {
    if (!body.usuarioId || !project.equipeIds.includes(body.usuarioId)) {
      throw new HttpError(400, "AJUSTADA exige usuarioId de um integrante atual.");
    }
    chosen = body.usuarioId;
  } else if (body.decisao !== "RECUSADA") throw new HttpError(400, "Decisão inválida.");
  recommendation.decisao = body.decisao;
  recommendation.escolhidoId = chosen;
  if (chosen != null) {
    task.responsavelId = chosen;
    task.updatedAt = now();
    audit(task, "ATRIBUICAO", user.id);
  }
  return recommendation;
});

// ----------------------------------------------------------------- administração

on("get", "/api/admin/regras-dominio", (req) => (requireAdmin(req), db.domain));
on("post", "/api/admin/regras-dominio", (req) => {
  requireAdmin(req);
  const body = json<{ regras: string; vocabulario: string }>(req.body);
  if (!body.regras?.trim()) throw new HttpError(400, "Verifique os dados informados.", { regras: "não deve estar em branco" });
  if (body.regras.length > 4000 || (body.vocabulario ?? "").length > 4000) {
    throw new HttpError(400, "Verifique os dados informados.", { regras: "tamanho deve ser entre 0 e 4000" });
  }
  db.domain = { regras: body.regras, vocabulario: body.vocabulario ?? "" };
  return db.domain;
});

const documentDto = (d: (typeof db.documents)[number]) => ({
  id: d.id, nome: d.nome, tipo: d.tipo, trechos: d.trechos.length, criadoEm: d.criadoEm,
});
on("get", "/api/projetos/:id/documentos", (req) => {
  const project = findProject(id(req.params.id), currentUser(req));
  return db.documents.filter((d) => d.projetoId === project.id).reverse().map(documentDto);
});
on("get", "/api/projetos/:id/documentos/:did/trechos", (req) => {
  const project = findProject(id(req.params.id), currentUser(req));
  const doc = db.documents.find((d) => d.id === id(req.params.did) && d.projetoId === project.id);
  if (!doc) throw new HttpError(404, "Documento não encontrado.");
  return doc.trechos.map((trecho, i) => ({
    id: `D${doc.id}-${i + 1}`, tipo: "DOCUMENTO", recursoId: doc.id, titulo: doc.nome, pagina: doc.tipo === "PDF" ? i + 1 : null, trecho, similaridade: 1,
  }));
});
on("post", "/api/admin/projetos/:id/documentos", (req) => {
  const user = requireAdmin(req);
  const project = findProject(id(req.params.id), user);
  requireActive(project);
  if (getAiMode() === "offline") throw new HttpError(503, "Configure RAG_ENABLED e GEMINI_API_KEY para utilizar o provedor de IA.");
  const file = (req.body as FormData).get("arquivo") as File | null;
  if (!file) throw new HttpError(400, "Envie um arquivo.");
  if (file.size > 5 * 1024 * 1024) throw new HttpError(413, "O arquivo deve ter até 5 MB.");
  const extension = file.name.split(".").pop()?.toLowerCase();
  const tipo = extension === "pdf" ? "PDF" : extension === "md" || extension === "markdown" ? "MARKDOWN" : extension === "txt" ? "TEXTO" : null;
  if (!tipo) throw new HttpError(415, "Formato não suportado. Envie PDF, Markdown ou texto.");
  const doc = {
    id: nextId(), projetoId: project.id, nome: file.name, tipo, criadoEm: now(),
    trechos: [`Conteúdo simulado de ${file.name}, parte 1.`, `Conteúdo simulado de ${file.name}, parte 2.`],
  };
  db.documents.push(doc);
  return documentDto(doc);
}, true);
on("delete", "/api/admin/projetos/:id/documentos/:did", (req) => {
  const user = requireAdmin(req);
  findProject(id(req.params.id), user);
  db.documents = db.documents.filter((d) => d.id !== id(req.params.did));
});
