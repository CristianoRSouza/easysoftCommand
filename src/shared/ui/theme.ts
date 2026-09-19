/**
 * Tema claro ou escuro — preferência de quem usa este navegador.
 *
 * Aplicado antes da primeira renderização (em `main.tsx`): aplicar depois
 * faria a tela piscar escura a cada abertura para quem escolheu o claro.
 */
export type Theme = "dark" | "light";

const CHAVE = "easycommand.tema";

export function readTheme(): Theme {
  try {
    return localStorage.getItem(CHAVE) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(tema: Theme) {
  document.documentElement.classList.toggle("light", tema === "light");
  try {
    localStorage.setItem(CHAVE, tema);
  } catch {
    // Sem armazenamento, o tema vale até recarregar.
  }
}
