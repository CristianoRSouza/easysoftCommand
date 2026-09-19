import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { splitSessions, todayKey, type ChatMessage, type ChatSession } from "../domain/chat";
import { summarizeCredits, type CreditSummary } from "../domain/credits";
import { useContainer } from "@/shared/container/container-context";

/**
 * A conversa com o assistente.
 *
 * A conversa só é gravada depois de carregada do servidor. O projeto anterior
 * guardava uma cópia no navegador e a gravava ao abrir o painel, antes de a
 * versão do servidor chegar — a cópia velha podia sobrescrever a conversa
 * real. Aqui não há cópia local: o servidor é a única fonte.
 */
export function useAssistant() {
  const { assistant } = useContainer();
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<ChatSession[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const diaCarregado = useRef(todayKey());
  const abortar = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    try {
      const [userId, sessoes] = await Promise.all([assistant.currentUserId(), assistant.sessions()]);
      if (!userId) return;
      const hoje = todayKey();
      const { today, history: anteriores } = splitSessions(sessoes, userId, hoje);
      diaCarregado.current = hoje;
      setMessages(today?.messages ?? []);
      setHistory(anteriores);
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar as conversas.");
    }
  }, [assistant]);

  useEffect(() => {
    void load();
  }, [load]);

  // Virou o dia com o painel aberto: a conversa de ontem vai para o histórico.
  useEffect(() => {
    const conferir = () => {
      if (todayKey() !== diaCarregado.current) void load();
    };
    const intervalo = window.setInterval(conferir, 60_000);
    document.addEventListener("visibilitychange", conferir);
    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", conferir);
    };
  }, [load]);

  /** Grava a conversa de hoje. */
  const persist = useCallback(
    async (lista: ChatMessage[]) => {
      try {
        await assistant.saveToday(lista);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Não foi possível gravar a conversa.");
      }
    },
    [assistant],
  );

  const credits = useQuery<CreditSummary>({
    queryKey: ["assistente", "creditos"],
    queryFn: async () => {
      const [uso, movimentos] = await Promise.all([assistant.usage(), assistant.creditMovements()]);
      return summarizeCredits(uso, movimentos);
    },
    // Compra feita em outra aba aparece sem precisar recarregar.
    refetchInterval: 30_000,
  });

  // O texto chega palavra a palavra. Juntar os pedaços e desenhar uma vez por
  // quadro evita uma renderização por palavra.
  const acumulado = useRef("");
  const quadro = useRef<number | null>(null);

  const desenhar = useCallback(() => {
    quadro.current = null;
    const texto = acumulado.current;
    setMessages((atual) => {
      const ultima = atual[atual.length - 1];
      return ultima?.role === "assistant"
        ? [...atual.slice(0, -1), { ...ultima, content: texto }]
        : [...atual, { role: "assistant", content: texto, ts: Date.now() }];
    });
  }, []);

  const send = useCallback(
    async (entrada: string) => {
      const texto = entrada.trim();
      if (!texto || streaming || !loaded) return;

      const conversa: ChatMessage[] = [...messages, { role: "user", content: texto, ts: Date.now() }];
      setMessages(conversa);
      setStreaming(true);
      setError(null);
      acumulado.current = "";
      const controle = new AbortController();
      abortar.current = controle;

      try {
        await assistant.ask(
          conversa.map(({ role, content }) => ({ role, content })),
          (pedaco) => {
            acumulado.current += pedaco;
            quadro.current ??= requestAnimationFrame(desenhar);
          },
          controle.signal,
        );
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setError(e instanceof Error ? e.message : "Não foi possível falar com o assistente.");
        }
      } finally {
        if (quadro.current !== null) cancelAnimationFrame(quadro.current);
        quadro.current = null;
        abortar.current = null;
        setStreaming(false);
        // A resposta, completa ou interrompida, entra na conversa gravada.
        const resposta = acumulado.current;
        const final: ChatMessage[] = resposta
          ? [...conversa, { role: "assistant", content: resposta, ts: Date.now() }]
          : conversa;
        setMessages(final);
        void persist(final);
        void queryClient.invalidateQueries({ queryKey: ["assistente", "creditos"] });
      }
    },
    [assistant, desenhar, loaded, messages, persist, queryClient, streaming],
  );

  const stop = useCallback(() => abortar.current?.abort(), []);

  /** Apaga um dia do histórico — pode ter mais de uma conversa, uma por aplicativo. */
  const deleteDay = useCallback(
    async (ids: string[]) => {
      setHistory((atual) => atual.filter((s) => !ids.includes(s.id)));
      try {
        await Promise.all(ids.map((id) => assistant.deleteSession(id)));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Não foi possível apagar.");
        void load();
      }
    },
    [assistant, load],
  );

  const clearHistory = useCallback(async () => {
    try {
      await assistant.clearHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível apagar o histórico.");
    }
    // Relê em vez de esvaziar: as conversas de colegas continuam existindo.
    void load();
  }, [assistant, load]);

  return {
    messages,
    history,
    loaded,
    streaming,
    error,
    credits: credits.data ?? null,
    send,
    stop,
    deleteDay,
    clearHistory,
  };
}
