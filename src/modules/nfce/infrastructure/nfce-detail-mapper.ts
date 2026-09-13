import { asIsoDate, asNumber, asText } from "@/shared/infrastructure/convert";
import type {
  NfceFiscalTotals,
  NfceHistoryEntry,
  NfceIssuer,
  NfceItem,
  NfcePayment,
  NfceRecipient,
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
    sequence: asNumber(row.item_number ?? row.item ?? row.sequence),
    productCode: asText(row.product_code) ?? "",
    description: asText(row.description) ?? "",
    ncm: asText(row.ncm) ?? "",
    cfop: asText(row.cfop) ?? "",
    unit: asText(row.unit) ?? "",
    quantity: asNumber(row.quantity),
    unitPrice: asNumber(row.unit_price),
    grossValue: asNumber(row.gross_value ?? row.total_value),
    discount: asNumber(row.discount_value),
    icmsValue: asNumber(row.icms_value),
  };
}

export function toPayment(row: Row): NfcePayment {
  return {
    sequence: asNumber(row.sequence ?? row.seq),
    method: asText(row.payment_method) ?? "",
    methodDescription: asText(row.payment_method_description),
    amount: asNumber(row.amount ?? row.value),
    change: asNumber(row.change_value),
    cardBrand: asText(row.card_brand_description) ?? asText(row.card_brand),
    authorizationNsu: asText(row.authorization_nsu) ?? asText(row.nsu),
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
