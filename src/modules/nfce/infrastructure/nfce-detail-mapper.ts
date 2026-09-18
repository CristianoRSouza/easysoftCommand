import { asIsoDate, asNumber, asText } from "@/shared/infrastructure/convert";
import { cardBrandName, paymentMethodName } from "./nfce-payment-codes";
import type {
  NfceDocuments,
  NfceFiscalTotals,
  NfceHistoryEntry,
  NfceIdentification,
  NfceIssuer,
  NfceItem,
  NfcePayment,
  NfceRecipient,
  NfceRecovery,
  TaxReformTotals,
} from "../domain/nfce-detail";

/**
 * Tradutores das linhas do detalhe.
 *
 * Ficam num arquivo só porque as duas fontes nomeiam as colunas igual — a
 * divergência entre elas está em *onde* os dados moram (tabelas no PostgreSQL,
 * views no Supabase), não em como cada linha é escrita. Repetir estes
 * mapeamentos nos dois repositórios seria criar duas versões da mesma verdade.
 */

type Row = Record<string, unknown>;

/** Junta as partes do endereço que existirem, sem sobrar separador solto. */
function joinAddress(row: Row): string | null {
  const parts = [
    asText(row.street) ?? asText(row.address),
    asText(row.number),
    asText(row.complement),
    asText(row.district) ?? asText(row.neighborhood),
  ].filter((part): part is string => part !== null);
  return parts.length ? parts.join(", ") : null;
}

export function toIssuer(row: Row): NfceIssuer {
  return {
    cnpj: asText(row.cnpj) ?? "",
    companyName: asText(row.company_name) ?? "",
    tradeName: asText(row.trade_name),
    stateRegistration: asText(row.state_registration) ?? asText(row.ie),
    address: joinAddress(row),
    city: asText(row.city) ?? asText(row.municipality),
    uf: asText(row.uf) ?? "",
  };
}

/** `null` quando a nota saiu sem consumidor identificado — o caso comum na NFC-e. */
export function toRecipient(row: Row | null | undefined): NfceRecipient | null {
  if (!row) return null;
  const document = asText(row.cpf) ?? asText(row.cnpj);
  const name = asText(row.name);
  const email = asText(row.email);
  if (!document && !name && !email) return null;
  return { document, name, email };
}

export function toTotals(row: Row): NfceFiscalTotals {
  return {
    products: asNumber(row.products_value ?? row.total_products),
    discount: asNumber(row.discount_value),
    freight: asNumber(row.freight_value),
    insurance: asNumber(row.insurance_value),
    otherExpenses: asNumber(row.other_expenses_value),
    note: asNumber(row.total_value),
    icms: asNumber(row.icms_value),
    pis: asNumber(row.pis_value),
    cofins: asNumber(row.cofins_value),
    approximateTaxes: asNumber(row.total_taxes_value ?? row.icms_tot_v_tot_trib),
  };
}

export function toItem(row: Row): NfceItem {
  return {
    sequence: asNumber(row.item_number),
    productCode: asText(row.product_code) ?? "",
    description: asText(row.description) ?? "",
    ncm: asText(row.ncm) ?? "",
    cfop: asText(row.cfop) ?? "",
    unit: asText(row.unit) ?? "",
    quantity: asNumber(row.quantity),
    unitPrice: asNumber(row.unit_price),
    grossValue: asNumber(row.gross_total),
    discount: asNumber(row.discount_value),
    icmsValue: asNumber(row.icms_value),
  };
}

/**
 * Converte a linha de pagamento.
 *
 * Os nomes de coluna vêm do banco de verdade: `payment_value` e `change_value`,
 * não `amount`. Ler o campo errado não quebra a tela — mostra R$ 0,00 em toda
 * linha, que é pior: parece dado, e não é.
 */
export function toPayment(row: Row): NfcePayment {
  const method = asText(row.payment_method) ?? "";
  return {
    sequence: asNumber(row.payment_number),
    method,
    methodDescription: paymentMethodName(method),
    amount: asNumber(row.payment_value),
    change: asNumber(row.change_value),
    cardBrand: cardBrandName(asText(row.card_brand)),
    authorizationNsu: asText(row.authorization_number),
  };
}

