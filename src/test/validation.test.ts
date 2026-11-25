import { describe, expect, it } from "vitest";
import { loginSchema } from "@/features/auth/schemas/loginSchema";
import { registerSchema } from "@/features/auth/schemas/registerSchema";
import { projectSchema } from "@/features/projects/schemas/projectSchema";
import { taskSchema } from "@/features/tasks/schemas/taskSchema";
import { skillSchema } from "@/features/skills/schemas/skillSchema";
import { fillTemplate, formatBytes, formatDate, isPastDate } from "@/lib/format";

/** Mensagens de erro por campo, para comparar com o texto mostrado na tela. */
function errorsOf(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  const errors: Record<string, string> = {};
  for (const issue of result.error?.issues ?? []) {
    const key = String(issue.path[0]);
    errors[key] ??= issue.message;
  }
  return errors;
}

const validTask = {
  title: "Tela de login",
  content: "",
  requirements: "",
  technologies: ["React"],
  status: "TODO",
  priority: "HIGH",
  complexity: "",
  dueDate: "",
  assigneeId: "",
  dependencyIds: [],
};

describe("validação do login", () => {
  it("exige e-mail válido e senha", () => {
    expect(errorsOf(loginSchema.safeParse({ email: "", password: "" }))).toEqual({
      email: "Informe seu e-mail.",
      password: "Informe sua senha.",
    });
    expect(errorsOf(loginSchema.safeParse({ email: "ana@", password: "x" })).email).toMatch(/e-mail válido/i);
    expect(loginSchema.safeParse({ email: "ana@ex.com", password: "x" }).success).toBe(true);
  });
});

describe("validação do cadastro (mesmas regras do backend)", () => {
  it("username entre 3 e 50 caracteres, senha com 6+", () => {
    const errors = errorsOf(registerSchema.safeParse({ username: "an", email: "ana@ex.com", password: "123" }));
    expect(Object.keys(errors).sort()).toEqual(["password", "username"]);
    expect(registerSchema.safeParse({ username: "a".repeat(51), email: "ana@ex.com", password: "123456" }).success).toBe(false);
    expect(registerSchema.safeParse({ username: "ana", email: "ana@ex.com", password: "123456" }).success).toBe(true);
  });

  it("ignora espaços nas pontas do nome e do e-mail", () => {
    const parsed = registerSchema.parse({ username: "  ana  ", email: " ana@ex.com ", password: "123456" });
    expect(parsed).toMatchObject({ username: "ana", email: "ana@ex.com" });
  });
});

describe("validação de projeto", () => {
  it("exige nome e limita a 255 caracteres", () => {
    expect(errorsOf(projectSchema.safeParse({ name: "   ", description: "" })).name).toBeTruthy();
    expect(errorsOf(projectSchema.safeParse({ name: "x".repeat(256), description: "" })).name).toBeTruthy();
    expect(projectSchema.safeParse({ name: "Sistema RAG", description: "" }).success).toBe(true);
  });
});

describe("validação de tarefa", () => {
  it("aceita uma tarefa mínima", () => {
    expect(taskSchema.safeParse(validTask).success).toBe(true);
  });

  it("recusa título vazio, prioridade inválida e prazo malformado", () => {
    const errors = errorsOf(
      taskSchema.safeParse({ ...validTask, title: " ", priority: "MAXIMA", dueDate: "31/12/2026" }),
    );
    expect(Object.keys(errors).sort()).toEqual(["dueDate", "priority", "title"]);
  });

  it("limita tecnologias e o tamanho dos textos", () => {
    const tooMany = Array.from({ length: 31 }, (_, i) => `tec${i}`);
    expect(errorsOf(taskSchema.safeParse({ ...validTask, technologies: tooMany })).technologies).toBeTruthy();
    expect(errorsOf(taskSchema.safeParse({ ...validTask, content: "x".repeat(5001) })).content).toBeTruthy();
    expect(errorsOf(taskSchema.safeParse({ ...validTask, requirements: "x".repeat(10_001) })).requirements).toBeTruthy();
  });

  it("aceita complexidade de 1 a 5 ou vazia", () => {
    expect(taskSchema.safeParse({ ...validTask, complexity: "5" }).success).toBe(true);
    expect(taskSchema.safeParse({ ...validTask, complexity: "6" }).success).toBe(false);
  });

  it("aceita coluna personalizada como status", () => {
    expect(taskSchema.safeParse({ ...validTask, status: "EM_REVISAO" }).success).toBe(true);
  });
});

describe("validação de competência", () => {
  it("exige ao menos uma tecnologia, tipo de atividade e nível", () => {
    const errors = errorsOf(skillSchema.safeParse({ technologies: [], activityType: "", level: "" }));
    expect(Object.keys(errors).sort()).toEqual(["activityType", "level", "technologies"]);
  });
});

describe("formatação", () => {
  it("preenche modelos de texto e mantém marcadores desconhecidos", () => {
    expect(fillTemplate("{count} tarefa(s) em {name}", { count: 3, name: "RAG" })).toBe("3 tarefa(s) em RAG");
    expect(fillTemplate("Olá {nome}", {})).toBe("Olá {nome}");
  });

  it("formata datas sem deslocar o dia por fuso horário", () => {
    expect(formatDate("2026-03-01")).toBe("01/03/2026");
    expect(formatDate(null)).toBe("");
    expect(formatDate("data inválida")).toBe("");
  });

  it("identifica prazos vencidos", () => {
    expect(isPastDate("2000-01-01")).toBe(true);
    expect(isPastDate("2999-01-01")).toBe(false);
    expect(isPastDate(null)).toBe(false);
  });

  it("formata tamanhos de arquivo", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(-1)).toBe("");
  });
});
