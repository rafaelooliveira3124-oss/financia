import {
  useEffect,
  useState,
  useRef,
  type ReactNode,
  type FormEvent,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { ShieldCheck, LogOut, ArrowRight } from "lucide-react";
import { Button } from "./components/ui/button";
import { supabase, demoEnabled } from "./store";
type Access = "checking" | "denied" | "enroll" | "verify" | "ready";
export function AccessGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [initial, setInitial] = useState(true),
    [access, setAccess] = useState<Access>("checking"),
    [mode, setMode] = useState<"login" | "reset" | "recover">("login"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [factor, setFactor] = useState(""),
    [qr, setQr] = useState("");
  const authorizedUser = useRef<string | null>(null);
  useEffect(() => {
    if (!supabase) {
      setInitial(false);
      return;
    }
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (!active) return;
      setSession(s);
      setInitial(false);
      if (!s || s.user.id !== authorizedUser.current) {
        authorizedUser.current = null;
        setAccess("checking");
        setQr("");
      }
      if (event === "PASSWORD_RECOVERY") setMode("recover");
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error)
        setMessage("Não foi possível verificar a sessão. Entre novamente.");
      setSession(data.session);
      setInitial(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!supabase || !session) return;
    let active = true;
    if (authorizedUser.current !== session.user.id) setAccess("checking");
    (async () => {
      try {
        const owner = await supabase!.rpc("is_finance_owner");
        if (owner.error || owner.data !== true) {
          if (active) {
            authorizedUser.current = null;
            setMessage(
              "Esta conta não está autorizada ou a proteção do banco ainda não foi configurada.",
            );
            setAccess("denied");
          }
          return;
        }
        const aal = await supabase!.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal.error) throw aal.error;
        if (!active) return;
        if (aal.data.currentLevel === "aal2") {
          authorizedUser.current = session.user.id;
          setAccess("ready");
          return;
        }
        const factors = await supabase!.auth.mfa.listFactors();
        if (factors.error) throw factors.error;
        if (!active) return;
        authorizedUser.current = null;
        const verified = factors.data.totp.find((f) => f.status === "verified");
        if (verified) {
          setFactor(verified.id);
          setAccess("verify");
        } else setAccess("enroll");
      } catch {
        if (active) {
          authorizedUser.current = null;
          setAccess("denied");
          setMessage(
            "Não foi possível verificar as proteções da conta. Tente entrar novamente.",
          );
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [session]);
  // Limpa a sessão e os dados montados após 15 minutos sem interação.
  useEffect(() => {
    if (!session || !supabase) return;
    let last = Date.now(),
      expired = false;
    const check = () => {
      if (!expired && Date.now() - last >= 15 * 60 * 1000) {
        expired = true;
        authorizedUser.current = null;
        setAccess("checking");
        setSession(null);
        setMessage("Sessão encerrada por inatividade. Entre novamente.");
        void supabase!.auth.signOut({ scope: "local" });
      }
      return expired;
    };
    const touch = () => {
      if (!check()) last = Date.now();
    };
    const events = ["pointerdown", "keydown", "scroll", "touchstart"];
    for (const e of events)
      window.addEventListener(e, touch, { passive: true });
    document.addEventListener("visibilitychange", check);
    const timer = setInterval(check, 15000);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      for (const e of events) window.removeEventListener(e, touch);
    };
  }, [session?.user.id]);
  async function logout() {
    authorizedUser.current = null;
    setAccess("checking");
    setSession(null);
    setQr("");
    setFactor("");
    await supabase?.auth.signOut({ scope: "local" });
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || busy) return;
    setBusy(true);
    setMessage("");
    const form = new FormData(e.currentTarget),
      email = String(form.get("email") || "").trim(),
      password = String(form.get("password") || "");
    try {
      if (mode === "recover") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMode("login");
        setMessage("Senha atualizada. Continue com seu autenticador.");
      } else if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: new URL(".", location.href).href,
        });
        if (error) throw error;
        setMessage(
          "Se a conta estiver habilitada, você receberá um link para recuperar o acesso.",
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch {
      setMessage(
        mode === "login"
          ? "Não foi possível entrar. Confira o e-mail e a senha."
          : "Não foi possível concluir. Tente novamente mais tarde.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function enroll() {
    if (!supabase || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const list = await supabase.auth.mfa.listFactors();
      if (list.error) throw list.error;
      for (const f of list.data.all.filter(
        (f) => f.factor_type === "totp" && f.status === "unverified",
      )) {
        const r = await supabase.auth.mfa.unenroll({ factorId: f.id });
        if (r.error) throw r.error;
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Financia",
        issuer: "Financia",
      });
      if (error) throw error;
      setFactor(data.id);
      const svg = data.totp.qr_code;
      setQr(
        svg.startsWith("data:")
          ? svg
          : "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg),
      );
    } catch {
      setMessage("Não foi possível preparar o autenticador. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  async function verify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !factor || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const code = String(
        new FormData(e.currentTarget).get("code") || "",
      ).trim();
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor,
        code,
      });
      if (error) throw error;
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setQr("");
    } catch {
      setMessage(
        "Código inválido ou expirado. Use o código atual do seu autenticador.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!supabase) {
    if (demoEnabled) return children;
    return (
      <div className="access-screen">
        <section className="panel access-card">
          <ShieldCheck size={36} />
          <span className="eyebrow">ACESSO PRIVADO</span>
          <h1>Seu espaço está protegido</h1>
          <p>
            A configuração de acesso ainda não foi concluída. O painel
            financeiro permanece bloqueado até a ativação do banco e da sua
            conta.
          </p>
          <p>
            Nenhum valor pode ser registrado nesta versão enquanto a
            configuração estiver pendente.
          </p>
        </section>
      </div>
    );
  }
  if (initial || (session && access === "checking"))
    return (
      <div className="loading">
        <ShieldCheck size={30} />
        <p>Verificando acesso seguro…</p>
      </div>
    );
  if (session && access === "ready" && mode !== "recover") return children;
  return (
    <div className="access-screen">
      <section className="panel access-card">
        <div className="brand">
          <span className="logo-mark">f</span>financia.
        </div>
        <span className="eyebrow">ACESSO RESTRITO À CARTEIRA</span>
        {!session || mode === "recover" ? (
          <form onSubmit={submit}>
            <h1>
              {mode === "reset"
                ? "Recuperar acesso"
                : mode === "recover"
                  ? "Defina sua nova senha"
                  : "Entre no seu espaço"}
            </h1>
            <p>Somente as contas autorizadas podem acessar esta carteira.</p>
            {mode !== "recover" && (
              <label>
                E-mail
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  maxLength={254}
                />
              </label>
            )}
            {mode !== "reset" && (
              <label>
                Senha
                <input
                  name="password"
                  type="password"
                  autoComplete={
                    mode === "recover" ? "new-password" : "current-password"
                  }
                  minLength={mode === "recover" ? 12 : undefined}
                  required
                  maxLength={256}
                />
              </label>
            )}
            <Button disabled={busy}>
              {busy
                ? "Aguarde…"
                : mode === "reset"
                  ? "Enviar link"
                  : mode === "recover"
                    ? "Salvar senha"
                    : "Entrar"}
              <ArrowRight size={16} />
            </Button>
            {mode !== "recover" && (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setMode(mode === "login" ? "reset" : "login");
                  setMessage("");
                }}
              >
                {mode === "login"
                  ? "Esqueci minha senha"
                  : "Voltar para entrar"}
              </button>
            )}
          </form>
        ) : access === "denied" ? (
          <>
            <h1>Acesso não autorizado</h1>
            <p>
              A sua sessão não tem autorização para abrir o painel. Nenhum dado
              financeiro foi carregado.
            </p>
          </>
        ) : (
          <>
            <h1>
              {access === "enroll"
                ? "Proteja sua conta"
                : "Confirme que é você"}
            </h1>
            <p>
              {access === "enroll"
                ? "Configure um aplicativo autenticador no seu celular. O código será obrigatório para acessar seus saldos."
                : "Informe o código de seis dígitos do seu aplicativo autenticador."}
            </p>
            {access === "enroll" && !qr && (
              <Button onClick={enroll} disabled={busy}>
                {busy ? "Preparando…" : "Configurar autenticador"}
              </Button>
            )}
            {qr && (
              <>
                <img
                  className="mfa-qr"
                  src={qr}
                  alt="QR code para cadastrar o Financia no aplicativo autenticador"
                />
                <p className="helper">
                  Escaneie este QR code no autenticador. Não compartilhe nem
                  salve uma captura dele.
                </p>
              </>
            )}
            {(access === "verify" || qr) && (
              <form onSubmit={verify}>
                <label>
                  Código do autenticador
                  <input
                    className="mfa-code"
                    name="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    placeholder="000000"
                  />
                </label>
                <Button disabled={busy}>
                  {busy ? "Verificando…" : "Verificar e acessar"}
                </Button>
              </form>
            )}
            <p className="helper">
              Se perder o autenticador, a recuperação deve ser feita no painel
              administrativo do Supabase. A redefinição de senha não remove o
              segundo fator.
            </p>
          </>
        )}
        {message && (
          <p role="status" className="access-message">
            {message}
          </p>
        )}
        {session && (
          <Button variant="outline" onClick={logout}>
            <LogOut size={16} />
            Sair da conta
          </Button>
        )}
      </section>
    </div>
  );
}
