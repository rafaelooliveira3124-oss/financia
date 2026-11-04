export type Kind =
  | "income"
  | "expense"
  | "contribution"
  | "withdrawal"
  | "adjustment"
  | "valuation";
export type Entry = {
  id: string;
  kind: Kind;
  description: string;
  amount: number;
  category: string;
  date: string;
  notes: string;
  investmentId?: string;
};
export type Investment = {
  id: string;
  name: string;
  type: string;
  institution: string;
  principal: number;
  current: number;
  date: string;
};
export type State = {
  opening: number;
  entries: Entry[];
  investments: Investment[];
  categories: { income: string[]; expense: string[] };
};
export const categories = {
  income: ["Salário", "Renda extra", "Freelance", "Presentes", "Outros"],
  expense: [
    "Alimentação",
    "Moradia",
    "Transporte",
    "Saúde",
    "Educação",
    "Lazer",
    "Compras",
    "Assinaturas",
    "Outros",
  ],
};
export const empty = (): State => ({
  opening: 0,
  entries: [],
  investments: [],
  categories: {
    income: [...categories.income],
    expense: [...categories.expense],
  },
});
export const today = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};
export const money = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    v / 100,
  );
export function parseMoney(s: string) {
  let value = s.trim();
  // Aceita o separador decimal enviado por teclados de celular em inglês.
  if (!value.includes(",") && /^-?\d+\.\d{1,2}$/.test(value))
    value = value.replace(".", ",");
  if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(value))
    throw Error("Informe um valor válido, como 1.234,56.");
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = value.replace("-", "").split(",");
  const cents =
    (Number(whole.replace(/\./g, "")) * 100 + Number(fraction.padEnd(2, "0"))) *
    (negative ? -1 : 1);
  if (!Number.isSafeInteger(cents) || Math.abs(cents) > 100000000000000)
    throw Error("Informe um valor válido.");
  return cents;
}
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T12:00:00Z");
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
export function position(s: State, i: Investment) {
  const e = s.entries.filter((e) => e.investmentId === i.id);
  return {
    principal:
      i.principal +
      e.reduce(
        (v, e) =>
          v +
          (e.kind === "contribution"
            ? e.amount
            : e.kind === "withdrawal"
              ? -e.amount
              : 0),
        0,
      ),
    current:
      i.current +
      e.reduce(
        (v, e) =>
          v +
          (e.kind === "withdrawal"
            ? -e.amount
            : e.kind === "contribution" || e.kind === "valuation"
              ? e.amount
              : 0),
        0,
      ),
  };
}
export function totals(s: State, start = "0000-01-01", end = "9999-12-31") {
  let cash = s.opening,
    income = 0,
    expense = 0;
  for (const e of s.entries) {
    cash +=
      e.kind === "income" || e.kind === "withdrawal" || e.kind === "adjustment"
        ? e.amount
        : e.kind === "expense" || e.kind === "contribution"
          ? -e.amount
          : 0;
    if (e.date >= start && e.date <= end) {
      if (e.kind === "income") income += e.amount;
      if (e.kind === "expense") expense += e.amount;
    }
  }
  const invested = s.investments.reduce(
    (v, i) => v + position(s, i).current,
    0,
  );
  return {
    cash,
    income,
    expense,
    result: income - expense,
    invested,
    wealth: cash + invested,
  };
}
export function demo(): State {
  const s = empty(),
    m = today().slice(0, 7);
  s.opening = 280000;
  s.investments = [
    {
      id: "inv1",
      name: "Reserva de emergência",
      type: "CDB",
      institution: "Nubank",
      principal: 1000000,
      current: 1065000,
      date: today(),
    },
    {
      id: "inv2",
      name: "Tesouro IPCA+ 2029",
      type: "Tesouro Direto",
      institution: "Nu Invest",
      principal: 500000,
      current: 535000,
      date: today(),
    },
  ];
  s.entries = [
    ["Salário mensal", "income", 750000, "Salário", "03"],
    ["Supermercado", "expense", 48690, "Alimentação", "03"],
    ["Aluguel do apartamento", "expense", 180000, "Moradia", "02"],
    ["Projeto de design", "income", 120000, "Freelance", "02"],
    ["Spotify Premium", "expense", 2190, "Assinaturas", "01"],
    ["Café com amigos", "expense", 6800, "Lazer", "01"],
  ].map((a, n) => ({
    id: "demo" + n,
    description: String(a[0]),
    kind: a[1] as Kind,
    amount: Number(a[2]),
    category: String(a[3]),
    date: m + "-" + a[4],
    notes: "",
  }));
  return s;
}
export function period(key: string, customStart: string, customEnd: string) {
  const d = today(),
    y = +d.slice(0, 4),
    m = +d.slice(5, 7);
  const date = (y: number, m: number, day: number) =>
    new Date(Date.UTC(y, m, day)).toISOString().slice(0, 10);
  if (key === "custom") return [customStart, customEnd];
  if (key === "year") return [`${y}-01-01`, `${y}-12-31`];
  const shift = key === "previous" ? -1 : key === "quarter" ? -2 : 0;
  return [
    date(y, m - 1 + shift, 1),
    key === "previous" ? date(y, m - 1, 0) : date(y, m, 0),
  ];
}
