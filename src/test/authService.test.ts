import { describe, expect, it } from "vitest";
import { extractRoles, extractToken } from "@/features/auth/services/authService";
import { decodeJwt, isTokenExpired } from "@/lib/session";

function fakeJwt(payload: Record<string, unknown>) {
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${b64({ alg: "HS256" })}.${b64(payload)}.assinatura`;
}

describe("contrato de autenticação com o backend", () => {
  it("aceita o JWT em texto puro (resposta atual do AuthController)", () => {
    expect(extractToken("abc.def.ghi\n")).toBe("abc.def.ghi");
  });

  it("aceita o JWT em { token } (formato esperado pelos testes do backend)", () => {
    expect(extractToken({ token: "abc.def.ghi" })).toBe("abc.def.ghi");
  });

  it("falha sem token", () => {
    expect(() => extractToken("")).toThrow();
    expect(() => extractToken({})).toThrow();
  });

  it("lê o e-mail do sub e a expiração do JWT", () => {
    const token = fakeJwt({ sub: "joao@exemplo.com", exp: Math.floor(Date.now() / 1000) + 3600 });
    expect(decodeJwt(token)?.sub).toBe("joao@exemplo.com");
    expect(isTokenExpired(token)).toBe(false);
    expect(isTokenExpired(fakeJwt({ sub: "a@b.com", exp: 1 }))).toBe(true);
  });

  it("converte os papéis do JWT para os nomes do frontend", () => {
    expect(extractRoles(fakeJwt({ sub: "a@b.com" }))).toEqual([]);
    expect(
      extractRoles(fakeJwt({ roles: ["ROLE_GERENTE", "ROLE_DESCONHECIDO", "MEMBRO"] })),
    ).toEqual(["MANAGER", "MEMBER"]);
    expect(extractRoles(fakeJwt({ authorities: [{ authority: "ROLE_ADMINISTRADOR" }] }))).toEqual([
      "ADMIN",
    ]);
  });
});
