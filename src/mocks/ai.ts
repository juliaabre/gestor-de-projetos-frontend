import { db, type MockProject, type MockTask } from "./db";

/**
 * IA simulada: determinística, calculada a partir do banco em memória e no
 * formato `Resposta` do backend. Com `fallback`, imita o backend sem o
 * Gemini: devolve os dados recuperados, `alternativa: true` e um aviso.
 */

const DONE = ["CONCLUIDA", "CANCELADA"];
const lower = (list: string[]) => list.map((item) => item.toLowerCase());
export const isActive = (task: MockTask) => !DONE.includes(task.status);
const userName = (id: number | null) => db.users.find((u) => u.id === id)?.username ?? "sem responsável";
const projectTasks = (projectId: number) => db.tasks.filter((t) => t.projetoId === projectId);

const FALLBACK_NOTICE = "Resposta extrativa; confirme os dados nas fontes. Nenhuma decisão foi aplicada.";

interface Source {
  id: string;
  tipo: string;
  recursoId: number;
  titulo: string;
  pagina: number | null;
  trecho: string;
  similaridade: number;
}

export function taskSource(task: MockTask, similaridade = 1): Source {
  return {
    id: `T${task.id}`,
    tipo: "TAREFA",
    recursoId: task.id,
    titulo: task.titulo,
    pagina: null,
    trecho: `Tarefa ${task.id}: ${task.titulo}. Status: ${task.status}. Prioridade: ${task.prioridade}. Responsável: ${userName(task.responsavelId)}. Prazo: ${task.prazo ?? "sem prazo"}.`,
    similaridade,
  };
}

function projectSource(project: MockProject): Source {
  const tasks = projectTasks(project.id);
  const counts: Record<string, number> = {};
  for (const t of tasks) counts[t.status] = (counts[t.status] ?? 0) + 1;
  return {
    id: `P${project.id}`,
    tipo: "PROJETO",
    recursoId: project.id,
    titulo: project.nome,
    pagina: null,
    trecho: `Total de tarefas: ${tasks.length}. Distribuição por status: ${JSON.stringify(counts)}. Projeto: ${project.nome}.`,
    similaridade: 1,
  };
}

function answer(text: string, fontes: Source[], fallback: boolean) {
  if (!fallback) return { resposta: text, fontes, alternativa: false, aviso: null };
  const extract = fontes.map((f) => `[${f.id}] ${f.trecho}`).join("\n\n");
  return {
    resposta: `Síntese automática indisponível. Dados recuperados (sem interpretação do modelo):\n${extract || "Nenhum dado relevante encontrado."}`,
    fontes,
    alternativa: true,
    aviso: FALLBACK_NOTICE,
  };
}

// ---- recomendação -------------------------------------------------------

/** Mesma fórmula do backend: tecnologia, atividade, experiência, entrega e carga (0–100). */
export function recommend(task: MockTask, project: MockProject, fallback: boolean) {
  const wanted = lower(task.tecnologias);
  const ranking = project.equipeIds
    .map((userId) => {
      const mine = db.skills.filter((s) => s.usuarioId === userId);
      const matched = mine.filter((s) => wanted.includes(s.tecnologia.toLowerCase()));
      const technology = wanted.length ? matched.length / wanted.length : 0;
      const activity = matched.length ? Math.max(...matched.map((s) => s.nivel)) / 5 : 0;
      const tasks = projectTasks(project.id).filter((t) => t.responsavelId === userId);
      const completed = tasks.filter((t) => t.status === "CONCLUIDA").length;
      const closed = tasks.filter((t) => DONE.includes(t.status)).length;
      const open = tasks.filter(isActive).length;
      const experience = Math.min(completed / 5, 1);
      const delivery = closed ? completed / closed : 0;
      const score = 45 * technology + 15 * activity + 10 * experience + 10 * delivery + 20 / (1 + open);
      return {
        usuarioId: userId,
        pontuacao: Math.round(score * 100) / 100,
        justificativa:
          `Aderência tecnológica: ${Math.round(technology * 100)}%. Aderência ao tipo de atividade: ${Math.round(activity * 100)}%. ` +
          `No projeto: ${completed} conclusões no histórico, ${open} tarefas abertas. Taxa de conclusão entre tarefas encerradas: ` +
          (closed ? `${Math.round(delivery * 100)}%.` : "sem tarefas encerradas."),
        fontes: [`T${task.id}`, `P${project.id}`],
      };
    })
    .sort((a, b) => b.pontuacao - a.pontuacao || a.usuarioId - b.usuarioId);

  const best = ranking[0];
  const contexto = answer(
    best
      ? `${userName(best.usuarioId)} tem a maior aderência às tecnologias de "${task.titulo}" considerando a carga atual no projeto.`
      : "Nenhum integrante disponível.",
    [taskSource(task), projectSource(project)],
    fallback,
  );
  return { ranking, contexto };
}