export function toLogEntry(row: Row): NfceHistoryEntry {
  return {
    id: asText(row.id) ?? "",
    at: asIsoDate(row.created_at),
    kind: "log",
    level: asText(row.level) ?? "info",
    message: asText(row.message) ?? "",
    returnCode: asText(row.return_code),
    protocol: asText(row.protocol),
  };
}

export function toEventEntry(row: Row): NfceHistoryEntry {
  const type = asText(row.event_type) ?? "evento";
  const description = asText(row.event_description);
  const justification = asText(row.justification);
  return {
    id: asText(row.id) ?? "",
    at: asIsoDate(row.event_at),
    kind: "event",
    level: "event",
    message: [description ?? type, justification].filter(Boolean).join(" — "),
    returnCode: asText(row.return_code) ?? asText(row.status_code),
    protocol: asText(row.protocol),
  };
}

/** Histórico em ordem cronológica decrescente: o que aconteceu por último vem primeiro. */
export function sortHistory(entries: NfceHistoryEntry[]): NfceHistoryEntry[] {
  return [...entries].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/** Um número que pode não existir — diferente de zero, que é uma resposta. */
function numeroOuNulo(value: unknown): number | null {
  return value == null ? null : asNumber(value);
}

export function toIdentification(row: Row | null | undefined): NfceIdentification | null {
  if (!row) return null;
  return {
    model: asText(row.document_model),
    operationNature: asText(row.operation_nature),
    environment: numeroOuNulo(row.environment_type),
    emissionType: numeroOuNulo(row.emission_type),
    emissionPurpose: numeroOuNulo(row.emission_purpose),
    finalConsumer: numeroOuNulo(row.final_consumer_indicator),
    presence: numeroOuNulo(row.presence_indicator),
    intermediary: numeroOuNulo(row.intermediary_indicator),
    danfePrintType: numeroOuNulo(row.danfe_print_type),
    emissionProcess: numeroOuNulo(row.emission_process),
    processVersion: asText(row.process_version),
  };
}

export function toTaxReform(row: Row): TaxReformTotals {
  return {
    base: asNumber(row.ibscbs_tot_v_bc),
    ibs: asNumber(row.ibscbs_tot_v_ibs),
    ibsState: asNumber(row.ibscbs_tot_v_ibs_uf),
    ibsCity: asNumber(row.ibscbs_tot_v_ibs_mun),
    cbs: asNumber(row.ibscbs_tot_v_cbs),
    noteTotal: asNumber(row.tot_v_nf_tot),
  };
}

export function toRecovery(row: Row): NfceRecovery {
  return {
    reconcileStatus: asText(row.reconcile_status),
    retryCount: asNumber(row.retry_count),
    lastRetryAt: row.last_retry_at == null ? null : asIsoDate(row.last_retry_at),
    nextRetryAt: row.next_retry_at == null ? null : asIsoDate(row.next_retry_at),
    lastErrorCode: asText(row.last_error_code),
    lastErrorMessage: asText(row.last_error_message),
    manualFixRequiredAt:
      row.manual_fix_required_at == null ? null : asIsoDate(row.manual_fix_required_at),
    manualFixNote: asText(row.manual_fix_note),
    cancellationProtocol: asText(row.cancellation_protocol),
    cancelledAt: row.cancelled_at == null ? null : asIsoDate(row.cancelled_at),
    originNoteId: asText(row.origin_note_id),
    replacementNoteId: asText(row.replacement_note_id),
  };
}

export function toDocuments(row: Row): NfceDocuments {
  return {
    authorized: asText(row.authorized_xml),
    cancellation: asText(row.cancellation_xml),
    signed: asText(row.signed_xml),
    generated: asText(row.generated_xml),
    qrcode: asText(row.qrcode),
    queryUrl: asText(row.query_url),
  };
}
