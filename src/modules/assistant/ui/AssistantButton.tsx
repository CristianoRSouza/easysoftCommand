import { lazy, Suspense, useState } from "react";
import { Sparkles } from "lucide-react";

// O painel traz o leitor de Markdown; só é baixado quando alguém abre o chat.
const AssistantPanel = lazy(() =>
  import("./AssistantPanel").then((m) => ({ default: m.AssistantPanel })),
);

/** O botão flutuante do assistente, no canto de todas as telas. */
export function AssistantButton() {
  const [aberto, setAberto] = useState(false);

  if (aberto) {
    return (
      <Suspense fallback={null}>
        <AssistantPanel onClose={() => setAberto(false)} />
      </Suspense>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label="Abrir o assistente de IA"
        title="Assistente IA"
        className="group relative flex h-14 w-14 items-center justify-center rounded-full transition-transform duration-300 ease-out hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95"
      >
        <span
          className="pointer-events-none absolute -inset-2 rounded-full opacity-70 blur-xl"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.45), transparent 70%)" }}
        />
        <span
          className="pointer-events-none absolute inset-0 animate-ai-conic-spin rounded-full opacity-90"
          style={{
            background:
              "conic-gradient(from 0deg, hsl(var(--primary)), hsl(var(--primary) / 0.15), hsl(var(--primary)), hsl(var(--primary) / 0.15), hsl(var(--primary)))",
          }}
        />
        <span className="absolute inset-[2px] flex animate-ai-breathe items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-background via-card to-background">
          <span className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary/10 via-transparent to-primary/20" />
          <Sparkles size={20} strokeWidth={2.2} className="relative text-primary" />
        </span>
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="absolute h-1.5 w-1.5 animate-ai-orbit rounded-full bg-primary shadow-[0_0_8px_2px_hsl(var(--primary)/0.7)]" />
        </span>
      </button>
    </div>
  );
}
