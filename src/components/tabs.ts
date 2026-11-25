import type { KeyboardEvent } from "react";

/**
 * Navegação por teclado de abas (padrão WAI-ARIA): setas esquerda/direita,
 * Home e End movem o foco e ativam a aba. Use no elemento role="tablist" e
 * deixe apenas a aba selecionada com tabIndex 0.
 */
export function handleTabListKeyDown(event: KeyboardEvent<HTMLElement>) {
  const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
  if (!keys.includes(event.key)) return;
  const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]'));
  const current = tabs.indexOf(document.activeElement as HTMLElement);
  if (current === -1 || tabs.length === 0) return;
  event.preventDefault();
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  tabs[next].focus();
  tabs[next].click();
}
