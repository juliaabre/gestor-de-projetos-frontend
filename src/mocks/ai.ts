import { db, nextId, type MockTask, type MockUser } from "./db";

/** Lógica "de IA" simulada: determinística e calculada a partir dos dados do banco em memória. */

const DONE = ["CONCLUIDA", "CANCELADA"];
const LEVEL_WEIGHT: Record<string, number> = { INICIANTE: 0, INTERMEDIARIO: 0.08, AVANCADO: 0.16, ESPECIALISTA: 0.22 };
const LEVEL_LABEL: Record<string, string> = {
  INICIANTE: "iniciante", INTERMEDIARIO: "intermediário", AVANCADO: "avançado", ESPECIALISTA: "especialista",
};

const lower = (list: string[]) => list.map((item) => item.toLowerCase());
export const isActive = (task: MockTask) => !DONE.includes(task.status);
const userById = (id: number) => db.users.find((u) => u.id === id);
const taskRef = (task: MockTask) => ({ id: task.id, titulo: task.titulo });
const taskSource = (task: MockTask) => ({ tipo: "TAREFA", id: task.id, titulo: task.titulo });

export function activeLoad(userId: number) {
  return db.tasks.filter((t) => t.responsavelId === userId && isActive(t)).length;
}

export function recommend(task: MockTask, team: number[], simple: boolean) {
  const wanted = lower(task.tecnologias);
  const items = team
    .map((userId) => {
      const user = userById(userId)!;
      const skills = db.skills.filter((s) => s.usuarioId === userId);
      const matching = skills.filter((s) => lower(s.tecnologias).some((tech) => wanted.includes(tech)));
      const matchedTechs = [...new Set(matching.flatMap((s) => s.tecnologias).filter((t) => wanted.includes(t.toLowerCase())))];
      const bestLevel = matching.map((s) => s.nivelExperiencia).sort((a, b) => (LEVEL_WEIGHT[b] ?? 0) - (LEVEL_WEIGHT[a] ?? 0))[0];
      const load = activeLoad(userId);
      const history = db.tasks.filter(
        (t) => t.responsavelId === userId && t.status === "CONCLUIDA" && lower(t.tecnologias).some((x) => wanted.includes(x)),
      );
      const raw =
        0.3 + Math.min(matchedTechs.length, 3) * 0.14 + (simple ? 0 : (LEVEL_WEIGHT[bestLevel] ?? 0)) +
        Math.min(history.length, 3) * 0.04 - load * 0.07;
      const adequacao = Math.max(0.05, Math.min(0.97, raw));

      let justificativa: string;
      if (simple) {
        justificativa = `Pontuação simples: ${matchedTechs.length} competência(s) compatível(is) e ${load} tarefa(s) ativa(s).`;
      } else if (matchedTechs.length > 0) {
        justificativa =
          `Domina ${matchedTechs.join(", ")} (nível ${LEVEL_LABEL[bestLevel] ?? "não informado"})` +
          (history.length ? ` e já concluiu ${history.length} tarefa(s) parecida(s)` : "") +
          ".";
      } else {
        justificativa = "Sem competências registradas nas tecnologias da tarefa.";
      }
      if (!simple && load >= 3) justificativa += ` Carga alta (${load} tarefas ativas): considere redistribuir.`;

      return {
        usuarioId: userId,
        username: user.username,
        adequacao: Math.round(adequacao * 100) / 100,
        justificativa,
        competencias: matchedTechs.length ? matchedTechs : skills.flatMap((s) => s.tecnologias).slice(0, 3),
        cargaAtual: load,
        fontes: simple ? [] : history.map(taskSource),
      };
    })
    .sort((a, b) => b.adequacao - a.adequacao);

  return { recomendacaoId: nextId(), modo: simple ? "PONTUACAO_SIMPLES" : "IA", recomendacoes: items };
}

