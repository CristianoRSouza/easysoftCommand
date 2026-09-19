import { AsyncZipDeflate, Zip } from "fflate";
import {
  archiveFileName,
  emptyStats,
  fileNameFor,
  summaryText,
  uniqueName,
  type ArchiveStats,
} from "../domain/nfce-archive";
import type { NfceQuery } from "../domain/nfce-note";
import type { NfceRepository } from "./nfce-repository";

/** Quantas notas por consulta. XML é texto longo; lotes grandes estouram a memória. */
const LOTE = 200;

export interface ArchiveResult {
  blob: Blob;
  fileName: string;
  stats: ArchiveStats;
}

/**
 * Monta o pacote de XML das notas que casam com o filtro.
 *
 * O pacote é montado enquanto os lotes chegam, e não depois de carregar tudo:
 * um mês de uma loja movimentada não cabe confortavelmente na memória do
 * navegador se for acumulado inteiro antes de compactar.
 *
 * O filtro vai ao banco. Exportar as linhas já carregadas na tela entregaria
 * ao contador um pedaço do mês com cara de mês inteiro.
 */
export function exportNfceXml(repository: NfceRepository) {
  return async (query: NfceQuery, onProgress?: (notas: number) => void): Promise<ArchiveResult> => {
    const stats = emptyStats();
    const usados = new Set<string>();
    const pedacos: Uint8Array[] = [];
    let erro: Error | null = null;

    const zip = new Zip((err, chunk) => {
      if (err) {
        erro = err;
        return;
      }
      // Cópia: o fflate reaproveita o buffer que entrega no retorno.
      if (chunk && chunk.length > 0) pedacos.push(chunk.slice());
    });

    const texto = new TextEncoder();

    function adicionar(nome: string, conteudo: string) {
      const arquivo = new AsyncZipDeflate(nome, { level: 6 });
      zip.add(arquivo);
      arquivo.push(texto.encode(conteudo), true);
    }

    let afterId: string | null = null;
    for (;;) {
      const lote = await repository.xmlBatch(query, afterId, LOTE);
      if (lote.length === 0) break;

      for (const nota of lote) {
        stats.notes += 1;

        if (nota.authorizedXml) {
          adicionar(uniqueName(fileNameFor(nota), usados), nota.authorizedXml);
          stats.files += 1;
        }
        if (nota.cancellationXml) {
          adicionar(uniqueName(fileNameFor(nota, "-cancelamento"), usados), nota.cancellationXml);
          stats.files += 1;
          stats.cancelled += 1;
        }
        if (!nota.authorizedXml && !nota.cancellationXml) {
          const rotulo = `${nota.accessKey ?? `nº ${nota.number}/${nota.serie}`} (${nota.status})`;
          if (nota.storedElsewhere) stats.inStorage.push(rotulo);
          else stats.withoutXml.push(rotulo);
        }
      }

      onProgress?.(stats.notes);

      if (lote.length < LOTE) break;
      afterId = lote[lote.length - 1]?.id ?? null;
      if (!afterId) break;
    }

    // O resumo entra por último, quando os números já são finais.
    adicionar("_RESUMO.txt", summaryText(query, stats, new Date()));
    zip.end();

    if (erro) throw erro;

    return {
      blob: new Blob(pedacos as BlobPart[], { type: "application/zip" }),
      fileName: archiveFileName(query),
      stats,
    };
  };
}
