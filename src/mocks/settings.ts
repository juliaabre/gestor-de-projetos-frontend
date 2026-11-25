export type AiMode = "normal" | "fallback" | "offline";

const KEY = "gestor.mock.ai";

export function getAiMode(): AiMode {
  const value = localStorage.getItem(KEY);
  return value === "fallback" || value === "offline" ? value : "normal";
}

export function setAiMode(mode: AiMode) {
  localStorage.setItem(KEY, mode);
}
