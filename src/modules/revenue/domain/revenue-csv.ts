import { METHOD_LABEL, type RevenueTransaction } from "./revenue";

/**
 * As transações do período em CSV, no formato que o projeto anterior exporta.
 *
 * Ponto e vírgula como separador e vírgula decimal: é o que o Excel em
 * português abre sem pedir nada. O BOM no início existe pelo mesmo motivo —
 * sem ele, acentos viram símbolos na planilha.
 */
const HEADER = "data_hora;forma_pagamento;valor;id";
const BOM = "﻿";

export function toCsv(transactions: RevenueTransaction[]): string {
  const linhas = transactions.map((tx) => {
    const quando = new Date(tx.createdAt).toLocaleString("pt-BR");
    const valor = tx.amount.toFixed(2).replace(".", ",");
    return `${quando};${METHOD_LABEL[tx.method]};${valor};${tx.id}`;
  });

  return `${BOM}${HEADER}\n${linhas.join("\n")}`;
}

export function csvFileName(from: string | null, to: string | null): string {
  return `receitas-aprovadas-${from ?? "inicio"}-${to ?? "hoje"}.csv`;
}
