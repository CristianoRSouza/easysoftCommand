import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { panelRoute, type ChatMessage } from "../domain/chat";

function Copiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(texto);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1500);
      }}
      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-secondary hover:text-foreground group-hover:opacity-100"
      aria-label="Copiar"
    >
      {copiado ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

/** Três pontos enquanto a primeira palavra da resposta não chega. */
function Digitando() {
  return (
    <span className="inline-flex gap-1 py-0.5">
      {[0, 150, 300].map((atraso) => (
        <span
          key={atraso}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50"
          style={{ animationDelay: `${atraso}ms` }}
        />
      ))}
    </span>
  );
}

/**
 * Uma mensagem da conversa.
 *
 * Link interno da resposta navega dentro do painel e fecha o chat; o
 * assistente ainda cita as rotas do projeto anterior, e `panelRoute` as
 * traduz. Link externo abre em outra aba.
 */
export function MessageBubble({ msg, onNavigate }: { msg: ChatMessage; onNavigate: () => void }) {
  const navigate = useNavigate();
  const doUsuario = msg.role === "user";

  function abrirInterno(href: string) {
    const [rota, ancora] = href.split("#");
    if (rota) navigate(panelRoute(rota));
    onNavigate();
    if (ancora) {
      setTimeout(() => document.getElementById(ancora)?.scrollIntoView({ behavior: "smooth" }), 150);
    }
  }

  return (
    <div className={`group mb-3 flex gap-2 ${doUsuario ? "justify-end" : "justify-start"}`}>
      {!doUsuario && (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/10">
          <Sparkles size={14} className="text-primary" />
        </div>
      )}
      <div className={`flex max-w-[85%] flex-col gap-1 ${doUsuario ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
            doUsuario
              ? "rounded-br-md bg-primary text-primary-foreground"
              : "rounded-bl-md border border-border/40 bg-muted/70 text-foreground"
          }`}
        >
          {doUsuario ? (
            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
          ) : msg.content ? (
            <div className="chat-md break-words">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children }) => {
                    const interno = !!href && (href.startsWith("#") || (href.startsWith("/") && !href.startsWith("//")));
                    return interno ? (
                      <a
                        href={href}
                        onClick={(e) => {
                          e.preventDefault();
                          abrirInterno(href);
                        }}
                      >
                        {children}
                      </a>
                    ) : (
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        {children}
                      </a>
                    );
                  },
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
          ) : (
            <Digitando />
          )}
        </div>
        {!doUsuario && msg.content && <Copiar texto={msg.content} />}
      </div>
    </div>
  );
}
