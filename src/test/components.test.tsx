import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FeedbackBanner, useFeedback } from "@/components/FeedbackBanner";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { TagInput } from "@/components/TagInput";
import { handleTabListKeyDown } from "@/components/tabs";

afterEach(() => vi.useRealTimers());

describe("estados padronizados", () => {
  it("carregamento é anunciado como status", () => {
    render(<LoadingState label="Carregando projetos..." />);
    expect(screen.getByRole("status")).toHaveTextContent("Carregando projetos...");
  });

  it("erro é anunciado como alerta e oferece nova tentativa", async () => {
    const onRetry = vi.fn();
    render(<ErrorState title="Falhou" message="Servidor fora do ar" onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("FalhouServidor fora do ar");
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("não repete a mensagem quando ela é igual ao título", () => {
    render(<ErrorState title="Falhou" message="Falhou" />);
    expect(screen.getAllByText("Falhou")).toHaveLength(1);
  });

  it("vazio mostra título, descrição e ação opcional", () => {
    render(
      <EmptyState title="Nada aqui" description="Crie o primeiro item">
        <button type="button">Criar</button>
      </EmptyState>,
    );
    expect(screen.getByText("Nada aqui")).toBeInTheDocument();
    expect(screen.getByText("Crie o primeiro item")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar" })).toBeInTheDocument();
  });
});

describe("mensagens de sucesso e falha", () => {
  function Harness() {
    const { feedback, success, error, clear } = useFeedback();
    return (
      <>
        <button type="button" onClick={() => success("Salvo!")}>ok</button>
        <button type="button" onClick={() => error("Deu erro")}>falha</button>
        <FeedbackBanner feedback={feedback} onClose={clear} />
      </>
    );
  }

  it("sucesso some sozinho após 5 s; erro permanece até fechar", async () => {
    vi.useFakeTimers();
    render(<Harness />);
    act(() => screen.getByRole("button", { name: "ok" }).click());
    expect(screen.getByRole("status")).toHaveTextContent("Salvo!");
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    act(() => screen.getByRole("button", { name: "falha" }).click());
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByRole("alert")).toHaveTextContent("Deu erro");
    act(() => screen.getByRole("button", { name: "Fechar" }).click());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("Modal acessível", () => {
  function Harness({ onClose = vi.fn() }: { onClose?: () => void }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>Abrir</button>
        {open && (
          <Modal
            title="Editar tarefa"
            description="Altere os campos"
            onClose={() => {
              onClose();
              setOpen(false);
            }}
          >
            <input aria-label="Título" />
            <button type="button">Salvar</button>
          </Modal>
        )}
      </>
    );
  }

  it("tem nome e descrição, foca o primeiro campo e devolve o foco ao fechar", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Abrir" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Editar tarefa" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("Altere os campos");
    expect(screen.getByLabelText("Título")).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("mantém o Tab dentro do diálogo", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    const field = screen.getByLabelText("Título");
    expect(field).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Salvar" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Fechar" })).toHaveFocus();
    await user.tab({ shift: true });
    await user.tab({ shift: true });
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Fechar" })).toHaveFocus();
  });

  it("Esc fecha apenas o diálogo de cima quando há dois abertos", async () => {
    const outerClose = vi.fn();
    const innerClose = vi.fn();
    render(
      <Modal title="Detalhes" onClose={outerClose}>
        <ConfirmDialog
          title="Excluir?"
          description="Não pode ser desfeito"
          confirmLabel="Excluir"
          confirmingLabel="Excluindo"
          onConfirm={async () => undefined}
          onClose={innerClose}
          getError={() => "erro"}
        />
      </Modal>,
    );
    await userEvent.keyboard("{Escape}");
    expect(innerClose).toHaveBeenCalledOnce();
    expect(outerClose).not.toHaveBeenCalled();
  });

  it("confirmação mostra o erro e continua aberta quando a ação falha", async () => {
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        title="Arquivar?"
        description="O projeto fica somente leitura"
        confirmLabel="Arquivar"
        confirmingLabel="Arquivando"
        onConfirm={() => Promise.reject(new Error("x"))}
        onClose={onClose}
        getError={() => "Sem permissão."}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Arquivar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sem permissão.");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Arquivar" })).toBeEnabled();
  });
});

describe("navegação de abas pelo teclado", () => {
  function Tabs() {
    const [tab, setTab] = useState("a");
    return (
      <div role="tablist" aria-label="Seções" onKeyDown={handleTabListKeyDown}>
        {["a", "b", "c"].map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            tabIndex={tab === key ? 0 : -1}
            onClick={() => setTab(key)}
          >
            Aba {key}
          </button>
        ))}
      </div>
    );
  }

  it("setas, Home e End movem o foco e selecionam a aba", async () => {
    const user = userEvent.setup();
    render(<Tabs />);
    await user.tab();
    expect(screen.getByRole("tab", { name: "Aba a" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Aba b" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Aba c" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Aba a" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Aba c" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Aba a" })).toHaveFocus();
  });
});

describe("campo de etiquetas", () => {
  function Harness() {
    const [value, setValue] = useState<string[]>(["React"]);
    return <TagInput label="Tecnologias" value={value} onChange={setValue} maxTags={3} maxLength={10} />;
  }

  it("adiciona com Enter ou vírgula, recusa duplicadas e remove com Backspace", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole("textbox", { name: "Tecnologias" });
    await user.type(input, "Zod{Enter}");
    await user.type(input, "Vite,");
    expect(screen.getByRole("list", { name: "Tecnologias" })).toHaveTextContent(/React.*Zod.*Vite/);

    await user.type(input, "react{Enter}");
    expect(screen.getByText("Este item já foi adicionado.")).toBeInTheDocument();
    await user.clear(input);

    await user.keyboard("{Backspace}");
    expect(screen.queryByText("Vite")).not.toBeInTheDocument();
  });

  it("respeita os limites de quantidade e tamanho", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole("textbox", { name: "Tecnologias" });
    await user.type(input, "Tecnologia longa{Enter}");
    expect(screen.getByText("Cada item deve ter no máximo 10 caracteres.")).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, "Zod{Enter}Vite{Enter}Java{Enter}");
    expect(screen.getByText("Adicione no máximo 3 itens.")).toBeInTheDocument();
  });

  it("botão de remover tem nome acessível", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Remover React" }));
    expect(screen.queryByRole("list", { name: "Tecnologias" })).not.toBeInTheDocument();
  });
});
