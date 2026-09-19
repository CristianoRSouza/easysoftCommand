import type { ChatMessage, ChatSession } from "../domain/chat";
import type { UsageEntry } from "../domain/credits";

export interface AssistantRepository {
  /** Quem está usando — a conversa de hoje é a deste usuário. */
  currentUserId(): Promise<string | null>;
  /** As conversas da empresa, da mais recente para a mais antiga. */
  sessions(): Promise<ChatSession[]>;
  /**
   * Grava a conversa de hoje.
   *
   * ⚠️ A chave única da tabela é (usuário, dia), sem o aplicativo: quem
   * conversou no EasyML hoje tem essa conversa sobrescrita pela deste painel,
   * e vice-versa. O projeto anterior faz o mesmo; a correção é incluir `app`
   * na chave, no banco.
   */
  saveToday(messages: ChatMessage[]): Promise<void>;
  deleteSession(id: string): Promise<void>;
  /** Apaga as conversas do usuário, menos a de hoje, que está aberta. */
  clearHistory(): Promise<void>;
  /** Pergunta ao EasyAI; o texto chega em pedaços, por `onDelta`. */
  ask(
    messages: Pick<ChatMessage, "role" | "content">[],
    onDelta: (texto: string) => void,
    signal: AbortSignal,
  ): Promise<void>;
  usage(): Promise<UsageEntry[]>;
  /** Os valores do extrato de créditos da loja; a soma é o saldo. */
  creditMovements(): Promise<number[]>;
}