// ---- assistente, resumo e gargalos --------------------------------------

export function consult(project: MockProject, question: string, fallback: boolean) {
  const q = question.toLowerCase();
  const tasks = projectTasks(project.id);
  const today = new Date().toISOString().slice(0, 10);

  if (/atras|prazo|venc/.test(q)) {
    const overdue = tasks.filter((t) => isActive(t) && t.prazo && t.prazo < today);
    return answer(
      overdue.length
        ? `Há ${overdue.length} tarefa(s) com prazo vencido: ${overdue.map((t) => `"${t.titulo}" [T${t.id}]`).join(", ")}.`
        : "Nenhuma tarefa ativa está com o prazo vencido [P" + project.id + "].",
      overdue.length ? overdue.map((t) => taskSource(t)) : [projectSource(project)],
      fallback,
    );
  }
  if (/carga|sobrecarreg|ocupad|quem/.test(q)) {
    const loads = project.equipeIds
      .map((id) => ({ id, open: tasks.filter((t) => t.responsavelId === id && isActive(t)) }))
      .sort((a, b) => b.open.length - a.open.length);
    const top = loads[0];
    return answer(
      `${userName(top.id)} tem ${top.open.length} tarefa(s) abertas, a maior carga da equipe. ` +
        loads.slice(1).map((l) => `${userName(l.id)}: ${l.open.length}`).join("; ") + ".",
      top.open.map((t) => taskSource(t)),
      fallback,
    );
  }
  const docs = db.documents.filter((d) => d.projetoId === project.id);
  if (/document|guia|api|polític|empr[ée]stimo/.test(q) && docs.length) {
    const fontes = docs.flatMap((d) =>
      d.trechos.map((trecho, i) => ({
        id: `D${d.id}-${i + 1}`, tipo: "DOCUMENTO", recursoId: d.id, titulo: d.nome, pagina: i + 1, trecho, similaridade: 0.8,
      })),
    );
    return answer(`Segundo a documentação do projeto: ${fontes.map((f) => `${f.trecho} [${f.id}]`).join(" ")}`, fontes, fallback);
  }
  return answer(
    `O projeto "${project.nome}" tem ${tasks.length} tarefa(s), ${tasks.filter(isActive).length} ainda abertas [P${project.id}]. ` +
      "Pergunte, por exemplo, sobre prazos, carga da equipe ou documentos.",
    [projectSource(project)],
    fallback,
  );
}

export function summary(project: MockProject, start: string | null, end: string | null, fallback: boolean) {
  const tasks = projectTasks(project.id).filter(
    (t) => (!start || (t.prazo && t.prazo >= start)) && (!end || (t.prazo && t.prazo <= end)),
  );
  const done = tasks.filter((t) => t.status === "CONCLUIDA").length;
  const percent = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const unassigned = tasks.filter((t) => isActive(t) && !t.responsavelId);
  const period = start || end ? ` com prazo ${start ? `a partir de ${start}` : ""}${start && end ? " e " : ""}${end ? `até ${end}` : ""}` : "";
  const text =
    `Há ${tasks.length} tarefa(s)${period}, ${percent}% concluídas [P${project.id}].` +
    (unassigned.length ? ` Sem responsável: ${unassigned.map((t) => `"${t.titulo}" [T${t.id}]`).join(", ")}.` : " Todas as tarefas abertas têm responsável.");
  return answer(text, [projectSource(project), ...unassigned.map((t) => taskSource(t))], fallback);
}

