import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { applyTheme, readTheme } from "./theme";

/** O botão de tema, no mesmo lugar do projeto anterior: o último do cabeçalho. */
export function ThemeToggle() {
  const [tema, setTema] = useState(readTheme);
  const claro = tema === "light";
  return (
    <button
      onClick={() => {
        const proximo = claro ? "dark" : "light";
        applyTheme(proximo);
        setTema(proximo);
      }}
      aria-label={claro ? "Usar tema escuro" : "Usar tema claro"}
      title={claro ? "Tema escuro" : "Tema claro"}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      {claro ? <Moon size={15} /> : <Sun size={15} />}
    </button>
  );
}
