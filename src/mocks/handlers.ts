import { decodeJwt } from "@/lib/session";
import {
  DEMO_PASSWORD,
  db,
  nextId,
  type MockProject,
  type MockTask,
  type MockUser,
} from "./db";
import { answer, bottlenecks, dependencySuggestions, describe, recommend, summary } from "./ai";
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

function makeToken(user: MockUser) {
  const header = base64url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      sub: user.email,
      roles: user.roles.map((role) => `ROLE_${role}`),
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

const isAdmin = (user: MockUser) => user.roles.includes("ADMINISTRADOR");
const isMember = (project: MockProject, user: MockUser) => project.equipeIds.includes(user.id);
const canView = (project: MockProject, user: MockUser) => isAdmin(user) || isMember(project, user);
const canManage = (project: MockProject, user: MockUser) =>
  isAdmin(user) || project.criadorId === user.id || (user.roles.includes("GERENTE") && isMember(project, user));

function findProject(projectId: number, user: MockUser) {
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) throw new HttpError(404, "Projeto não encontrado.");
  if (!canView(project, user)) throw new HttpError(403, "Você não tem acesso a este projeto.");
  return project;
}

function findTask(taskId: number, user: MockUser) {
  const task = db.tasks.find((t) => t.id === taskId);
  if (!task) throw new HttpError(404, "Tarefa não encontrada.");
  return { task, project: findProject(task.projetoId, user) };
}

function requireWritable(project: MockProject, user: MockUser) {
  if (project.arquivado) throw new HttpError(409, "Projetos arquivados não podem ser alterados.");
  if (!canView(project, user)) throw new HttpError(403, "Você não faz parte da equipe deste projeto.");
}

function requireManage(project: MockProject, user: MockUser) {
  requireWritable(project, user);
  if (!canManage(project, user)) throw new HttpError(403, "Somente o gerente do projeto pode realizar esta operação.");
}

function requireAdmin(req: MockRequest) {
  const user = currentUser(req);
  if (!isAdmin(user)) throw new HttpError(403, "Acesso restrito ao perfil Administrador.");
  return user;
}

const userSummary = (u: MockUser) => ({ id: u.id, username: u.username, email: u.email });
const author = (userId: number | null) => {
  const u = db.users.find((x) => x.id === userId);
  return u ? { id: u.id, username: u.username } : null;
};

function projectDto(p: MockProject, user: MockUser) {
  const team = p.equipeIds.map((uid) => db.users.find((u) => u.id === uid)).filter(Boolean) as MockUser[];
  const member = isMember(p, user);
  return {
    id: p.id,
    nome: p.nome,
    descricao: p.descricao,
    arquivado: p.arquivado,
    criadorId: p.criadorId,
    equipe: team.map(userSummary),
    equipeIds: p.equipeIds,
    tarefasIds: db.tasks.filter((t) => t.projetoId === p.id).map((t) => t.id),
    createdAt: p.createdAt,
    meuPapelNoProjeto: member ? (canManage(p, user) ? "ROLE_GERENTE" : "ROLE_MEMBRO") : null,
    podeGerenciar: canManage(p, user),
  };
}

function statusLabel(projectId: number, status: string) {
  return db.columns.find((c) => c.projetoId === projectId && c.status === status)?.nome ?? status;
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
  if (!password || password.length < 6) throw new HttpError(400, "Dados inválidos.", { password: "Mínimo de 6 caracteres." });
  const user: MockUser = { id: nextId(), username, email: email.toLowerCase(), roles: ["MEMBRO"] };
  db.users.push(user);
  return makeToken(user);
});

// ----------------------------------------------------- usuários e competências

on("get", "/api/usuarios", (req) => (currentUser(req), db.users.map(userSummary)));
on("get", "/api/usuarios/:id", (req) => {
  currentUser(req);
  const user = db.users.find((u) => u.id === id(req.params.id));
  if (!user) throw new HttpError(404, "Usuário não encontrado.");
  return userSummary(user);
});

function requireSkillOwner(req: MockRequest) {
  const user = currentUser(req);
  if (user.id !== id(req.params.id) && !isAdmin(user)) {
    throw new HttpError(403, "Você só pode alterar as próprias competências.");
  }
}