export function bottlenecks(projectId: number) {
  const project = db.projects.find((p) => p.id === projectId)!;
  const tasks = db.tasks.filter((t) => t.projetoId === projectId);
  const result: unknown[] = [];

  for (const userId of project.equipeIds) {
    const mine = tasks.filter((t) => t.responsavelId === userId && isActive(t));
    if (mine.length >= 3) {
      const user = userById(userId)!;
      result.push({
        tipo: "MEMBRO_SOBRECARREGADO",
        severidade: mine.length >= 4 ? "ALTA" : "MEDIA",
        descricao: `${user.username} tem ${mine.length} tarefas ativas, acima da média da equipe.`,
        tarefas: mine.map(taskRef),
        usuarios: [{ id: user.id, username: user.username }],
      });
    }
  }
  const weekAgo = Date.now() - 7 * 86_400_000;
  for (const task of tasks.filter((t) => t.status === "EM_ANDAMENTO" && Date.parse(t.updatedAt) < weekAgo)) {
    const days = Math.floor((Date.now() - Date.parse(task.updatedAt)) / 86_400_000);
    const owner = task.responsavelId ? userById(task.responsavelId) : undefined;
    result.push({
      tipo: "TAREFA_PARADA",
      severidade: days > 14 ? "ALTA" : "MEDIA",
      descricao: `"${task.titulo}" está em andamento sem alterações há ${days} dias.`,
      tarefas: [taskRef(task)],
      usuarios: owner ? [{ id: owner.id, username: owner.username }] : [],
    });
  }
  for (const task of tasks.filter(isActive)) {
    const dependents = tasks.filter((t) => isActive(t) && t.dependenciasIds.includes(task.id));
    if (dependents.length >= 2) {
      result.push({
        tipo: "DEPENDENCIA_BLOQUEANTE",
        severidade: "ALTA",
        descricao: `${dependents.length} tarefas dependem de "${task.titulo}", que ainda não foi concluída.`,
        tarefas: [taskRef(task), ...dependents.map(taskRef)],
        usuarios: [],
      });
    }
  }
  return result;
}

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: "a fazer", EM_ANDAMENTO: "em andamento", EM_REVISAO: "em revisão", CONCLUIDA: "concluídas", CANCELADA: "canceladas",
};

export function summary(projectId: number, scope: string) {
  const since = scope === "SPRINT" ? Date.now() - 14 * 86_400_000 : 0;
  const tasks = db.tasks.filter((t) => t.projetoId === projectId && Date.parse(t.updatedAt) >= since);
  const counts = new Map<string, number>();
  for (const t of tasks) counts.set(t.status, (counts.get(t.status) ?? 0) + 1);
  const done = counts.get("CONCLUIDA") ?? 0;
  const percent = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = tasks.filter((t) => isActive(t) && t.prazo && t.prazo < today);
  const unassigned = tasks.filter((t) => isActive(t) && !t.responsavelId);

  const parts = [
    `${scope === "SPRINT" ? "Na sprint atual (últimos 14 dias)" : "No projeto"} há ${tasks.length} tarefa(s), ${percent}% concluídas.`,
    [...counts.entries()].map(([status, n]) => `${n} ${STATUS_LABEL[status] ?? status.toLowerCase()}`).join(", ") + ".",
  ];
  if (overdue.length) parts.push(`Com prazo vencido: ${overdue.map((t) => `"${t.titulo}"`).join(", ")}.`);
  if (unassigned.length) parts.push(`Sem responsável: ${unassigned.map((t) => `"${t.titulo}"`).join(", ")}.`);
  if (!overdue.length && !unassigned.length) parts.push("Nenhuma tarefa atrasada ou sem responsável.");

  return {
    resumo: parts.join(" "),
    geradoEm: new Date().toISOString(),
    fontes: [...overdue, ...unassigned].slice(0, 4).map(taskSource),
  };
}

