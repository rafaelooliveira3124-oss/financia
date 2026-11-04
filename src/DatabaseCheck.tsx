import { useState } from "react";
import { supabase } from "./store";
import { empty, today } from "./finance";
import { Button } from "./components/ui/button";
import { ShieldCheck } from "lucide-react";
export function DatabaseCheck() {
  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState<"idle" | "ok" | "repair" | "error">("idle");
  async function check() {
    if (!supabase || busy) return;
    setBusy(true);
    try {
      const fixture = empty();
      fixture.investments = [
        {
          id: "diagnostic",
          name: "Verificação fictícia",
          type: "CDB",
          institution: "Verificação",
          principal: 0,
          current: 0,
          date: today(),
        },
      ];
      const { data, error } = await supabase.rpc("valid_finance_state", {
        s: fixture,
      });
      if (error) throw error;
      setStatus(data === true ? "ok" : data === false ? "repair" : "error");
    } catch {
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }
  if (!supabase) return null;
  return (
    <section className="panel settings-panel">
      <h2>Conexão e salvamento</h2>
      <p>
        Confira se o banco está aceitando os registros. Esta verificação usa
        dados fictícios e não altera sua carteira.
      </p>
      <Button variant="outline" onClick={check} disabled={busy}>
        <ShieldCheck size={17} />
        {busy ? "Verificando…" : "Verificar salvamento"}
      </Button>
      {status !== "idle" && (
        <p
          role="status"
          className={"database-status " + (status === "ok" ? "green" : "red")}
        >
          {status === "ok"
            ? "O banco está aceitando o cadastro de investimentos."
            : status === "repair"
              ? "O banco precisa da correção de validação de investimentos. O administrador do projeto deve executar o script de reparo no SQL Editor."
              : "Não foi possível confirmar a conexão com o banco. Tente novamente."}
        </p>
      )}
      {status === "repair" && (
        <a
          className="text-button"
          href="https://raw.githubusercontent.com/rafaelooliveira3124-oss/financia/main/supabase/fix-investment-validation.sql"
          target="_blank"
          rel="noopener noreferrer"
        >
          Abrir script de reparo
        </a>
      )}
    </section>
  );
}
