import { getAiErrorKind, getErrorMessage } from "@/lib/apiError";

export type AiState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "error"; message: string }
  | { status: "success"; data: T };

/** Converte a falha em estado; nunca gera conteúdo substituto localmente. */
export function aiFailure(error: unknown, fallback: string): AiState<never> {
  return getAiErrorKind(error) === "unavailable"
    ? { status: "unavailable" }
    : { status: "error", message: getErrorMessage(error, fallback) };
}
