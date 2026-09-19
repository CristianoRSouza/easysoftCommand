import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArrowLeft, History, Search, Send, Sparkles, Square, Trash2, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { historyMatcher, suggestionsFor, type ChatMessage } from "../domain/chat";
import type { CreditSummary } from "../domain/credits";
import { MessageBubble } from "./MessageBubble";
import { useAssistant } from "./useAssistant";

type Vista = "chat" | "historico" | "conversa";

interface Dia {
  day: string;
  ids: string[];
  apps: string[];
  messages: ChatMessage[];
}

const NOME_DO_APP: Record<string, string> = {
  "easyfood-manager": "EasyFoodManager",
  easycommandpay: "EasyFoodManager",
  easyml: "EasyML",
};

function rotuloDoDia(day: string): string {
  const [ano = 0, mes = 1, dia = 1] = day.split("-").map(Number);
  const data = new Date(ano, mes - 1, dia);
  const ontem = new Date();
  ontem.setHours(0, 0, 0, 0);
  ontem.setDate(ontem.getDate() - 1);
  if (data.getTime() === ontem.getTime()) return "Ontem";
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function subtitulo(creditos: CreditSummary | null): string {
  if (!creditos) return "";
  if (creditos.freeRemaining > 0) {
    return `${creditos.freeRemaining} consulta${creditos.freeRemaining !== 1 ? "s" : ""} grátis hoje`;
  }
  if (creditos.balance > 0) {
    return `${creditos.balance} crédito${creditos.balance !== 1 ? "s" : ""} disponíveis`;
  }
  return "Sem créditos — acesse Créditos IA";
}

const BOTAO_ICONE =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground";

export function AssistantPanel({ onClose }: { onClose: () => void }) {
  const { messages, history, loaded, streaming, error, credits, send, stop, deleteDay, clearHistory } =
    useAssistant();
  const { pathname } = useLocation();

  const [entrada, setEntrada] = useState("");
  const [vista, setVista] = useState<Vista>("chat");
  const [aberto, setAberto] = useState<Dia | null>(null);
  const [busca, setBusca] = useState("");
  const rolagem = useRef<HTMLDivElement>(null);
  const caixa = useRef<HTMLTextAreaElement>(null);
  const colado = useRef(true);

  // Acompanha a resposta enquanto ela chega — a não ser que a pessoa tenha
  // subido para reler algo; aí a rolagem fica onde ela deixou.
  useEffect(() => {
    const el = rolagem.current;
    if (vista === "chat" && el && colado.current) el.scrollTop = el.scrollHeight;
  }, [messages, streaming, vista]);

  useEffect(() => {
    if (vista === "chat") caixa.current?.focus();
  }, [vista]);

  useEffect(() => {
    const tecla = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (vista === "conversa") setVista("historico");
      else if (vista === "historico") setVista("chat");
      else onClose();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [vista, onClose]);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [entrada]);

  // O histórico é agrupado por dia: no mesmo dia pode haver conversa de mais
  // de um aplicativo.
  const dias = useMemo(() => {
    const confere = historyMatcher(busca);
    const porDia = new Map<string, Dia>();
    for (const sessao of history) {
      const dia = porDia.get(sessao.day) ?? { day: sessao.day, ids: [], apps: [], messages: [] };
      dia.ids.push(sessao.id);
      if (sessao.app && !dia.apps.includes(sessao.app)) dia.apps.push(sessao.app);
      dia.messages.push(...sessao.messages);
      porDia.set(sessao.day, dia);
    }
    return [...porDia.values()]
      .filter((dia) => confere(`${rotuloDoDia(dia.day)} ${dia.day} ${dia.messages.map((m) => m.content).join(" ")}`))
      .sort((a, b) => b.day.localeCompare(a.day));
  }, [history, busca]);

  function enviar(texto = entrada) {
    if (!texto.trim() || streaming) return;
    void send(texto);
    setEntrada("");
    colado.current = true;
  }

  function aoTeclar(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  }

  const titulo = vista === "chat" ? "Assistente IA" : vista === "historico" ? "Histórico" : "Conversa anterior";
  const legenda =
    vista === "chat"
      ? subtitulo(credits)
      : vista === "historico"
        ? `${dias.length} dia${dias.length !== 1 ? "s" : ""} com conversa`
        : aberto
          ? `${rotuloDoDia(aberto.day)} • ${aberto.messages.length} mensagens`
          : "";
  const esperandoPrimeiraPalavra = streaming && messages[messages.length - 1]?.role !== "assistant";

  return (
    <div className="fixed inset-0 z-50 flex h-[100dvh] w-full flex-col overflow-hidden bg-background shadow-2xl sm:inset-auto sm:bottom-4 sm:right-4 sm:h-[min(640px,calc(100vh-2rem))] sm:w-[420px] sm:rounded-2xl sm:border sm:border-border">
      <div className="flex items-center justify-between border-b border-border bg-gradient-to-br from-primary/5 via-card to-card px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {vista !== "chat" ? (
            <button
              className={BOTAO_ICONE}
              onClick={() => setVista(vista === "conversa" ? "historico" : "chat")}
              aria-label="Voltar"
            >
              <ArrowLeft size={16} />
            </button>
          ) : (
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-sm">
              <Sparkles size={16} className="text-primary-foreground" />
              {streaming && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-success ring-2 ring-background" />
              )}
            </div>
          )}
          <div className="min-w-0 leading-tight">
            <h3 className="truncate text-sm font-semibold">{titulo}</h3>
            <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">{legenda}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {vista === "chat" && (
            <button className={`${BOTAO_ICONE} relative`} onClick={() => setVista("historico")} title="Histórico">
              <History size={15} />
              {history.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                  {dias.length > 9 ? "9+" : dias.length}
                </span>
              )}
            </button>
          )}
          {vista === "historico" && history.length > 0 && (
            <button
              className={BOTAO_ICONE}
              title="Apagar o meu histórico"
              onClick={() => {
                if (confirm("Apagar as suas conversas anteriores? As de outras pessoas da empresa continuam.")) {
                  void clearHistory();
                }
              }}
            >
              <Trash2 size={15} />
            </button>
          )}
          <button className={BOTAO_ICONE} onClick={onClose} title="Fechar (Esc)">
            <X size={16} />
          </button>
        </div>
      </div>

      {error && (
        <p className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">{error}</p>
      )}

      {vista === "chat" && (
        <>
          <div
            ref={rolagem}
            onScroll={(e) => {
              const el = e.currentTarget;
              colado.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
            }}
            className="flex-1 overflow-y-auto px-4 py-3"
          >
            {!loaded ? (
              <p className="py-10 text-center text-xs text-muted-foreground">Carregando a conversa...</p>
            ) : messages.length === 0 && !streaming ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 py-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/10">
                  <Sparkles size={28} className="text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold">Olá! Como posso ajudar?</p>
                  <p className="max-w-[280px] text-xs text-muted-foreground">
                    Tire dúvidas sobre o sistema ou peça ajuda com tarefas.
                  </p>
                </div>
                <div className="mt-1 w-full space-y-1.5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                    Sugestões para esta página
                  </p>
                  {suggestionsFor(pathname).map((pergunta) => (
                    <button
                      key={pergunta}
                      onClick={() => enviar(pergunta)}
                      className="block w-full rounded-lg border border-border/60 bg-card px-3 py-2 text-left text-xs transition-colors hover:border-primary/30 hover:bg-secondary"
                    >
                      {pergunta}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <MessageBubble key={i} msg={msg} onNavigate={onClose} />
                ))}
                {esperandoPrimeiraPalavra && (
                  <MessageBubble msg={{ role: "assistant", content: "" }} onNavigate={onClose} />
                )}
              </>
            )}
          </div>

          <div className="border-t border-border bg-card/50 p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={caixa}
                value={entrada}
                onChange={(e) => setEntrada(e.target.value)}
                onKeyDown={aoTeclar}
                placeholder="Pergunte algo…"
                rows={1}
                disabled={streaming || !loaded}
                className="max-h-[120px] min-h-[44px] flex-1 resize-none overflow-y-auto rounded-lg border border-border bg-input px-3 py-2.5 text-sm leading-snug outline-none placeholder:text-muted-foreground focus:border-primary disabled:opacity-60"
              />
              {streaming ? (
                <button
                  onClick={stop}
                  title="Parar a resposta"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border transition-colors hover:bg-secondary"
                >
                  <Square size={13} className="fill-current" />
                </button>
              ) : (
                <button
                  onClick={() => enviar()}
                  disabled={!entrada.trim() || !loaded}
                  title="Enviar"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                >
                  <Send size={15} />
                </button>
              )}
            </div>
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground/70">
              Enter envia · Shift+Enter quebra linha · As respostas podem conter imprecisões.
            </p>
          </div>
        </>
      )}

      {vista === "historico" && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {history.length > 0 && (
            <div className="border-b border-border/40 px-3 pb-2 pt-3">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder='Buscar:  "frase exata"  ou  pedido*'
                  className="h-8 w-full rounded-lg border border-border bg-input pl-8 pr-3 text-xs outline-none focus:border-primary"
                />
              </div>
            </div>
          )}
          <div className="flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
            {history.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-medium">Nenhuma conversa anterior</p>
                <p className="mx-auto mt-1 max-w-[260px] text-xs text-muted-foreground">
                  As conversas vão para o histórico quando o dia vira.
                </p>
              </div>
            ) : dias.length === 0 ? (
              <p className="py-10 text-center text-xs text-muted-foreground">Nenhum resultado para “{busca}”.</p>
            ) : (
              dias.map((dia) => (
                <div
                  key={dia.day}
                  className="group relative rounded-lg border border-border/60 bg-card transition-colors hover:border-primary/30 hover:bg-secondary"
                >
                  <button
                    onClick={() => {
                      setAberto(dia);
                      setVista("conversa");
                    }}
                    className="w-full px-3 py-2.5 pr-9 text-left"
                  >
                    <span className="mb-0.5 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium">{rotuloDoDia(dia.day)}</span>
                      <span className="text-[10px] font-medium text-muted-foreground">{dia.messages.length} msg</span>
                    </span>
                    {dia.apps.length > 0 && (
                      <span className="mb-1 flex flex-wrap gap-1">
                        {dia.apps.map((app) => (
                          <span key={app} className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[9.5px] font-medium text-primary">
                            {NOME_DO_APP[app] ?? app}
                          </span>
                        ))}
                      </span>
                    )}
                    <span className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                      {dia.messages.find((m) => m.role === "user")?.content ?? "(sem mensagens)"}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Apagar as conversas de ${rotuloDoDia(dia.day)}?`)) void deleteDay(dia.ids);
                    }}
                    className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    aria-label="Apagar o dia"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {vista === "conversa" && aberto && (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {aberto.messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} onNavigate={onClose} />
          ))}
          <p className="mt-4 pb-2 text-center text-[10px] text-muted-foreground/70">
            Conversa arquivada • somente leitura
          </p>
        </div>
      )}
    </div>
  );
}
