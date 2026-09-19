import type { NfceQuery } from "./nfce-note";

/**
 * O pacote de XML das notas de um filtro.
 *
 * A contabilidade pede "os XML do mês". Baixar um por um, de uma lista
 * paginada, é trabalho manual que a tela pode eliminar — e que, feito à mão,
 * costuma vir incompleto sem ninguém perceber.
 */
export interface ArchivedNote {
  id: string;
  number: number;
  serie: number;
  accessKey: string | null;
  status: string;
  authorizedXml: string | null;
  cancellationXml: string | null;
  /** O XML existe, mas no armazenamento de arquivos, que o painel não lê. */
  storedElsewhere: boolean;
}

export interface ArchiveStats {
  notes: number;
  files: number;
  cancelled: number;
  /** Notas que entraram no filtro mas não têm XML — ficam listadas no resumo. */
  withoutXml: string[];
  /**
   * Notas cujo XML existe, mas no armazenamento de arquivos. Contadas à parte:
   * misturá-las às sem XML faria o resumo dizer que o documento não existe.
   */
  inStorage: string[];
}

export function emptyStats(): ArchiveStats {
  return { notes: 0, files: 0, cancelled: 0, withoutXml: [], inStorage: [] };
}

/**
 * O nome do arquivo dentro do pacote.
 *
 * A chave de acesso é o nome que a contabilidade procura. Sem ela — nota que
 * nem chegou a ser assinada —, o número e a série identificam.
 */
export function fileNameFor(note: ArchivedNote, suffix = ""): string {
  const base = note.accessKey ?? `nota-${note.serie}-${note.number}`;
  return `${base}${suffix}.xml`;
}

/** Evita dois arquivos com o mesmo nome no pacote. */
export function uniqueName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  let n = 2;
  const ponto = name.lastIndexOf(".");
  const corpo = ponto === -1 ? name : name.slice(0, ponto);
  const extensao = ponto === -1 ? "" : name.slice(ponto);
  let candidato = `${corpo}-${n}${extensao}`;
  while (used.has(candidato)) {
    n += 1;
    candidato = `${corpo}-${n}${extensao}`;
  }
  used.add(candidato);
  return candidato;
}

function periodo(query: NfceQuery): string {
  if (query.range.from && query.range.to) return `${query.range.from}_a_${query.range.to}`;
  if (query.range.from) return `desde_${query.range.from}`;
  if (query.range.to) return `ate_${query.range.to}`;
  return "todo-o-periodo";
}

export function archiveFileName(query: NfceQuery): string {
  const status = query.status === "all" ? "" : `-${query.status}`;
  return `nfce-xml-${periodo(query)}${status}.zip`;
}

/**
 * O resumo que vai dentro do pacote.
 *
 * Existe para responder, meses depois, o que aquele arquivo continha: quais
 * filtros o geraram e quais notas ficaram de fora por não ter XML. Sem isso, um
 * pacote incompleto é indistinguível de um período sem vendas.
 */
export function summaryText(query: NfceQuery, stats: ArchiveStats, now: Date): string {
  const linhas = [
    "Pacote de XML de NFC-e",
    `Gerado em: ${now.toLocaleString("pt-BR")}`,
    "",
    "Filtros usados",
    `  Período: ${query.range.from ?? "início"} até ${query.range.to ?? "hoje"}`,
    `  Status: ${query.status === "all" ? "todos" : query.status}`,
    `  Busca: ${query.search.trim() || "(nenhuma)"}`,
    "",
    "Conteúdo",
    `  Notas no filtro: ${stats.notes}`,
    `  Arquivos XML: ${stats.files}`,
    `  XML de cancelamento: ${stats.cancelled}`,
    `  Notas sem XML: ${stats.withoutXml.length}`,
    `  Notas com XML no armazenamento (fora deste pacote): ${stats.inStorage.length}`,
  ];

  if (stats.inStorage.length > 0) {
    linhas.push(
      "",
      "Notas com XML no armazenamento de arquivos da nuvem",
      "  O XML destas notas existe, mas está num armazenamento que o painel não",
      "  tem permissão de ler. Não é falta de documento.",
    );
    for (const nota of stats.inStorage) linhas.push(`  ${nota}`);
  }

  if (stats.withoutXml.length > 0) {
    linhas.push("", "Notas sem XML (não entraram no pacote)");
    for (const nota of stats.withoutXml) linhas.push(`  ${nota}`);
  }

  return linhas.join("\n");
}