on("get", "/api/usuarios/:id/competencias", (req) => {
  currentUser(req);
  return db.skills.filter((s) => s.usuarioId === id(req.params.id));
});
on("post", "/api/usuarios/:id/competencias", (req) => {
  requireSkillOwner(req);
  const body = json<{ tecnologias: string[]; tipoAtividade: string; nivelExperiencia: string }>(req.body);
  const skill = { id: nextId(), usuarioId: id(req.params.id), ...body };
  db.skills.push(skill);
  return skill;
});
on("put", "/api/usuarios/:id/competencias/:sid", (req) => {
  requireSkillOwner(req);
  const skill = db.skills.find((s) => s.id === id(req.params.sid));
  if (!skill) throw new HttpError(404, "Competência não encontrada.");
  Object.assign(skill, json(req.body));
  return skill;
});
on("delete", "/api/usuarios/:id/competencias/:sid", (req) => {
  requireSkillOwner(req);
  db.skills = db.skills.filter((s) => s.id !== id(req.params.sid));
});

// ------------------------------------------------------------------ projetos

on("get", "/api/projetos", (req) => {
  const user = currentUser(req);
  return db.projects.filter((p) => canView(p, user)).map((p) => projectDto(p, user));
});
on("get", "/api/projetos/:id", (req) => {
  const user = currentUser(req);
  return projectDto(findProject(id(req.params.id), user), user);
});
on("post", "/api/projetos", (req) => {
  const user = currentUser(req);
  const body = json<{ nome: string; descricao?: string; equipeIds?: number[] }>(req.body);
  if (!body.nome?.trim()) throw new HttpError(400, "Dados inválidos.", { nome: "Informe o nome do projeto." });
  const project: MockProject = {
    id: nextId(),
    nome: body.nome.trim(),
    descricao: body.descricao ?? null,
    arquivado: false,
    criadorId: user.id,
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
  const body = json<{ nome: string; descricao?: string; equipeIds?: number[] }>(req.body);
  project.nome = body.nome;
  project.descricao = body.descricao ?? null;
  if (body.equipeIds) project.equipeIds = [...new Set([project.criadorId, ...body.equipeIds])];
  return projectDto(project, user);
});
for (const [action, archived] of [["arquivar", true], ["desarquivar", false]] as const) {
  on("patch", `/api/projetos/:id/${action}`, (req) => {
    const user = currentUser(req);
    const project = findProject(id(req.params.id), user);
    if (!canManage(project, user)) throw new HttpError(403, "Você não tem permissão para gerenciar este projeto.");
    project.arquivado = archived;
    return projectDto(project, user);
  });
}

on("get", "/api/projetos/:id/colunas", (req) => {
  const user = currentUser(req);
  const project = findProject(id(req.params.id), user);
  return db.columns.filter((c) => c.projetoId === project.id).sort((a, b) => a.ordem - b.ordem);
});
on("post", "/api/projetos/:id/colunas", (req) => {
  const user = currentUser(req);
  const project = findProject(id(req.params.id), user);
  requireManage(project, user);
  const body = json<{ nome: string; status: string }>(req.body);
  let columns = db.columns.filter((c) => c.projetoId === project.id);
  if (columns.length === 0) {
    // Primeira coluna personalizada: materializa as colunas padrão do projeto.
    ["PENDENTE:A fazer", "EM_ANDAMENTO:Em andamento", "CONCLUIDA:Concluído", "CANCELADA:Cancelado"].forEach((entry, i) => {
      const [status, nome] = entry.split(":");
      db.columns.push({ id: nextId(), projetoId: project.id, nome, status, ordem: i });
    });
    columns = db.columns.filter((c) => c.projetoId === project.id);
  }
  if (columns.some((c) => c.status === body.status)) throw new HttpError(409, "Já existe uma coluna com este status.");
  const column = { id: nextId(), projetoId: project.id, nome: body.nome, status: body.status, ordem: columns.length };
  db.columns.push(column);
  return column;
});
on("put", "/api/projetos/:id/colunas/:cid", (req) => {
  const user = currentUser(req);
  const project = findProject(id(req.params.id), user);
  requireManage(project, user);
  const column = db.columns.find((c) => c.id === id(req.params.cid) && c.projetoId === project.id);
  if (!column) throw new HttpError(404, "Coluna não encontrada.");
  column.nome = json<{ nome: string }>(req.body).nome;
  return column;
});

// ------------------------------------------------------------------- tarefas

type TaskBody = Omit<MockTask, "id" | "createdAt" | "updatedAt">;

function validateTask(body: Partial<TaskBody>) {
  if (!body.titulo?.trim()) throw new HttpError(400, "Dados inválidos.", { titulo: "Informe o título da tarefa." });
  if (!body.prioridade) throw new HttpError(400, "Dados inválidos.", { prioridade: "Informe a prioridade." });
}

function normalizeTask(body: Partial<TaskBody>) {
  return {
    titulo: body.titulo!.trim(),
    conteudo: body.conteudo ?? null,
    requisitos: body.requisitos ?? null,
    tecnologias: body.tecnologias ?? [],
    status: body.status ?? "PENDENTE",
    prioridade: body.prioridade ?? "MEDIA",
    complexidade: body.complexidade ?? null,
    prazo: body.prazo ?? null,
    responsavelId: body.responsavelId ?? null,
    dependenciasIds: body.dependenciasIds ?? [],
  };
}

const FIELD_LABEL: Record<string, string> = {
  titulo: "o título", conteudo: "a descrição", requisitos: "os requisitos", tecnologias: "as tecnologias",
  status: "o status", prioridade: "a prioridade", complexidade: "a complexidade", prazo: "o prazo",
  responsavelId: "o responsável", dependenciasIds: "as dependências",
};

function display(task: MockTask, field: string, value: unknown): string {
  if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) return "vazio";
  if (field === "status") return statusLabel(task.projetoId, String(value));
  if (field === "responsavelId") return author(Number(value))?.username ?? String(value);
  if (field === "dependenciasIds") {
    return (value as number[]).map((d) => db.tasks.find((t) => t.id === d)?.titulo ?? `#${d}`).join(", ");
  }
  if (Array.isArray(value)) return value.join(", ");
  const text = String(value);
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

on("get", "/api/tarefas/projeto/:id", (req) => {
  const user = currentUser(req);
  const project = findProject(id(req.params.id), user);
  return db.tasks.filter((t) => t.projetoId === project.id);
});
on("get", "/api/tarefas/:id", (req) => findTask(id(req.params.id), currentUser(req)).task);
on("post", "/api/tarefas", (req) => {
  const user = currentUser(req);
  const body = json<Partial<TaskBody>>(req.body);
  validateTask(body);
  const project = findProject(Number(body.projetoId), user);
  requireWritable(project, user);
  const task: MockTask = { id: nextId(), projetoId: project.id, ...normalizeTask(body), createdAt: now(), updatedAt: now() };
  db.tasks.push(task);
  db.history.push({ id: nextId(), tarefaId: task.id, campo: null, valorAnterior: null, valorNovo: null, descricao: "criou a tarefa", autorId: user.id, createdAt: now() });
  return task;
});
on("put", "/api/tarefas/:id", (req) => {
  const user = currentUser(req);
  const { task, project } = findTask(id(req.params.id), user);
  requireWritable(project, user);
  const body = json<Partial<TaskBody>>(req.body);
  validateTask(body);
  const next = normalizeTask(body);
  for (const field of Object.keys(next) as (keyof typeof next)[]) {
    const before = JSON.stringify(task[field] ?? null);
    const after = JSON.stringify(next[field] ?? null);
    if (before !== after) {
      db.history.push({
        id: nextId(), tarefaId: task.id, campo: FIELD_LABEL[field] ?? field,
        valorAnterior: display(task, field, task[field]), valorNovo: display(task, field, next[field]),
        descricao: null, autorId: user.id, createdAt: now(),
      });
    }
  }
  Object.assign(task, next, { updatedAt: now() });
  return task;
});
on("delete", "/api/tarefas/:id", (req) => {
  const user = currentUser(req);
  const { task, project } = findTask(id(req.params.id), user);
  requireManage(project, user);
  db.tasks = db.tasks.filter((t) => t.id !== task.id);
  db.tasks.forEach((t) => (t.dependenciasIds = t.dependenciasIds.filter((d) => d !== task.id)));
});

on("get", "/api/tarefas/:id/comentarios", (req) => {
  const { task } = findTask(id(req.params.id), currentUser(req));
  return db.comments
    .filter((c) => c.tarefaId === task.id)
    .map((c) => ({ id: c.id, conteudo: c.conteudo, autor: author(c.autorId), createdAt: c.createdAt }));
});
on("post", "/api/tarefas/:id/comentarios", (req) => {
  const user = currentUser(req);
  const { task, project } = findTask(id(req.params.id), user);
  requireWritable(project, user);
  const conteudo = json<{ conteudo: string }>(req.body).conteudo?.trim();
  if (!conteudo) throw new HttpError(400, "Dados inválidos.", { conteudo: "Escreva o comentário." });
  const comment = { id: nextId(), tarefaId: task.id, conteudo, autorId: user.id, createdAt: now() };
  db.comments.push(comment);
  return { id: comment.id, conteudo, autor: author(user.id), createdAt: comment.createdAt };
});

const attachmentDto = (a: (typeof db.attachments)[number]) => ({
  id: a.id, nomeArquivo: a.nomeArquivo, tipoConteudo: a.tipoConteudo, tamanho: a.tamanho,
  autor: author(a.autorId), createdAt: a.createdAt,
});
on("get", "/api/tarefas/:id/anexos", (req) => {
  const { task } = findTask(id(req.params.id), currentUser(req));
  return db.attachments.filter((a) => a.tarefaId === task.id).map(attachmentDto);
});
on("post", "/api/tarefas/:id/anexos", (req) => {
  const user = currentUser(req);
  const { task, project } = findTask(id(req.params.id), user);
  requireWritable(project, user);
  const file = (req.body as FormData).get("arquivo") as File | null;
  if (!file) throw new HttpError(400, "Envie um arquivo.");
  const attachment = {
    id: nextId(), tarefaId: task.id, nomeArquivo: file.name, tipoConteudo: file.type || "application/octet-stream",
    tamanho: file.size, autorId: user.id, createdAt: now(),
  };
  db.attachments.push(attachment);
  return attachmentDto(attachment);
});
on("get", "/api/tarefas/:id/anexos/:aid/download", (req) => {
  findTask(id(req.params.id), currentUser(req));
  const attachment = db.attachments.find((a) => a.id === id(req.params.aid));
  if (!attachment) throw new HttpError(404, "Anexo não encontrado.");
  return new Blob([`Arquivo simulado: ${attachment.nomeArquivo}\n`], { type: "text/plain" });
});
on("get", "/api/tarefas/:id/historico", (req) => {
  const { task } = findTask(id(req.params.id), currentUser(req));
  return db.history
    .filter((h) => h.tarefaId === task.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((h) => ({ ...h, autor: author(h.autorId) }));
});

// ------------------------------------------------------------------------ IA

const aiUnavailable = () => new HttpError(503, "Serviço de IA indisponível no momento.");

on("get", "/api/ia/recomendar-responsaveis", (req) => {
  const user = currentUser(req);
  const { task, project } = findTask(Number(req.query.tarefaId), user);
  if (!canManage(project, user)) throw new HttpError(403, "Somente o gerente pode solicitar recomendações.");
  const mode = getAiMode();
  if (mode === "offline") throw aiUnavailable();
  return recommend(task, project.equipeIds, mode === "fallback");
}, true);

on("post", "/api/ia/recomendar-responsaveis/decisao", (req) => {
  currentUser(req);
  const body = json<{ tarefaId: number; decisao: string; usuarioEscolhidoId: number | null; motivo?: string }>(req.body);
  db.decisions.push({ ...body, createdAt: now() });
  return {};
});

function aiProject(req: MockRequest) {
  if (getAiMode() !== "normal") throw aiUnavailable();
  const user = currentUser(req);
  return { user, project: findProject(Number(req.query.projetoId), user) };
}

on("get", "/api/ia/consultar", (req) => {
  const { user, project } = aiProject(req);
  const question = String(req.query.query ?? "").trim();
  if (!question) throw new HttpError(400, "Informe a pergunta.");
  return answer(project.id, question, user);
}, true);
on("get", "/api/ia/historico", (req) => {
  const user = currentUser(req);
  const project = findProject(Number(req.query.projetoId), user);
  return db.conversations.filter((c) => c.projetoId === project.id && c.usuarioId === user.id);
});
on("get", "/api/ia/resumo", (req) => {
  const { project } = aiProject(req);
  return summary(project.id, String(req.query.escopo ?? "PROJETO"));
}, true);
on("get", "/api/ia/gargalos", (req) => bottlenecks(aiProject(req).project.id), true);
on("post", "/api/ia/gerar-descricao", (req) => {
  if (getAiMode() !== "normal") throw aiUnavailable();
  const user = currentUser(req);
  const body = json<{ projetoId: number; tarefaId?: number; titulo: string; descricaoAtual?: string; instrucao?: string }>(req.body);
  findProject(body.projetoId, user);
  const tecnologias = db.tasks.find((t) => t.id === body.tarefaId)?.tecnologias ?? [];
  return describe({ ...body, tecnologias });
}, true);
on("get", "/api/ia/sugerir-dependencias", (req) => {
  if (getAiMode() !== "normal") throw aiUnavailable();
  const { task } = findTask(Number(req.query.tarefaId), currentUser(req));
  return dependencySuggestions(task);
}, true);

// ----------------------------------------------------------------- administração

function documentDto(d: (typeof db.documents)[number]) {
  const elapsed = Date.now() - d.enviadoEm;
  const status = elapsed < 3000 ? "PENDENTE" : elapsed < 9000 ? "PROCESSANDO" : d.falha ? "ERRO" : "PROCESSADO";
  return {
    id: d.id, nomeArquivo: d.nomeArquivo, tipoConteudo: d.tipoConteudo, tamanho: d.tamanho, projetoId: d.projetoId,
    createdAt: d.createdAt, status,
    mensagemErro: status === "ERRO" ? "Não foi possível extrair texto do arquivo." : null,
    quantidadeTrechos: status === "PROCESSADO" ? Math.ceil(d.tamanho / 4000) + 2 : null,
  };
}

on("get", "/api/admin/documentos", (req) => (requireAdmin(req), [...db.documents].reverse().map(documentDto)));
on("post", "/api/admin/documentos", (req) => {
  requireAdmin(req);
  const form = req.body as FormData;
  const file = form.get("arquivo") as File | null;
  if (!file) throw new HttpError(400, "Envie um arquivo.");
  const projetoId = form.get("projetoId");
  const doc = {
    id: nextId(), nomeArquivo: file.name, tipoConteudo: file.type || "text/plain", tamanho: file.size,
    projetoId: projetoId ? Number(projetoId) : null, enviadoEm: Date.now(),
    falha: /erro|corromp/i.test(file.name), createdAt: now(),
  };
  db.documents.push(doc);
  return documentDto(doc);
});
on("delete", "/api/admin/documentos/:id", (req) => {
  requireAdmin(req);
  db.documents = db.documents.filter((d) => d.id !== id(req.params.id));
});

on("get", "/api/admin/regras-dominio", (req) => (requireAdmin(req), db.rules));
on("post", "/api/admin/regras-dominio", (req) => {
  requireAdmin(req);
  const body = json<{ regra: string; ativa?: boolean }>(req.body);
  if (!body.regra?.trim()) throw new HttpError(400, "Dados inválidos.", { regra: "Escreva a regra." });
  const rule = { id: nextId(), regra: body.regra.trim(), ativa: body.ativa ?? true, createdAt: now() };
  db.rules.unshift(rule);
  return rule;
});
on("put", "/api/admin/regras-dominio/:id", (req) => {
  requireAdmin(req);
  const rule = db.rules.find((r) => r.id === id(req.params.id));
  if (!rule) throw new HttpError(404, "Regra não encontrada.");
  Object.assign(rule, json(req.body));
  return rule;
});
on("delete", "/api/admin/regras-dominio/:id", (req) => {
  requireAdmin(req);
  db.rules = db.rules.filter((r) => r.id !== id(req.params.id));
});

on("get", "/api/admin/vocabulario", (req) => (requireAdmin(req), db.terms));
on("post", "/api/admin/vocabulario", (req) => {
  requireAdmin(req);
  const term = { id: nextId(), ...json<{ termo: string; definicao: string; sinonimos: string[] }>(req.body) };
  db.terms.push(term);
  return term;
});
on("put", "/api/admin/vocabulario/:id", (req) => {
  requireAdmin(req);
  const term = db.terms.find((t) => t.id === id(req.params.id));
  if (!term) throw new HttpError(404, "Termo não encontrado.");
  Object.assign(term, json(req.body));
  return term;
});
on("delete", "/api/admin/vocabulario/:id", (req) => {
  requireAdmin(req);
  db.terms = db.terms.filter((t) => t.id !== id(req.params.id));
});