export function bottlenecks(project: MockProject, fallback: boolean) {
  const tasks = projectTasks(project.id);
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = Date.now() - 7 * 86_400_000;
  const overdue = tasks.filter((t) => isActive(t) && t.prazo && t.prazo < today);
  const stalled = tasks.filter((t) => t.status === "EM_ANDAMENTO" && Date.parse(t.updatedAt) < weekAgo);
  const loads = project.equipeIds.map((id) => ({ id, open: tasks.filter((t) => t.responsavelId === id && isActive(t)).length }));
  const avg = loads.reduce((sum, l) => sum + l.open, 0) / Math.max(loads.length, 1);
  const overloaded = loads.filter((l) => l.open >= 3 && l.open > avg * 1.5);
  const indicators: Source = {
    id: "G1", tipo: "INDICADORES", recursoId: project.id, titulo: "Indicadores de gargalo", pagina: null, similaridade: 1,
    trecho: `Carga média por integrante: ${avg.toFixed(1)}. Possível sobrecarga: ${overloaded.map((l) => userName(l.id)).join(", ") || "nenhuma"}. Atrasadas: ${overdue.length}. Em andamento sem atualização há mais de 7 dias: ${stalled.length}.`,
  };
  const parts = [
    overloaded.length ? `Sobrecarga: ${overloaded.map((l) => `${userName(l.id)} (${l.open} abertas)`).join(", ")}.` : "",
    overdue.length ? `Atrasadas: ${overdue.map((t) => `"${t.titulo}" [T${t.id}]`).join(", ")}.` : "",
    stalled.length ? `Paradas há mais de 7 dias: ${stalled.map((t) => `"${t.titulo}" [T${t.id}]`).join(", ")}.` : "",
  ].filter(Boolean);
  return answer(
    parts.length ? `Possíveis gargalos [G1]: ${parts.join(" ")}` : "Nenhum gargalo identificado: sem atrasos, tarefas paradas ou sobrecarga [G1].",
    [indicators, ...overdue.map((t) => taskSource(t)), ...stalled.map((t) => taskSource(t))],
    fallback,
  );
}

// ---- descrição e dependências -------------------------------------------

export function describe(task: MockTask, pergunta: string, fallback: boolean) {
  const techs = task.tecnologias.length ? task.tecnologias.join(", ") : "as tecnologias do projeto";
  const base = task.conteudo?.trim()
    ? `${task.conteudo.trim().replace(/\.?$/, ".")} `
    : `Implementar ${task.titulo.charAt(0).toLowerCase()}${task.titulo.slice(1)} utilizando ${techs}. `;
  const instruction = /Instrução: (.+)/.exec(pergunta)?.[1];
  const text =
    `${base}\n\nEscopo:\n- Implementar a funcionalidade com ${techs}.\n- Tratar erros e validações de entrada.\n- Cobrir as regras principais com testes automatizados.` +
    `\n\nCritérios de aceite:\n- A funcionalidade atende aos requisitos descritos.\n- Falhas exibem mensagens claras ao usuário.` +
    (instruction ? `\n\nObservação considerada: ${instruction}` : "");
  return answer(text, [taskSource(task)], fallback);
}

export function dependencies(task: MockTask, fallback: boolean) {
  const words = (text: string) => new Set(text.toLowerCase().split(/\W+/u).filter((w) => w.length > 4));
  const mine = words(task.titulo);
  const techs = lower(task.tecnologias);
  const related = projectTasks(task.projetoId)
    .filter((t) => t.id !== task.id && !task.dependenciasIds.includes(t.id))
    .map((t) => {
      const shared = t.tecnologias.filter((x) => techs.includes(x.toLowerCase())).length;
      const common = [...words(t.titulo)].filter((w) => mine.has(w)).length;
      return { t, score: shared * 0.3 + common * 0.25 + (t.status === "CONCLUIDA" ? -0.2 : 0) };
    })
    .filter((r) => r.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const fontes = [taskSource(task), ...related.map((r) => taskSource(r.t, Math.min(0.95, 0.5 + r.score)))];
  return answer(
    related.length
      ? `"${task.titulo}" provavelmente depende de ${related.map((r) => `"${r.t.titulo}" [T${r.t.id}]`).join(", ")}, que usam as mesmas tecnologias ou tratam do mesmo assunto.`
      : `Não encontrei pré-requisitos prováveis para "${task.titulo}" [T${task.id}].`,
    fontes,
    fallback,
  );
}
