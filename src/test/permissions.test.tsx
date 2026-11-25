import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { User, UserRole } from "@/features/auth/types";
import { getProjectPermissions } from "@/features/projects/permissions";
import { Header } from "@/components/Header";
import { makeProject } from "./fixtures";

const auth = vi.hoisted(() => ({ user: null as User | null }));
vi.mock("@/features/auth/hooks/AuthContext", () => ({
  useAuth: () => ({ user: auth.user, logout: vi.fn() }),
}));

import { AdminRoute } from "@/app/router";

const userWith = (id: number, roles: UserRole[]): User => ({
  id,
  username: `u${id}`,
  email: `u${id}@ex.com`,
  roles,
});

const ADMIN = userWith(9, ["ADMIN"]);
const MANAGER = userWith(1, ["MANAGER"]);
const MEMBER = userWith(2, ["MEMBER"]);
const OUTSIDER = userWith(50, ["MEMBER"]);

describe("permissões no projeto por perfil", () => {
  // O backend devolve canManage/myRole já calculados para quem consulta; o
  // frontend só decide o que mostrar a partir deles.
  const cases = [
    {
      profile: "Administrador (fora da equipe)",
      user: ADMIN,
      project: makeProject({ canManage: true, myRole: null }),
      expected: { canEditTasks: true, canDeleteTasks: true, canManageColumns: true, canDecideAssignment: true, canCollaborate: true },
    },
    {
      profile: "Gerente do projeto",
      user: MANAGER,
      project: makeProject({ canManage: true, myRole: "MANAGER" }),
      expected: { canEditTasks: true, canDeleteTasks: true, canManageColumns: true, canDecideAssignment: true, canCollaborate: true },
    },
    {
      profile: "Membro da equipe",
      user: MEMBER,
      project: makeProject({ canManage: false, myRole: "MEMBER" }),
      expected: { canEditTasks: true, canDeleteTasks: false, canManageColumns: false, canDecideAssignment: false, canCollaborate: true },
    },
    {
      profile: "Usuário fora da equipe",
      user: OUTSIDER,
      project: makeProject({ canManage: false, myRole: null }),
      expected: { canEditTasks: false, canDeleteTasks: false, canManageColumns: false, canDecideAssignment: false, canCollaborate: false },
    },
  ];

  it.each(cases)("$profile", ({ user, project, expected }) => {
    expect(getProjectPermissions(project, user)).toMatchObject(expected);
  });

  it.each([ADMIN, MANAGER, MEMBER])("projeto arquivado é somente leitura para todos (%#)", (user) => {
    const project = makeProject({ archived: true, canManage: true, myRole: "MANAGER" });
    expect(getProjectPermissions(project, user)).toMatchObject({
      canEditTasks: false,
      canDeleteTasks: false,
      canManageColumns: false,
      canDecideAssignment: false,
      canCollaborate: false,
    });
  });

  it("competências: cada um edita as suas; o Administrador edita as de todos", () => {
    const project = makeProject();
    expect(getProjectPermissions(project, MEMBER).canEditSkillsOf(MEMBER.id!)).toBe(true);
    expect(getProjectPermissions(project, MEMBER).canEditSkillsOf(MANAGER.id!)).toBe(false);
    expect(getProjectPermissions(project, MANAGER).canEditSkillsOf(MEMBER.id!)).toBe(false);
    expect(getProjectPermissions(project, ADMIN).canEditSkillsOf(MEMBER.id!)).toBe(true);
  });

  it("sem sessão nada é liberado", () => {
    const permissions = getProjectPermissions(makeProject({ canManage: false, myRole: null }), null);
    expect(permissions.canEditTasks).toBe(false);
    expect(permissions.canEditSkillsOf(1)).toBe(false);
  });
});

describe("área administrativa por perfil", () => {
  function renderAt(user: User | null) {
    auth.user = user;
    render(
      <MemoryRouter initialEntries={["/admin/conhecimento"]}>
        <Routes>
          <Route element={<AdminRoute />}>
            <Route path="/admin/conhecimento" element={<p>Área do administrador</p>} />
          </Route>
          <Route path="/unauthorized" element={<p>Acesso negado</p>} />
          <Route path="/login" element={<p>Tela de login</p>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("Administrador acessa", () => {
    renderAt(ADMIN);
    expect(screen.getByText("Área do administrador")).toBeInTheDocument();
  });

  it.each([
    ["Gerente", MANAGER],
    ["Membro", MEMBER],
  ])("%s é bloqueado", (_, user) => {
    renderAt(user);
    expect(screen.getByText("Acesso negado")).toBeInTheDocument();
  });

  it("sem sessão vai para o login", () => {
    renderAt(null);
    expect(screen.getByText("Tela de login")).toBeInTheDocument();
  });

  it.each([
    ["ADMIN", true],
    ["MANAGER", false],
    ["MEMBER", false],
  ] as const)("menu mostra a base de conhecimento só para Administrador (%s)", (role, visible) => {
    render(
      <MemoryRouter>
        <Header user={{ username: "ana", email: "ana@ex.com", roles: [role] }} logout={vi.fn()} />
      </MemoryRouter>,
    );
    const nav = screen.getByRole("navigation", { name: /principal/i });
    expect(nav.querySelector('a[href="/admin/conhecimento"]') != null).toBe(visible);
    expect(screen.getByRole("link", { name: "Projetos" })).toBeInTheDocument();
  });
});
