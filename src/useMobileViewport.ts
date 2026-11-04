import { useEffect } from "react";
// Teclados móveis podem reduzir apenas o visualViewport, mantendo o layout maior.
export function useMobileViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      document.documentElement.style.setProperty(
        "--visual-height",
        `${viewport.height}px`,
      );
      const bottom = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop,
      );
      document.documentElement.style.setProperty(
        "--keyboard-inset",
        `${bottom}px`,
      );
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.documentElement.style.removeProperty("--visual-height");
      document.documentElement.style.removeProperty("--keyboard-inset");
    };
  }, []);
}
