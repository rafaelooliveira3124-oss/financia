import React, { useState } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccessGate } from "./AccessGate";
const api = vi.hoisted(() => ({
  session: null as unknown,
  listener: null as null | ((event: string, session: unknown) => void),
  rpc: vi.fn(),
  aal: "aal2",
  signOut: vi.fn(),
  reset: vi.fn(),
}));
vi.mock("./store", () => ({
  demoEnabled: false,
  supabase: {
    rpc: (...args: unknown[]) => api.rpc(...args),
    auth: {
      onAuthStateChange: (callback: (event: string, s: unknown) => void) => {
        api.listener = callback;
        return {
          data: {
            subscription: {
              unsubscribe() {
                api.listener = null;
              },
            },
          },
        };
      },
      getSession: async () => ({ data: { session: api.session }, error: null }),
      signOut: (...args: unknown[]) => api.signOut(...args),
      resetPasswordForEmail: (...args: unknown[]) => api.reset(...args),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel: api.aal, nextLevel: "aal2" },
          error: null,
        }),
        listFactors: async () => ({
          data: { totp: [{ id: "factor", status: "verified" }], all: [] },
          error: null,
        }),
      },
    },
  },
}));
function session(token = "first", id = "owner") {
  return {
    user: { id },
    access_token: token,
    refresh_token: "fictional",
    expires_in: 3600,
    token_type: "bearer",
  };
}
function Draft() {
  const [value, setValue] = useState("");
  return (
    <label>
      Rascunho
      <input value={value} onChange={(e) => setValue(e.target.value)} />
    </label>
  );
}
beforeEach(() => {
  api.session = session();
  api.listener = null;
  api.aal = "aal2";
  api.rpc.mockReset();
  api.rpc.mockResolvedValue({ data: true, error: null });
  api.reset.mockReset();
  api.reset.mockResolvedValue({ error: null });
  api.signOut.mockReset();
  api.signOut.mockImplementation(async () => {
    api.session = null;
    api.listener?.("SIGNED_OUT", null);
    return { error: null };
  });
});
it("preserva campos durante TOKEN_REFRESHED e nova confirmação SIGNED_IN do mesmo usuário", async () => {
  render(
    <AccessGate>
      <Draft />
    </AccessGate>,
  );
  const input = await screen.findByLabelText("Rascunho");
  const user = userEvent.setup();
  await user.type(input, "Formulário em andamento");
  let finish!: (value: unknown) => void;
  api.rpc.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await act(async () => {
    api.session = session("refreshed");
    api.listener?.("TOKEN_REFRESHED", api.session);
  });
  expect(screen.getByLabelText("Rascunho")).toBe(input);
  expect((input as HTMLInputElement).value).toBe("Formulário em andamento");
  await act(async () => finish({ data: true, error: null }));
  await act(async () => {
    api.listener?.("SIGNED_IN", session("refocused"));
  });
  await waitFor(() =>
    expect((screen.getByLabelText("Rascunho") as HTMLInputElement).value).toBe(
      "Formulário em andamento",
    ),
  );
});
it("continua bloqueando o usuário autorizado sem MFA", async () => {
  api.aal = "aal1";
  render(
    <AccessGate>
      <Draft />
    </AccessGate>,
  );
  await screen.findByRole("heading", { name: "Confirme que é você" });
  expect(screen.queryByLabelText("Rascunho")).toBeNull();
  expect(screen.getByLabelText("Código do autenticador")).toBeTruthy();
});
it("remove a carteira da tela quando a autorização é revogada durante a renovação", async () => {
  render(
    <AccessGate>
      <Draft />
    </AccessGate>,
  );
  await screen.findByLabelText("Rascunho");
  api.rpc.mockResolvedValueOnce({ data: false, error: null });
  await act(async () => {
    api.listener?.("TOKEN_REFRESHED", session("denied"));
  });
  await screen.findByRole("heading", { name: "Acesso não autorizado" });
  expect(screen.queryByLabelText("Rascunho")).toBeNull();
});
it("renovar o token não reinicia o prazo de inatividade", async () => {
  vi.useFakeTimers();
  await act(async () => {
    render(
      <AccessGate>
        <Draft />
      </AccessGate>,
    );
  });
  expect(screen.getByLabelText("Rascunho")).toBeTruthy();
  await act(async () => {
    vi.advanceTimersByTime(14 * 60 * 1000);
  });
  await act(async () => {
    api.listener?.("TOKEN_REFRESHED", session("new-token"));
  });
  await act(async () => {
    vi.advanceTimersByTime(61000);
  });
  expect(api.signOut).toHaveBeenCalled();
  expect(screen.queryByLabelText("Rascunho")).toBeNull();
});
it("informa falha no envio da recuperação sem afirmar que o e-mail foi enviado", async () => {
  api.session = null;
  api.reset.mockResolvedValue({ error: { message: "rate limit" } });
  render(
    <AccessGate>
      <Draft />
    </AccessGate>,
  );
  const user = userEvent.setup();
  await screen.findByRole("heading", { name: "Entre no seu espaço" });
  await user.click(screen.getByRole("button", { name: "Esqueci minha senha" }));
  await user.type(screen.getByLabelText("E-mail"), "teste@example.test");
  await user.click(screen.getByRole("button", { name: "Enviar link" }));
  await screen.findByText(
    "Não foi possível concluir. Tente novamente mais tarde.",
  );
  expect(
    screen.queryByText(
      "Se a conta estiver habilitada, você receberá um link para recuperar o acesso.",
    ),
  ).toBeNull();
});
