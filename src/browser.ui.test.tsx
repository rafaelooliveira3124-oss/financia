import React from "react";
import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  createSessionStorage,
  createId,
  readPreference,
  writePreference,
} from "./browser";
import { empty } from "./finance";
import { ScreenBoundary } from "./ScreenBoundary";
it("mantém tokens apenas na memória quando sessionStorage está bloqueado e permite removê-los", () => {
  vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
    throw new DOMException("Blocked", "SecurityError");
  });
  const storage = createSessionStorage();
  storage.setItem("test-session", "fictional-token");
  expect(storage.getItem("test-session")).toBe("fictional-token");
  storage.removeItem("test-session");
  expect(storage.getItem("test-session")).toBeNull();
  expect(createSessionStorage().getItem("test-session")).toBeNull();
});
it("preferências bloqueadas não lançam erro", () => {
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
    throw new DOMException("Blocked", "SecurityError");
  });
  expect(readPreference("theme")).toBeNull();
  expect(() => writePreference("theme", "dark")).not.toThrow();
});
it("cria IDs seguros sem randomUUID e inicializa dados sem structuredClone", () => {
  const native = globalThis.crypto;
  vi.stubGlobal("crypto", {
    getRandomValues: (array: Uint8Array) => native.getRandomValues(array),
  });
  vi.stubGlobal("structuredClone", undefined);
  const a = createId(),
    b = createId();
  expect(a).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  expect(a).not.toBe(b);
  const s = empty(),
    t = empty();
  s.categories.expense.push("Teste");
  expect(t.categories.expense).not.toContain("Teste");
});
it("mostra uma forma de recuperação em vez de uma tela vazia se um componente falhar", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  function Broken(): never {
    throw Error("Falha fictícia");
  }
  render(
    <ScreenBoundary>
      <Broken />
    </ScreenBoundary>,
  );
  expect(screen.getByRole("alert").textContent).toContain(
    "Não foi possível abrir esta tela",
  );
  expect(
    screen.getByRole("button", { name: "Recarregar o site" }),
  ).toBeTruthy();
});
