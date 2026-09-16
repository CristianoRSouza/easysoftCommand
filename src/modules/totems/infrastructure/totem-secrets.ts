import type { SupabaseClient } from "@supabase/supabase-js";
import { isNewValue, type SecretEdit } from "@/shared/domain/secret-edit";

/**
 * Cifragem dos segredos TEF da Aditum.
 *
 * A chave mestra não vive no navegador — e não pode viver, porque qualquer
 * coisa entregue ao cliente é legível por quem abrir as ferramentas de
 * desenvolvedor. Ela fica nos segredos do Supabase, e a cifragem acontece
 * dentro de uma função de borda que devolve só o texto cifrado.
 *
 * O nome do parâmetro `ativation_code` está escrito assim mesmo: é o contrato
 * da função já publicada. Corrigir a grafia aqui quebraria a chamada.
 */
const FUNCTION_NAME = "encrypt-totem-tef-secrets";

interface EncryptResponse {
  ok?: boolean;
  error?: string;
  partner_token_encrypted?: string | null;
  partner_token_kid?: string | null;
  ativation_code_encrypted?: string | null;
  ativation_code_kid?: string | null;
}

/** O par cifrado de um segredo, ou `undefined` para "não mexer nesta coluna". */
type Cipher = { encrypted: string | null; kid: string | null } | undefined;

export interface EncryptedTefSecrets {
  partnerToken: Cipher;
  activationCode: Cipher;
}

/**
 * Cifra o que precisa ser cifrado e devolve as colunas a gravar.
 *
 * "Manter" não vira coluna nenhuma: o valor cifrado atual permanece onde está,
 * sem ser lido nem reescrito. "Apagar" grava nulo nas duas colunas — deixar o
 * `_kid` para trás apontaria para um segredo que não existe mais.
 */
export async function encryptTefSecrets(
  client: SupabaseClient,
  partnerToken: SecretEdit,
  activationCode: SecretEdit,
): Promise<EncryptedTefSecrets> {
  const limpar = { encrypted: null, kid: null };
  const partnerNovo = isNewValue(partnerToken);
  const activationNovo = isNewValue(activationCode);

  if (!partnerNovo && !activationNovo) {
    return {
      partnerToken: partnerToken.action === "clear" ? limpar : undefined,
      activationCode: activationCode.action === "clear" ? limpar : undefined,
    };
  }

  const { data, error } = await client.functions.invoke<EncryptResponse>(FUNCTION_NAME, {
    body: {
      partner_token: partnerNovo ? partnerToken.value.trim() : null,
      ativation_code: activationNovo ? activationCode.value.trim() : null,
    },
  });

  if (error) throw new Error(`Falha ao cifrar os segredos TEF: ${error.message}`);
  if (!data?.ok) {
    throw new Error(`Falha ao cifrar os segredos TEF: ${data?.error ?? "resposta inesperada"}`);
  }

  return {
    partnerToken: partnerNovo
      ? { encrypted: data.partner_token_encrypted ?? null, kid: data.partner_token_kid ?? null }
      : partnerToken.action === "clear"
        ? limpar
        : undefined,
    activationCode: activationNovo
      ? { encrypted: data.ativation_code_encrypted ?? null, kid: data.ativation_code_kid ?? null }
      : activationCode.action === "clear"
        ? limpar
        : undefined,
  };
}
