import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  empty,
  position,
  totals,
  parseMoney,
  validDate,
  today,
  type Entry,
  type State,
} from "./finance";
import { saveErrorMessage } from "./errors";
test("corrige rejeição de investimentos e persiste cadastro, aporte, despesa, rendimento, resgate, edição e exclusão com MFA", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid(),auth.jwt() to anon,authenticated;`,
    );
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/001_finance.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/002_owner_only_mfa.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const owner = "00000000-0000-4000-8000-000000000001",
      state = empty();
    state.opening = 100000;
    state.investments = [
      {
        id: "cdb",
        name: "Reserva",
        institution: "Banco",
        type: "CDB",
        principal: 0,
        current: 0,
        date: today(),
      },
    ];
    assert.equal(
      (
        await db.query<{ ok: boolean }>(
          "select public.valid_finance_state($1) ok",
          [state],
        )
      ).rows[0].ok,
      false,
      "reproduz o erro original com investimento real",
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261104025016_fix_investment_validation.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    assert.equal(
      (
        await db.query<{ ok: boolean }>(
          "select public.valid_finance_state($1) ok",
          [state],
        )
      ).rows[0].ok,
      true,
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261104022315_shared_finances.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.query("insert into auth.users values($1,now())", [owner]);
    await db.query("insert into private.financia_owner(user_id) values($1)", [
      owner,
    ]);
    await db.exec("set role authenticated");
    await db.query(
      "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
      [owner, JSON.stringify({ aal: "aal2" })],
    );
    let version = 0;
    async function save() {
      const r = await db.query<{ v: number }>(
        "select public.save_finance_state($1,$2) v",
        [state, version],
      );
      version = r.rows[0].v;
      const reloaded = await db.query<{ data: State; version: number }>(
        "select data,version from public.finance_states",
      );
      assert.deepEqual(reloaded.rows[0].data, state);
      assert.equal(reloaded.rows[0].version, version);
    }
    function add(kind: Entry["kind"], amount: number, investmentId?: string) {
      state.entries.push({
        id: crypto.randomUUID(),
        kind,
        amount,
        description: "Lançamento fictício",
        category: kind === "expense" ? "Alimentação" : "Investimentos",
        notes: "",
        date: today(),
        ...(investmentId ? { investmentId } : {}),
      });
    }
    await save();
    add("contribution", 30000, "cdb");
    await save();
    add("expense", 1234);
    await save();
    add("valuation", 2000, "cdb");
    await save();
    add("withdrawal", 10000, "cdb");
    await save();
    assert.equal(totals(state).cash, 78766);
    assert.equal(position(state, state.investments[0]).current, 22000);
    assert.equal(totals(state).wealth, 100766);
    state.entries.find((e) => e.kind === "expense")!.amount = 2345;
    await save();
    state.entries = state.entries.filter((e) => e.kind !== "expense");
    await save();
    assert.equal(totals(state).wealth, 102000);
    const valid = structuredClone(state);
    add("withdrawal", 999999, "cdb");
    await assert.rejects(() => save(), /Dados inválidos/);
    assert.deepEqual(
      (
        await db.query<{ data: State }>(
          "select data from public.finance_states",
        )
      ).rows[0].data,
      valid,
    );
    await db.exec("set role anon");
    await assert.rejects(() => db.query("select * from public.finance_states"));
  } finally {
    await db.close();
  }
});
test("moeda brasileira e teclado decimal móvel, datas reais e erros do Supabase", () => {
  assert.equal(parseMoney("1.234,56"), 123456);
  assert.equal(parseMoney("25.90"), 2590);
  assert.equal(parseMoney("0,10") + parseMoney("0,20"), 30);
  assert.equal(parseMoney("-12,50"), -1250);
  for (const bad of ["", ",", "12,345", "1,,2", "NaN"])
    assert.throws(() => parseMoney(bad));
  assert.equal(validDate("2026-02-30"), false);
  assert.equal(validDate("2024-02-29"), true);
  assert.match(
    saveErrorMessage({ code: "23514", message: "check constraint" }),
    /banco recusou/,
  );
  assert.match(
    saveErrorMessage({
      code: "P0001",
      message: "A carteira foi atualizada em outra sessão.",
    }),
    /não foram sobrescritos/,
  );
  assert.match(
    saveErrorMessage({ code: "42501", message: "permission denied" }),
    /autenticador/,
  );
});
