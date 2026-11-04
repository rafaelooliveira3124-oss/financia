import { useEffect, useState } from "react";
const routes = {
  Dashboard: "dashboard",
  Movimentações: "movimentacoes",
  Investimentos: "investimentos",
  Configurações: "configuracoes",
} as const;
type Page = keyof typeof routes;
export function pageHref(page: Page) {
  return "#" + routes[page];
}
function currentPage(): Page {
  return (
    (Object.keys(routes) as Page[]).find(
      (page) => routes[page] === window.location.hash.slice(1),
    ) ?? "Dashboard"
  );
}
export function usePageNavigation(): [Page, (page: Page) => void] {
  const [page, setPage] = useState<Page>(currentPage);
  useEffect(() => {
    const update = () => setPage(currentPage());
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
    };
  }, []);
  return [
    page,
    (next) => {
      if (next === page) return;
      setPage(next);
      try {
        window.history.pushState(null, "", pageHref(next));
      } catch {
        window.location.hash = routes[next];
      }
    },
  ];
}
