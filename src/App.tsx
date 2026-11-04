import React, { useEffect, useState, useRef } from "react";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
  LayoutDashboard,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  TrendingUp,
  Settings,
  Plus,
  Wallet,
  Landmark,
  ArrowRight,
  Search,
  MoreHorizontal,
  Sun,
  Moon,
  X,
  Pencil,
  Trash2,
  ChevronDown,
  ShieldCheck,
  LogOut,
  Download,
  Check,
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "./components/ui/button";
import {
  demo,
  empty,
  totals,
  position,
  period,
  today,
  money,
  parseMoney,
  validDate,
  type State,
  type Entry,
  type Kind,
  type Investment,
} from "./finance";
import { supabase } from "./store";
import { saveErrorMessage } from "./errors";
import { usePageNavigation, pageHref } from "./navigation";
import { useMobileViewport } from "./useMobileViewport";

const labels: Record<Kind, string> = {
  income: "Entrada",
  expense: "Saída",
  contribution: "Aporte",
  withdrawal: "Resgate",
  adjustment: "Ajuste de saldo",
  valuation: "Rendimento",
};
export function App() {
  useMobileViewport();
  const [page, setPage] = usePageNavigation();
  const [state, setState] = useState<State>(() => {
      try {
        if (supabase) return empty();
        return (
          JSON.parse(localStorage.getItem("financia-demo") || "null") || demo()
        );
      } catch {
        return demo();
      }
    }),
    [user, setUser] = useState<string | null>(null),
    [loading, setLoading] = useState(!!supabase),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [noticeIsError, setNoticeIsError] = useState(false),
    [formError, setFormError] = useState(""),
    [dark, setDark] = useState(
      localStorage.getItem("financia-theme") === "dark",
    ),
    [hidden, setHidden] = useState(false),
    [range, setRange] = useState("month"),
    [start, setStart] = useState(today().slice(0, 7) + "-01"),
    [end, setEnd] = useState(today()),
    [query, setQuery] = useState(""),
    [type, setType] = useState("all"),
    [category, setCategory] = useState("all"),
    [sort, setSort] = useState("date-desc"),
    [modal, setModal] = useState<"entry" | "investment" | "delete" | null>(
      null,
    ),
    [edit, setEdit] = useState<Entry | null>(null),
    [selected, setSelected] = useState<Investment | null>(null),
    [deleting, setDeleting] = useState<Entry | null>(null),
    [formKind, setFormKind] = useState<Kind>("expense");
  const revision = useRef(0),
    loaded = useRef(!supabase),
    saving = useRef(false);
  function showError(error: unknown) {
    const message = saveErrorMessage(error);
    setFormError(message);
    setNoticeIsError(true);
    setNotice(message);
  }
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [page]);
  useEffect(() => {
    setFormError("");
  }, [modal]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("financia-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user.id ?? null);
    });
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (error) setNotice(error.message);
      if (!data.session) setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!supabase || !user) return;
    let active = true;
    loaded.current = false;
    setLoading(true);
    supabase
      .from("finance_states")
      .select("data,version")
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error)
          setNotice("Não foi possível carregar seus dados: " + error.message);
        else {
          setState(data?.data ?? empty());
          revision.current = data?.version ?? 0;
          loaded.current = true;
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(id);
  }, [notice]);
  async function persist(next: State) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setFormError("");
    try {
      if (supabase) {
        if (!user) throw Error("Entre na sua conta.");
        if (!loaded.current)
          throw Error(
            "Seus dados não foram carregados. Recarregue a página antes de salvar.",
          );
        const { data, error } = await supabase.rpc("save_finance_state", {
          next_data: next,
          expected_version: revision.current,
        });
        if (error) throw error;
        revision.current = data;
      } else localStorage.setItem("financia-demo", JSON.stringify(next));
      setState(next);
      setModal(null);
      setNoticeIsError(false);
      setNotice("Tudo certo! Alterações salvas.");
    } catch (e) {
      showError(e);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  const [from, to] = period(range, start, end),
    t = totals(state, from, to),
    fmt = (n: number) => (hidden ? "••••••" : money(n)),
    filtered = state.entries
      .filter(
        (e) =>
          e.date >= from &&
          e.date <= to &&
          e.description
            .toLocaleLowerCase("pt-BR")
            .includes(query.toLocaleLowerCase("pt-BR")) &&
          (type === "all" || e.kind === type) &&
          (category === "all" || e.category === category),
      )
      .sort((a, b) =>
        sort === "value-desc"
          ? b.amount - a.amount
          : sort === "value-asc"
            ? a.amount - b.amount
            : sort === "date-asc"
              ? a.date.localeCompare(b.date)
              : b.date.localeCompare(a.date),
      );
  function openEntry(kind: Kind = "expense", i?: Investment, e?: Entry) {
    setEdit(e ?? null);
    setSelected(i ?? null);
    setFormKind(e?.kind ?? kind);
    setModal("entry");
  }
  function val(f: FormData, k: string) {
    return String(f.get(k) || "").trim();
  }
  async function saveEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    try {
      const f = new FormData(event.currentTarget),
        enteredAmount = parseMoney(val(f, "amount")),
        kind = formKind,
        investmentId = selected?.id ?? edit?.investmentId;
      const amount =
        kind === "valuation" && selected && !edit
          ? enteredAmount - position(state, selected).current
          : enteredAmount;
      if (kind === "valuation" && selected && !edit && enteredAmount < 0)
        throw Error("O valor atual do investimento não pode ser negativo.");
      if (kind === "valuation" && !amount)
        throw Error("Informe um valor atual diferente do saldo já registrado.");
      if (
        !amount ||
        (!["adjustment", "valuation"].includes(kind) && amount < 0)
      )
        throw Error("Informe um valor maior que zero.");
      if (!val(f, "description")) throw Error("Informe uma descrição.");
      if (!validDate(val(f, "date")) || val(f, "date") > today())
        throw Error("Use uma data válida até hoje.");
      const base = {
        ...state,
        entries: state.entries.filter((e) => e.id !== edit?.id),
      };
      if (investmentId) {
        const inv = state.investments.find((i) => i.id === investmentId)!;
        if (
          position(base, inv).current +
            (kind === "withdrawal"
              ? -amount
              : kind === "valuation"
                ? amount
                : 0) <
          0
        )
          throw Error("O valor não pode deixar o investimento negativo.");
      }
      const e: Entry = {
        id: edit?.id ?? crypto.randomUUID(),
        kind,
        description: val(f, "description"),
        amount,
        category: val(f, "category") || labels[kind],
        date: val(f, "date"),
        notes: val(f, "notes"),
        ...(investmentId ? { investmentId } : {}),
      };
      const next = { ...base, entries: [...base.entries, e] };
      if (next.investments.some((i) => position(next, i).current < 0))
        throw Error("Esta edição deixaria uma posição negativa.");
      await persist(next);
    } catch (e) {
      showError(e);
    }
  }
  async function saveInvestment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    try {
      const f = new FormData(event.currentTarget),
        principal = parseMoney(val(f, "principal")),
        current = parseMoney(val(f, "current"));
      if (principal < 0 || current < 0)
        throw Error("Valores não podem ser negativos.");
      if (!val(f, "name") || !val(f, "institution"))
        throw Error("Informe o nome do investimento e a instituição.");
      if (!validDate(val(f, "date")) || val(f, "date") > today())
        throw Error("Use uma data de referência válida até hoje.");
      const i: Investment = {
        id: crypto.randomUUID(),
        name: val(f, "name"),
        institution: val(f, "institution"),
        type: val(f, "type"),
        principal,
        current,
        date: val(f, "date"),
      };
      await persist({ ...state, investments: [...state.investments, i] });
    } catch (e) {
      showError(e);
    }
  }
  const nav = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Movimentações", icon: ArrowLeftRight },
    { name: "Investimentos", icon: TrendingUp },
    { name: "Configurações", icon: Settings },
  ] as const;
  if (supabase && user && !loading && !loaded.current)
    return (
      <div className="loading">
        <p>Não foi possível carregar seus dados com segurança.</p>
        <Button onClick={() => location.reload()}>Tentar novamente</Button>
      </div>
    );
  if (loading)
    return (
      <div className="loading">
        <div className="logo-mark">f</div>
        <p>Organizando suas finanças…</p>
      </div>
    );
  return (
    <div className="shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("Dashboard");
          }}
        >
          <span className="logo-mark">f</span>financia
          <span className="brand-dot">.</span>
        </a>
        <span className="nav-caption">SEU DIA A DIA</span>
        <nav aria-label="Menu principal">
          {nav.map(({ name, icon: Icon }) => (
            <a
              key={name}
              href={pageHref(name)}
              aria-label={name}
              title={name}
              aria-current={page === name ? "page" : undefined}
              className={page === name ? "active" : ""}
              onClick={(event) => {
                if (
                  event.button !== 0 ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                )
                  return;
                event.preventDefault();
                setPage(name);
              }}
            >
              <Icon size={20} />
              <span>{name}</span>
              {page === name && <span className="nav-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="security">
            <ShieldCheck size={21} />
            <div>
              <strong>Um passo de cada vez</strong>
              <p>
                Organizar hoje é viver
                <br />
                melhor amanhã.
              </p>
            </div>
          </div>
          <button className="profile" onClick={() => setPage("Configurações")}>
            <span className="avatar">{user ? "M" : "D"}</span>
            <span>
              <strong>{user ? "Minha conta" : "Conta demonstração"}</strong>
              <small>
                {user ? "Carteira compartilhada" : "Explore com tranquilidade"}
              </small>
            </span>
            <MoreHorizontal size={18} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            Seu dinheiro, <strong>bem cuidado.</strong>
          </span>
          <div>
            <span className="connection">
              <span />
              {supabase ? "Conta conectada" : "Modo demonstração"}
            </span>
            <button
              className="icon-button"
              aria-label="Atualizar carteira"
              title="Atualizar carteira"
              onClick={() => location.reload()}
            >
              <ArrowLeftRight size={20} />
            </button>
            <button
              className="icon-button"
              aria-label="Alternar tema"
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <span className="avatar small">{user ? "M" : "D"}</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {new Intl.DateTimeFormat("pt-BR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "America/Sao_Paulo",
                }).format(new Date())}
              </div>
              <h1>
                {page === "Dashboard"
                  ? "Seu dinheiro em perspectiva"
                  : page === "Investimentos"
                    ? "Meus investimentos"
                    : page === "Movimentações"
                      ? "Cada movimento conta"
                      : "Do seu jeito"}
              </h1>
              <p>
                {page === "Dashboard"
                  ? "Uma visão simples para tomar boas decisões."
                  : page === "Investimentos"
                    ? "Acompanhe o que você está construindo para o futuro."
                    : page === "Movimentações"
                      ? "Organize as entradas e saídas da sua vida."
                      : "Personalize sua experiência e organize sua conta."}
              </p>
            </div>
            <Button
              onClick={() =>
                page === "Investimentos" ? setModal("investment") : openEntry()
              }
            >
              <Plus size={18} />
              {page === "Investimentos"
                ? "Novo investimento"
                : "Nova movimentação"}
            </Button>
          </div>
          {!supabase && (
            <div className="demo-banner">
              <span className="demo-dot" />
              <span>
                <strong>Este é seu espaço de demonstração.</strong> Os dados são
                fictícios e ficam salvos apenas neste navegador.
              </span>
              <button onClick={() => setPage("Configurações")}>
                Saiba mais <ArrowRight size={14} />
              </button>
            </div>
          )}
          {(page === "Dashboard" || page === "Movimentações") && (
            <>
              <div className="section-bar">
                <div className="section-title">
                  {page === "Dashboard" ? "Visão geral" : "Histórico completo"}
                  <span className="muted">
                    {" "}
                    /{" "}
                    {range === "month"
                      ? "Este mês"
                      : range === "previous"
                        ? "Mês anterior"
                        : range === "quarter"
                          ? "Últimos 3 meses"
                          : range === "year"
                            ? "Este ano"
                            : "Personalizado"}
                  </span>
                </div>
                <div className="period-control">
                  <select
                    aria-label="Período"
                    value={range}
                    onChange={(e) => setRange(e.target.value)}
                  >
                    <option value="month">Mês atual</option>
                    <option value="previous">Mês anterior</option>
                    <option value="quarter">Últimos 3 meses</option>
                    <option value="year">Ano atual</option>
                    <option value="custom">Período personalizado</option>
                  </select>
                  <button
                    className="icon-button"
                    aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
                    onClick={() => setHidden(!hidden)}
                  >
                    {hidden ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              {range === "custom" && (
                <div className="custom-dates">
                  <label>
                    De
                    <input
                      type="date"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                      max={end}
                    />
                  </label>
                  <label>
                    Até
                    <input
                      type="date"
                      value={end}
                      onChange={(e) => setEnd(e.target.value)}
                      min={start}
                    />
                  </label>
                </div>
              )}
            </>
          )}
          {page === "Dashboard" && (
            <>
              <div className="summary-grid">
                {[
                  {
                    title: "Saldo em conta",
                    value: t.cash,
                    icon: Wallet,
                    color: "blue",
                    note: "Disponível agora",
                  },
                  {
                    title: "Total investido",
                    value: t.invested,
                    icon: TrendingUp,
                    color: "purple",
                    note: "Seu dinheiro trabalhando",
                  },
                  {
                    title: "Entradas do período",
                    value: t.income,
                    icon: ArrowDownLeft,
                    color: "green",
                    note: "Tudo o que entrou",
                  },
                  {
                    title: "Saídas do período",
                    value: t.expense,
                    icon: ArrowUpRight,
                    color: "red",
                    note: "Tudo o que saiu",
                  },
                  {
                    title: "Resultado do período",
                    value: t.result,
                    icon: ArrowLeftRight,
                    color: t.result >= 0 ? "green" : "red",
                    note:
                      t.result >= 0
                        ? "Você está no caminho certo"
                        : "Acompanhe seus gastos",
                  },
                  {
                    title: "Patrimônio total",
                    value: t.wealth,
                    icon: Landmark,
                    color: "blue",
                    note: "Conta + investimentos",
                  },
                ].map(({ title, value, icon: Icon, color, note }, index) => (
                  <article
                    className={"summary-card " + (index === 5 ? "wealth" : "")}
                    key={title}
                  >
                    <div>
                      <span>{title}</span>
                      <span className={"icon-tile " + color}>
                        <Icon size={18} />
                      </span>
                    </div>
                    <strong className={index === 4 ? color : ""}>
                      {index === 4 && value > 0 && !hidden ? "+ " : ""}
                      {fmt(value)}
                    </strong>
                    <small>
                      {index === 4 && (
                        <span className={"status-dot " + color} />
                      )}{" "}
                      {note}
                    </small>
                  </article>
                ))}
              </div>
              <div className="middle-grid">
                <section className="panel cashflow">
                  <div className="panel-heading">
                    <div>
                      <h2>Entradas e saídas</h2>
                      <p>O equilíbrio do seu período</p>
                    </div>
                    <span className="mini-tag">
                      {range === "month" ? "Neste mês" : "No período"}
                    </span>
                  </div>
                  <div className="chart-row">
                    <div className="donut">
                      <ResponsiveContainer width="100%" height={216}>
                        <PieChart>
                          <Pie
                            data={
                              t.income + t.expense
                                ? [
                                    { name: "Entradas", value: t.income },
                                    { name: "Saídas", value: t.expense },
                                  ]
                                : [{ name: "Sem movimentações", value: 1 }]
                            }
                            dataKey="value"
                            innerRadius={73}
                            outerRadius={94}
                            paddingAngle={t.income && t.expense ? 5 : 0}
                            cornerRadius={6}
                            stroke="none"
                            startAngle={90}
                            endAngle={-270}
                          >
                            {(t.income + t.expense
                              ? ["#23a786", "#ed737a"]
                              : ["#e7ebf1"]
                            ).map((c) => (
                              <Cell fill={c} key={c} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => fmt(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="donut-label">
                        <small>Movimentado</small>
                        <strong>{fmt(t.income + t.expense)}</strong>
                      </div>
                    </div>
                    <div className="chart-legend">
                      {[
                        {
                          label: "Entradas",
                          value: t.income,
                          color: "green",
                          icon: ArrowDownLeft,
                        },
                        {
                          label: "Saídas",
                          value: t.expense,
                          color: "red",
                          icon: ArrowUpRight,
                        },
                      ].map(({ label, value, color, icon: Icon }) => (
                        <div className="legend-item" key={label}>
                          <span className={"icon-tile " + color}>
                            <Icon size={18} />
                          </span>
                          <div>
                            <span>{label}</span>
                            <strong>{fmt(value)}</strong>
                          </div>
                          <small>
                            {t.income + t.expense
                              ? Math.round(
                                  (value / (t.income + t.expense)) * 100,
                                )
                              : 0}
                            %
                          </small>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="panel-footer">
                    <span className="status-dot green" />
                    {t.result >= 0
                      ? "Suas entradas superam suas saídas. Continue assim!"
                      : "Suas saídas superam suas entradas neste período."}
                  </div>
                </section>
                <section className="panel quick">
                  <div className="panel-heading">
                    <div>
                      <h2>Um novo movimento</h2>
                      <p>Pequenos registros, grandes mudanças.</p>
                    </div>
                  </div>
                  <button onClick={() => openEntry("income")}>
                    <span className="icon-tile green">
                      <ArrowDownLeft size={21} />
                    </span>
                    <span>
                      <strong>Registrar entrada</strong>
                      <small>Salário, renda extra e mais</small>
                    </span>
                    <Plus size={18} />
                  </button>
                  <button onClick={() => openEntry("expense")}>
                    <span className="icon-tile red">
                      <ArrowUpRight size={21} />
                    </span>
                    <span>
                      <strong>Registrar saída</strong>
                      <small>Deixe seus gastos em dia</small>
                    </span>
                    <Plus size={18} />
                  </button>
                  <button onClick={() => setPage("Investimentos")}>
                    <span className="icon-tile purple">
                      <TrendingUp size={21} />
                    </span>
                    <span>
                      <strong>Cuidar dos investimentos</strong>
                      <small>Seu futuro começa agora</small>
                    </span>
                    <ArrowRight size={18} />
                  </button>
                </section>
              </div>
            </>
          )}
          {(page === "Dashboard" || page === "Movimentações") && (
            <section className="panel transactions">
              <div className="panel-heading">
                <div>
                  <h2>
                    {page === "Dashboard"
                      ? "Últimas movimentações"
                      : "Suas movimentações"}
                  </h2>
                  <p>Os detalhes que fazem a diferença.</p>
                </div>
                {page === "Dashboard" && (
                  <button
                    className="text-button"
                    onClick={() => setPage("Movimentações")}
                  >
                    Ver histórico completo <ArrowRight size={15} />
                  </button>
                )}
              </div>
              <div className="filters">
                <div className="search">
                  <Search size={17} />
                  <input
                    aria-label="Pesquisar descrição"
                    placeholder="Buscar movimentação…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <select
                  aria-label="Tipo"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="all">Todos os tipos</option>
                  {Object.entries(labels).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Categoria"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="all">Todas as categorias</option>
                  {[
                    ...new Set([
                      ...state.categories.income,
                      ...state.categories.expense,
                      ...state.entries.map((e) => e.category),
                    ]),
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <select
                  aria-label="Ordenar"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="date-desc">Mais recentes</option>
                  <option value="date-asc">Mais antigas</option>
                  <option value="value-desc">Maior valor</option>
                  <option value="value-asc">Menor valor</option>
                </select>
              </div>
              <div className="table-scroll">
                <table role="table">
                  <thead role="rowgroup">
                    <tr role="row">
                      <th>DESCRIÇÃO</th>
                      <th>CATEGORIA</th>
                      <th>DATA</th>
                      <th>TIPO</th>
                      <th className="amount">VALOR</th>
                      <th>
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody role="rowgroup">
                    {(page === "Dashboard"
                      ? filtered.slice(0, 10)
                      : filtered
                    ).map((e) => (
                      <tr role="row" key={e.id}>
                        <td role="cell">
                          <div className="description-cell">
                            <span
                              className={
                                "transaction-icon " +
                                (e.kind === "income"
                                  ? "green"
                                  : e.kind === "expense"
                                    ? "red"
                                    : "purple")
                              }
                            >
                              {e.kind === "income" ? (
                                <ArrowDownLeft size={19} />
                              ) : e.kind === "expense" ? (
                                <ArrowUpRight size={19} />
                              ) : (
                                <ArrowLeftRight size={19} />
                              )}
                            </span>
                            <span>
                              <strong>{e.description}</strong>
                              <small>
                                {e.investmentId
                                  ? state.investments.find(
                                      (i) => i.id === e.investmentId,
                                    )?.name
                                  : "Conta corrente"}
                              </small>
                            </span>
                          </div>
                        </td>
                        <td role="cell">
                          <span className="category-tag">{e.category}</span>
                        </td>
                        <td role="cell">
                          {e.date.split("-").reverse().join("/")}
                        </td>
                        <td role="cell">
                          <span
                            className={
                              "type-pill " +
                              (e.kind === "income"
                                ? "green"
                                : e.kind === "expense"
                                  ? "red"
                                  : "purple")
                            }
                          >
                            <span className="status-dot" />
                            {labels[e.kind]}
                          </span>
                        </td>
                        <td
                          role="cell"
                          className={
                            "amount " +
                            (e.kind === "income"
                              ? "green"
                              : e.kind === "expense"
                                ? "red"
                                : "")
                          }
                        >
                          {!hidden
                            ? e.kind === "income"
                              ? "+ "
                              : e.kind === "expense"
                                ? "− "
                                : ""
                            : ""}
                          {fmt(e.amount)}
                        </td>
                        <td role="cell">
                          <div className="row-actions">
                            <button
                              aria-label={"Editar " + e.description}
                              onClick={() => openEntry(e.kind, undefined, e)}
                            >
                              <Pencil size={15} />
                              <span className="action-label">Editar</span>
                            </button>
                            <button
                              aria-label={"Excluir " + e.description}
                              onClick={() => {
                                setDeleting(e);
                                setModal("delete");
                              }}
                            >
                              <Trash2 size={15} />
                              <span className="action-label">Excluir</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filtered.length && (
                  <div className="empty">
                    <Search size={26} />
                    <h3>Nenhuma movimentação por aqui</h3>
                    <p>Altere os filtros ou registre seu primeiro movimento.</p>
                    <Button onClick={() => openEntry()}>
                      Nova movimentação
                    </Button>
                  </div>
                )}
              </div>
              <div className="table-bottom">
                <span>
                  {page === "Dashboard"
                    ? Math.min(filtered.length, 10)
                    : filtered.length}{" "}
                  de {filtered.length} movimentações no período
                </span>
                <span>Valores em reais (BRL)</span>
              </div>
            </section>
          )}
          {page === "Investimentos" && (
            <>
              <div className="investment-stats">
                {[
                  [
                    "Capital líquido aplicado",
                    state.investments.reduce(
                      (v, i) => v + position(state, i).principal,
                      0,
                    ),
                  ],
                  ["Valor atual", t.invested],
                  [
                    "Ganho ou perda acumulada",
                    t.invested -
                      state.investments.reduce(
                        (v, i) => v + position(state, i).principal,
                        0,
                      ),
                  ],
                ].map(([title, value]) => (
                  <div className="summary-card" key={title}>
                    <span>{title}</span>
                    <strong>{fmt(Number(value))}</strong>
                  </div>
                ))}
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Sua carteira</h2>
                    <p>
                      Atualizações manuais. Aportes e resgates movimentam sua
                      conta.
                    </p>
                  </div>
                </div>
                {state.investments.map((i) => {
                  const p = position(state, i);
                  return (
                    <article className="investment-row" key={i.id}>
                      <span className="icon-tile purple">
                        <TrendingUp size={22} />
                      </span>
                      <div className="investment-name">
                        <h3>{i.name}</h3>
                        <p>
                          {i.type} · {i.institution} · Ref.{" "}
                          {i.date.split("-").reverse().join("/")}
                        </p>
                      </div>
                      <div>
                        <small>Valor atual</small>
                        <strong>{fmt(p.current)}</strong>
                        <span
                          className={
                            p.current - p.principal >= 0 ? "green" : "red"
                          }
                        >
                          {fmt(p.current - p.principal)} de resultado
                        </span>
                      </div>
                      <div className="investment-actions">
                        <Button
                          variant="outline"
                          onClick={() => openEntry("contribution", i)}
                        >
                          Aportar
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => openEntry("withdrawal", i)}
                        >
                          Resgatar
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => openEntry("valuation", i)}
                        >
                          Atualizar valor
                        </Button>
                      </div>
                    </article>
                  );
                })}
                {!state.investments.length && (
                  <div className="empty">
                    <TrendingUp />
                    <h3>O futuro começa com um passo</h3>
                    <p>
                      Cadastre sua posição inicial ou um investimento com saldo
                      zero para fazer um aporte.
                    </p>
                    <Button onClick={() => setModal("investment")}>
                      Novo investimento
                    </Button>
                  </div>
                )}
              </section>
              <p className="helper">
                O cadastro representa uma posição já existente. Para investir
                dinheiro da conta, use “Aportar”. Ao atualizar, informe o novo
                valor atual. A diferença de rendimento é calculada
                automaticamente.
              </p>
            </>
          )}
          {page === "Configurações" && (
            <div className="settings-grid">
              <section className="panel settings-panel">
                <h2>Conta corrente</h2>
                <p>
                  O saldo atual é calculado a partir do saldo inicial e de cada
                  movimentação.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    try {
                      persist({
                        ...state,
                        opening: parseMoney(
                          String(new FormData(e.currentTarget).get("opening")),
                        ),
                      });
                    } catch (e) {
                      setNotice((e as Error).message);
                    }
                  }}
                >
                  <label>
                    Saldo inicial (R$)
                    <input
                      name="opening"
                      defaultValue={(state.opening / 100).toLocaleString(
                        "pt-BR",
                        { minimumFractionDigits: 2 },
                      )}
                      required
                    />
                  </label>
                  <Button disabled={busy}>Salvar saldo inicial</Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openEntry("adjustment")}
                  >
                    Registrar ajuste identificado
                  </Button>
                </form>
                <div className="balance-line">
                  <span>Saldo disponível agora</span>
                  <strong>{fmt(t.cash)}</strong>
                </div>
              </section>
              <section className="panel settings-panel">
                <h2>Suas categorias</h2>
                <p>
                  Organize as movimentações com nomes que fazem sentido para
                  você.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget),
                      k = String(f.get("kind")) as "income" | "expense",
                      name = String(f.get("name")).trim();
                    if (!name || state.categories[k].includes(name))
                      return setNotice(
                        "Escolha um nome novo para a categoria.",
                      );
                    persist({
                      ...state,
                      categories: {
                        ...state.categories,
                        [k]: [...state.categories[k], name],
                      },
                    });
                    e.currentTarget.reset();
                  }}
                >
                  <label>
                    Tipo
                    <select name="kind">
                      <option value="expense">Saída</option>
                      <option value="income">Entrada</option>
                    </select>
                  </label>
                  <label>
                    Nome
                    <input name="name" required maxLength={60} />
                  </label>
                  <Button disabled={busy}>Criar categoria</Button>
                </form>
                <div className="tags">
                  {[
                    ...new Set([
                      ...state.categories.income,
                      ...state.categories.expense,
                    ]),
                  ].map((c) => (
                    <span className="category-tag" key={c}>
                      {c}
                    </span>
                  ))}
                </div>
              </section>
              <section className="panel settings-panel">
                <h2>Aparência e dados</h2>
                <Button variant="outline" onClick={() => setDark(!dark)}>
                  {dark ? <Sun size={17} /> : <Moon size={17} />}Usar modo{" "}
                  {dark ? "claro" : "escuro"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const url = URL.createObjectURL(
                      new Blob([JSON.stringify(state, null, 2)], {
                        type: "application/json",
                      }),
                    );
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "financia-" + today() + ".json";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download size={17} />
                  Exportar meus dados
                </Button>
                {supabase && (
                  <Button
                    variant="ghost"
                    onClick={() => supabase?.auth.signOut()}
                  >
                    <LogOut size={17} />
                    Sair da conta
                  </Button>
                )}
              </section>
              <section className="panel settings-panel">
                <span className="icon-tile blue">
                  <ShieldCheck size={22} />
                </span>
                <h2>
                  {supabase ? "Seus dados, protegidos" : "Sobre a demonstração"}
                </h2>
                <p>
                  {supabase
                    ? "Esta carteira é acessada somente pelas contas autorizadas, com senha e autenticador. Os dois acessos podem consultar e alterar as mesmas informações."
                    : "Você está explorando dados fictícios, armazenados neste navegador. Para uso com dados reais, configure o Supabase seguindo o README do projeto. Não há conexão com bancos ou corretoras."}
                </p>
                <p className="helper">
                  Aportes e resgates são transferências. Rendimentos não alteram
                  o saldo da conta.
                </p>
              </section>
            </div>
          )}
          <footer className="footer">
            <span>
              <span className="logo-mini">f</span> Mais clareza para a sua vida
              financeira.
            </span>
            <span>Feito para simplificar.</span>
          </footer>
        </main>
      </div>
      <Dialog.Root
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setModal(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="modal-overlay" />
          <Dialog.Content className="modal">
            <Dialog.Title>
              {modal === "investment"
                ? "Novo investimento"
                : modal === "delete"
                  ? "Excluir movimentação?"
                  : edit
                    ? "Editar movimentação"
                    : formKind === "valuation"
                      ? "Atualizar valor do investimento"
                      : labels[formKind]}
            </Dialog.Title>
            <Dialog.Description>
              {modal === "delete"
                ? "A exclusão atualizará os saldos automaticamente."
                : modal === "investment"
                  ? "Cadastre uma posição existente. Novos aportes são registrados na carteira."
                  : "Um registro simples para manter tudo em ordem."}
            </Dialog.Description>
            {formError && (
              <div className="form-error" role="alert" id="save-error">
                <AlertCircle size={18} />
                <span>{formError}</span>
              </div>
            )}
            <Dialog.Close
              className="modal-close"
              aria-label="Fechar"
              disabled={busy}
            >
              <X size={20} />
            </Dialog.Close>
            {modal === "delete" ? (
              <>
                <p className="delete-description">
                  {deleting?.description} · {deleting && fmt(deleting.amount)}
                </p>
                <div className="form-actions">
                  <Button variant="outline" onClick={() => setModal(null)}>
                    Cancelar
                  </Button>
                  <Button
                    className="danger"
                    disabled={busy}
                    onClick={() => {
                      const next = {
                        ...state,
                        entries: state.entries.filter(
                          (e) => e.id !== deleting?.id,
                        ),
                      };
                      if (
                        next.investments.some(
                          (i) => position(next, i).current < 0,
                        )
                      ) {
                        showError(
                          Error(
                            "A exclusão deixaria um investimento negativo. Revise os resgates primeiro.",
                          ),
                        );
                        return;
                      }
                      persist(next);
                    }}
                  >
                    Excluir registro
                  </Button>
                </div>
              </>
            ) : modal === "investment" ? (
              <form
                onSubmit={saveInvestment}
                aria-describedby={formError ? "save-error" : undefined}
                onChange={() => setFormError("")}
              >
                <label>
                  Nome do investimento
                  <input
                    name="name"
                    required
                    maxLength={100}
                    placeholder="Ex.: Reserva de emergência"
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Tipo
                    <select name="type">
                      {[
                        "Tesouro Direto",
                        "CDB",
                        "LCI/LCA",
                        "Ações",
                        "Fundos Imobiliários",
                        "ETFs",
                        "Outros",
                      ].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Instituição
                    <input name="institution" required maxLength={100} />
                  </label>
                  <MoneyInput
                    label="Capital líquido aplicado"
                    name="principal"
                    initial={0}
                  />
                  <MoneyInput label="Valor atual" name="current" initial={0} />
                </div>
                <label>
                  Data de referência
                  <input
                    name="date"
                    type="date"
                    defaultValue={today()}
                    max={today()}
                    required
                  />
                </label>
                <div className="form-actions">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setModal(null)}
                  >
                    Cancelar
                  </Button>
                  <Button disabled={busy}>
                    {busy ? "Salvando…" : "Salvar investimento"}
                  </Button>
                </div>
              </form>
            ) : (
              <form
                onSubmit={saveEntry}
                aria-describedby={formError ? "save-error" : undefined}
                onChange={() => setFormError("")}
              >
                {["income", "expense"].includes(formKind) && (
                  <div className="type-toggle">
                    {(["income", "expense"] as Kind[]).map((k) => (
                      <button
                        type="button"
                        className={formKind === k ? k + " selected" : ""}
                        onClick={() => setFormKind(k)}
                        key={k}
                      >
                        {k === "income" ? (
                          <ArrowDownLeft size={17} />
                        ) : (
                          <ArrowUpRight size={17} />
                        )}{" "}
                        {labels[k]}
                      </button>
                    ))}
                  </div>
                )}
                {selected && (
                  <p className="mini-tag">
                    {selected.name} · Atual:{" "}
                    {fmt(position(state, selected).current)}
                  </p>
                )}
                <label>
                  Descrição
                  <input
                    name="description"
                    required
                    maxLength={120}
                    placeholder="Ex.: Compras da semana"
                    defaultValue={
                      edit?.description ??
                      (selected ? labels[formKind] + " · " + selected.name : "")
                    }
                  />
                </label>
                <div className="form-grid">
                  <MoneyInput
                    key={edit?.id ?? "new"}
                    label={
                      formKind === "valuation"
                        ? edit
                          ? "Diferença de valor (R$)"
                          : "Novo valor atual (R$)"
                        : "Valor (R$)"
                    }
                    name="amount"
                    initial={
                      edit?.amount ??
                      (formKind === "valuation" && selected
                        ? position(state, selected).current
                        : undefined)
                    }
                    signed={
                      formKind === "adjustment" ||
                      (formKind === "valuation" && !!edit)
                    }
                  />
                  <label>
                    Data
                    <input
                      name="date"
                      type="date"
                      defaultValue={edit?.date ?? today()}
                      max={today()}
                      required
                    />
                  </label>
                </div>
                {["income", "expense"].includes(formKind) && (
                  <label>
                    Categoria
                    <select
                      name="category"
                      defaultValue={edit?.category}
                      key={formKind}
                    >
                      {state.categories[formKind as "income" | "expense"].map(
                        (c) => (
                          <option key={c}>{c}</option>
                        ),
                      )}
                    </select>
                  </label>
                )}
                <label>
                  Conta
                  <input readOnly value="Conta corrente" />
                </label>
                <label>
                  Observações <span className="muted">(opcional)</span>
                  <textarea
                    name="notes"
                    maxLength={1000}
                    defaultValue={edit?.notes}
                    rows={2}
                  />
                </label>
                <div className="form-actions">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModal(null)}
                  >
                    Cancelar
                  </Button>
                  <Button disabled={busy}>
                    {busy ? "Salvando…" : "Salvar movimentação"}
                  </Button>
                </div>
              </form>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {notice && !modal && (
        <div
          className={"toast " + (noticeIsError ? "toast-error" : "")}
          role={noticeIsError ? "alert" : "status"}
        >
          {noticeIsError ? <AlertCircle size={18} /> : <Check size={18} />}
          <span>{notice}</span>
          <button onClick={() => setNotice("")} aria-label="Fechar mensagem">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
function MoneyInput({
  label,
  name,
  initial,
  signed = false,
}: {
  label: string;
  name: string;
  initial?: number;
  signed?: boolean;
}) {
  const [value, setValue] = useState(
    initial === undefined
      ? ""
      : (initial / 100).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
  );
  return (
    <label>
      {label}
      <input
        name={name}
        maxLength={24}
        inputMode={signed ? "text" : "decimal"}
        value={value}
        placeholder="0,00"
        required
        onChange={(e) =>
          setValue(
            e.target.value.replace(signed ? /[^\d.,-]/g : /[^\d.,]/g, ""),
          )
        }
        onBlur={() => {
          try {
            setValue(
              (parseMoney(value) / 100).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }),
            );
          } catch {}
        }}
      />
    </label>
  );
}