export function answer(projectId: number, question: string, user: MockUser) {
  const q = question.toLowerCase();
  const project = db.projects.find((p) => p.id === projectId)!;
  const tasks = db.tasks.filter((t) => t.projetoId === projectId);
  let resposta: string;
  let fontes: unknown[] = [];
  let gargalos: unknown[] = [];

  if (/sobrecarreg|carga|ocupad/.test(q)) {
    const loads = project.equipeIds
      .map((id) => ({ user: userById(id)!, tasks: tasks.filter((t) => t.responsavelId === id && isActive(t)) }))
      .sort((a, b) => b.tasks.length - a.tasks.length);
    const top = loads[0];
    const lightest = loads[loads.length - 1];
    const rest = loads.slice(1, -1);
    resposta =
      `${top.user.username} tem ${top.tasks.length} tarefa(s) ativa(s), a maior carga da equipe. ` +
      `${lightest.user.username} tem ${lightest.tasks.length} e é quem tem mais disponibilidade.` +
      (rest.length ? ` Demais: ${rest.map((l) => `${l.user.username} (${l.tasks.length})`).join(", ")}.` : "");
    fontes = top.tasks.map(taskSource);
    gargalos = bottlenecks(projectId).filter((b) => (b as { tipo: string }).tipo === "MEMBRO_SOBRECARREGADO");
  } else if (/atras|prazo|venc/.test(q)) {
    const today = new Date().toISOString().slice(0, 10);
    const overdue = tasks.filter((t) => isActive(t) && t.prazo && t.prazo < today);
    resposta = overdue.length
      ? `Há ${overdue.length} tarefa(s) com prazo vencido: ${overdue.map((t) => `"${t.titulo}" (prazo ${t.prazo!.split("-").reverse().join("/")})`).join(", ")}.`
      : "Nenhuma tarefa ativa está com o prazo vencido.";
    fontes = overdue.map(taskSource);
  } else if (/gargal|bloque|depend|parad/.test(q)) {
    gargalos = bottlenecks(projectId);
    resposta = gargalos.length
      ? `Identifiquei ${gargalos.length} possível(is) gargalo(s) no projeto. Veja os alertas abaixo.`
      : "Não identifiquei gargalos: nenhuma tarefa parada, dependência bloqueante ou integrante sobrecarregado.";
  } else if (/document|guia|api|polític|regra/.test(q)) {
    const docs = db.documents.filter((d) => !d.falha && (d.projetoId == null || d.projetoId === projectId));
    resposta = docs.length
      ? `Segundo a documentação indexada, as rotas da API exigem autenticação JWT, exceto login e cadastro, e empréstimos têm prazo padrão de 14 dias.`
      : "Não há documentos indexados acessíveis para este projeto.";
    fontes = docs.map((d) => ({ tipo: "DOCUMENTO", id: d.id, titulo: d.nomeArquivo, trecho: "Trecho relevante do documento." }));
  } else {
    const s = summary(projectId, "PROJETO");
    resposta = `${s.resumo} Pergunte, por exemplo, sobre carga da equipe, prazos, gargalos ou documentos.`;
    fontes = s.fontes;
  }

  const entry = {
    id: nextId(), projetoId: projectId, usuarioId: user.id, pergunta: question, resposta, fontes, gargalos,
    createdAt: new Date().toISOString(),
  };
  db.conversations.push(entry);
  return entry;
}

export function describe(input: { titulo: string; descricaoAtual?: string; instrucao?: string; tecnologias: string[] }) {
  const techs = input.tecnologias.length ? input.tecnologias.join(", ") : "as tecnologias do projeto";
  const base = input.descricaoAtual
    ? `${input.descricaoAtual.trim().replace(/\.?$/, ".")} `
    : `Implementar ${input.titulo.charAt(0).toLowerCase()}${input.titulo.slice(1)} utilizando ${techs}. `;
  const descricao =
    `${base}\n\nEscopo:\n- Implementar a funcionalidade com ${techs}.\n- Tratar erros e validações de entrada.\n- Cobrir as regras principais com testes automatizados.` +
    `\n\nCritérios de aceite:\n- A funcionalidade atende aos requisitos descritos.\n- Falhas exibem mensagens claras ao usuário.` +
    (input.instrucao ? `\n\nObservação considerada: ${input.instrucao}` : "");
  return {
    descricao,
    justificativa: input.descricaoAtual
      ? "Descrição refinada com escopo e critérios de aceite, a partir do texto atual."
      : "Gerada a partir do título, das tecnologias e de tarefas semelhantes do projeto.",
    fontes: db.documents.filter((d) => !d.falha).slice(0, 1).map((d) => ({ tipo: "DOCUMENTO", id: d.id, titulo: d.nomeArquivo })),
  };
}

export function dependencySuggestions(task: MockTask) {
  const words = (text: string) => new Set(text.toLowerCase().split(/\W+/u).filter((w) => w.length > 4));
  const mine = words(task.titulo);
  const techs = lower(task.tecnologias);
  return db.tasks
    .filter((t) => t.projetoId === task.projetoId && t.id !== task.id && !task.dependenciasIds.includes(t.id))
    .map((t) => {
      const shared = t.tecnologias.filter((x) => techs.includes(x.toLowerCase()));
      const commonWords = [...words(t.titulo)].filter((w) => mine.has(w));
      const score = shared.length * 0.3 + commonWords.length * 0.25 + (t.status === "CONCLUIDA" ? -0.2 : 0);
      return { t, shared, commonWords, score };
    })
    .filter((s) => s.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ t, shared, commonWords }) => ({
      tarefaId: t.id,
      titulo: t.titulo,
      justificativa: shared.length
        ? `Usa as mesmas tecnologias (${shared.join(", ")}) e provavelmente precisa estar pronta antes.`
        : `Trata do mesmo assunto (${commonWords.join(", ")}).`,
      confianca: Math.min(0.9, 0.45 + shared.length * 0.15 + commonWords.length * 0.1),
    }));
}
