import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { empty, totals, type State } from "./finance";
const api = vi.hoisted(() => ({
  state: null as unknown as State,
  version: 1,
  rpc: vi.fn(),
  load: vi.fn(),
  emitAuthEvent: true,
}));
vi.mock("./store", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (
        callback: (event: string, session: unknown) => void,
      ) => {
        if (api.emitAuthEvent)
          queueMicrotask(() =>
            callback("INITIAL_SESSION", { user: { id: "test-user" } }),
          );
        return { data: { subscription: { unsubscribe() {} } } };
      },
      getSession: async () => ({
        data: { session: { user: { id: "test-user" } } },
        error: null,
      }),
    },
    from: () => ({
      select: () => ({
        maybeSingle: () => api.load(),
      }),
    }),
    rpc: (...args: unknown[]) => api.rpc(...args),
  },
}));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Pie: () => null,
  Cell: () => null,
  Tooltip: () => null,
}));
beforeEach(() => {
  window.history.replaceState(null, "", "/");
  api.state = empty();
  api.state.opening = 500000;
  api.version = 1;
  api.emitAuthEvent = true;
  api.load.mockReset();
  api.load.mockResolvedValue({
    data: { data: api.state, version: api.version },
    error: null,
  });
  api.rpc.mockReset();
  api.rpc.mockImplementation(
    async (
      _name: string,
      params: { next_data: State; expected_version: number },
    ) => {
      if (params.expected_version !== api.version)
        return {
          error: {
            code: "P0001",
            message: "A carteira foi atualizada em outra sessão.",
          },
          data: null,
        };
      api.state = structuredClone(params.next_data);
      return { error: null, data: ++api.version };
    },
  );
});
it("carrega a carteira mesmo se o evento inicial de autenticação não chegar", async () => {
  api.emitAuthEvent = false;
  await start(390);
  expect(
    screen.getByRole("navigation", { name: "Menu principal" }),
  ).toBeTruthy();
});
it("mostra erro de conexão no carregamento em vez de manter um carregamento infinito", async () => {
  api.load.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  render(<App />);
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Não foi possível conectar");
  expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeTruthy();
});
it("funciona com preferências bloqueadas e preserva categoria após falha de salvamento", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("Blocked", "SecurityError");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Blocked", "QuotaExceededError");
  });
  const user = await start(390);
  await user.click(screen.getByRole("button", { name: "Alternar tema" }));
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  await navigate(user, "Configurações");
  const name = screen.getByLabelText("Nome");
  await user.type(name, "Categoria de teste");
  api.rpc.mockResolvedValueOnce({
    data: null,
    error: { message: "Failed to fetch" },
  });
  await user.click(screen.getByRole("button", { name: "Criar categoria" }));
  await screen.findByRole("alert");
  expect((name as HTMLInputElement).value).toBe("Categoria de teste");
  await user.click(screen.getByRole("button", { name: "Criar categoria" }));
  await waitFor(() =>
    expect(api.state.categories.expense).toContain("Categoria de teste"),
  );
  expect((name as HTMLInputElement).value).toBe("");
});
async function start(width: number) {
  Object.defineProperty(window, "innerWidth", {
    value: width,
    configurable: true,
  });
  render(<App />);
  await screen.findByRole("heading", { name: "Seu dinheiro em perspectiva" });
  return userEvent.setup();
}
async function navigate(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.click(
    within(
      screen.getByRole("navigation", { name: "Menu principal" }),
    ).getByRole("link", { name }),
  );
  await waitFor(() =>
    expect(
      within(screen.getByRole("navigation", { name: "Menu principal" }))
        .getByRole("link", { name })
        .getAttribute("aria-current"),
    ).toBe("page"),
  );
}
async function money(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  label: string,
  value: string,
) {
  const input = within(dialog).getByLabelText(label);
  await user.clear(input);
  await user.type(input, value);
}
async function newInvestment(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getAllByRole("button", { name: "Novo investimento" })[0],
  );
  const d = screen.getByRole("dialog");
  await user.type(
    within(d).getByLabelText("Nome do investimento"),
    "Reserva de teste",
  );
  await user.type(within(d).getByLabelText("Instituição"), "Banco de teste");
  await money(user, d, "Capital líquido aplicado", "1.000,00");
  await money(user, d, "Valor atual", "1.050,00");
  return d;
}
describe.each([
  { name: "desktop", width: 1440 },
  { name: "celular", width: 390 },
])("$name", ({ width }) => {
  it("navega, cadastra, edita e exclui movimentação; mantém a rota ao remontar", async () => {
    const user = await start(width);
    await navigate(user, "Movimentações");
    expect(window.location.hash).toBe("#movimentacoes");
    expect(
      screen.getByRole("heading", { name: "Cada movimento conta" }),
    ).toBeTruthy();
    await user.click(
      screen.getAllByRole("button", { name: "Nova movimentação" })[0],
    );
    let d = screen.getByRole("dialog");
    await user.type(within(d).getByLabelText("Descrição"), "Mercado de teste");
    await money(user, d, "Valor (R$)", "123,45");
    await user.click(
      within(d).getByRole("button", { name: "Salvar movimentação" }),
    );
    await waitFor(() => expect(api.state.entries).toHaveLength(1));
    expect(api.state.entries[0].amount).toBe(12345);
    await screen.findByRole("button", { name: "Editar Mercado de teste" });
    await user.click(
      screen.getByRole("button", { name: "Editar Mercado de teste" }),
    );
    d = screen.getByRole("dialog");
    await money(user, d, "Valor (R$)", "25.90");
    await user.click(
      within(d).getByRole("button", { name: "Salvar movimentação" }),
    );
    await waitFor(() => expect(api.state.entries[0].amount).toBe(2590));
    await user.click(
      screen.getByRole("button", { name: "Excluir Mercado de teste" }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Excluir registro",
      }),
    );
    await waitFor(() => expect(api.state.entries).toHaveLength(0));
    await navigate(user, "Investimentos");
    expect(window.location.hash).toBe("#investimentos");
    await screen.findByRole("heading", { name: "Meus investimentos" });
    await navigate(user, "Movimentações");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("link", {
        name: "Dashboard",
      }),
    );
    await act(async () => {
      window.history.replaceState(null, "", "#movimentacoes");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(
      screen.getByRole("heading", { name: "Cada movimento conta" }),
    ).toBeTruthy();
  });
  it("cadastra investimento e registra aporte, resgate e novo valor sem duplicar a conta", async () => {
    const user = await start(width);
    await navigate(user, "Investimentos");
    const d = await newInvestment(user);
    await user.click(
      within(d).getByRole("button", { name: "Salvar investimento" }),
    );
    await waitFor(() => expect(api.state.investments).toHaveLength(1));
    expect(totals(api.state).cash).toBe(500000);
    await user.click(screen.getByRole("button", { name: "Aportar" }));
    let dialog = screen.getByRole("dialog");
    await money(user, dialog, "Valor (R$)", "200,00");
    await user.click(
      within(dialog).getByRole("button", { name: "Salvar movimentação" }),
    );
    await waitFor(() => expect(totals(api.state).cash).toBe(480000));
    await user.click(screen.getByRole("button", { name: "Resgatar" }));
    dialog = screen.getByRole("dialog");
    await money(user, dialog, "Valor (R$)", "50,00");
    await user.click(
      within(dialog).getByRole("button", { name: "Salvar movimentação" }),
    );
    await waitFor(() => expect(totals(api.state).cash).toBe(485000));
    await user.click(screen.getByRole("button", { name: "Atualizar valor" }));
    dialog = screen.getByRole("dialog");
    await money(user, dialog, "Novo valor atual (R$)", "1.250,00");
    await user.click(
      within(dialog).getByRole("button", { name: "Salvar movimentação" }),
    );
    await waitFor(() => expect(totals(api.state).invested).toBe(125000));
    expect(totals(api.state).cash).toBe(485000);
    expect(api.state.entries.find((e) => e.kind === "valuation")?.amount).toBe(
      5000,
    );
    expect(totals(api.state).expense).toBe(0);
    expect(totals(api.state).income).toBe(0);
  });
});
it("abre as telas por toque nas abas e mantém links diretos acessíveis por teclado", async () => {
  const user = await start(390);
  const nav = screen.getByRole("navigation", { name: "Menu principal" });
  const movements = within(nav).getByRole("link", { name: "Movimentações" });
  expect(movements.getAttribute("href")).toBe("#movimentacoes");
  await user.pointer([
    { keys: "[TouchA>]", target: movements },
    { keys: "[/TouchA]" },
  ]);
  expect(
    screen.getByRole("heading", { name: "Cada movimento conta" }),
  ).toBeTruthy();
  expect(movements.getAttribute("aria-current")).toBe("page");
  const investments = within(nav).getByRole("link", { name: "Investimentos" });
  await user.pointer([
    { keys: "[TouchA>]", target: investments },
    { keys: "[/TouchA]" },
  ]);
  expect(
    screen.getByRole("heading", { name: "Meus investimentos" }),
  ).toBeTruthy();
  movements.focus();
  await user.keyboard("{Enter}");
  expect(
    screen.getByRole("heading", { name: "Cada movimento conta" }),
  ).toBeTruthy();
});
it("mantém a navegação quando o navegador móvel recusa pushState", async () => {
  const user = await start(390);
  vi.spyOn(window.history, "pushState").mockImplementation(() => {
    throw new DOMException("Unavailable", "SecurityError");
  });
  await navigate(user, "Investimentos");
  expect(
    screen.getByRole("heading", { name: "Meus investimentos" }),
  ).toBeTruthy();
  expect(window.location.hash).toBe("#investimentos");
});
it("ajusta a altura disponível quando o teclado reduz o visualViewport", async () => {
  const viewport = Object.assign(new EventTarget(), {
    height: 800,
    offsetTop: 0,
  });
  vi.stubGlobal("visualViewport", viewport);
  vi.stubGlobal("innerHeight", 800);
  await start(390);
  expect(
    document.documentElement.style.getPropertyValue("--visual-height"),
  ).toBe("800px");
  viewport.height = 420;
  await act(async () => viewport.dispatchEvent(new Event("resize")));
  expect(
    document.documentElement.style.getPropertyValue("--visual-height"),
  ).toBe("420px");
  expect(
    document.documentElement.style.getPropertyValue("--keyboard-inset"),
  ).toBe("380px");
});
it("mostra erro estruturado do banco no formulário e mantém os campos para tentar novamente", async () => {
  const user = await start(390);
  await navigate(user, "Investimentos");
  const d = await newInvestment(user);
  api.rpc.mockResolvedValueOnce({
    data: null,
    error: { code: "23514", message: "new row violates check constraint" },
  });
  await user.click(
    within(d).getByRole("button", { name: "Salvar investimento" }),
  );
  await waitFor(() =>
    expect(within(d).getByRole("alert").textContent).toContain(
      "O banco recusou os dados",
    ),
  );
  expect(api.state.investments).toHaveLength(0);
  expect(
    (within(d).getByLabelText("Nome do investimento") as HTMLInputElement)
      .value,
  ).toBe("Reserva de teste");
  await user.click(
    within(d).getByRole("button", { name: "Salvar investimento" }),
  );
  await waitFor(() => expect(api.state.investments).toHaveLength(1));
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("bloqueia resgate maior que o saldo sem enviar gravação e sem fechar o modal", async () => {
  const user = await start(1440);
  await navigate(user, "Investimentos");
  const d = await newInvestment(user);
  await user.click(
    within(d).getByRole("button", { name: "Salvar investimento" }),
  );
  await waitFor(() => expect(api.state.investments).toHaveLength(1));
  api.rpc.mockClear();
  await user.click(screen.getByRole("button", { name: "Resgatar" }));
  const dialog = screen.getByRole("dialog");
  await money(user, dialog, "Valor (R$)", "9.000,00");
  await user.click(
    within(dialog).getByRole("button", { name: "Salvar movimentação" }),
  );
  expect(within(dialog).getByRole("alert").textContent).toContain(
    "não pode deixar o investimento negativo",
  );
  expect(api.rpc).not.toHaveBeenCalled();
});
it("evita gravação duplicada enquanto a primeira requisição está pendente", async () => {
  const user = await start(390);
  await navigate(user, "Investimentos");
  const d = await newInvestment(user);
  let resolve!: (value: unknown) => void;
  api.rpc.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const save = within(d).getByRole("button", { name: "Salvar investimento" });
  await user.dblClick(save);
  expect(api.rpc).toHaveBeenCalledTimes(1);
  expect((save as HTMLButtonElement).disabled).toBe(true);
  expect(
    (within(d).getByRole("button", { name: "Cancelar" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  await act(async () => resolve({ error: null, data: 2 }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
it("verifica o validador sem gravar dados e orienta o reparo quando necessário", async () => {
  const user = await start(390);
  await navigate(user, "Configurações");
  const before = structuredClone(api.state);
  api.rpc.mockResolvedValueOnce({ data: false, error: null });
  await user.click(
    screen.getByRole("button", { name: "Verificar salvamento" }),
  );
  await screen.findByText(/O banco precisa da correção/);
  expect(
    screen.getByRole("link", { name: "Abrir script de reparo" }),
  ).toBeTruthy();
  expect(api.state).toEqual(before);
  expect(api.rpc.mock.calls[0][0]).toBe("valid_finance_state");
  api.rpc.mockResolvedValueOnce({ data: true, error: null });
  await user.click(
    screen.getByRole("button", { name: "Verificar salvamento" }),
  );
  await screen.findByText(
    "O banco está aceitando o cadastro de investimentos.",
  );
  expect(api.state).toEqual(before);
});
