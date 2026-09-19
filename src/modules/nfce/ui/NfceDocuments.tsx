import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import type { NfceDocuments as Documents } from "../domain/nfce-detail";
import type { NfceNote } from "../domain/nfce-note";

/**
 * Os XMLs da nota, para baixar.
 *
 * O arquivo é gerado aqui mesmo, a partir do texto que já veio do banco —
 * não há segunda ida ao servidor. O nome inclui a chave de acesso porque é
 * assim que a contabilidade procura o arquivo depois.
 */
function baixar(conteudo: string, nome: string) {
  const blob = new Blob([conteudo], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}

function BotaoXml({
  label,
  hint,
  conteudo,
  arquivo,
  guardadoFora = false,
}: {
  label: string;
  hint: string;
  conteudo: string | null;
  arquivo: string;
  guardadoFora?: boolean;
}) {
  // Botão desabilitado e explicado, em vez de escondido: a ausência do XML é
  // informação. E são duas ausências diferentes — o XML que não existe e o
  // que existe num lugar que o painel não pode ler.
  const disponivel = Boolean(conteudo);
  const motivo = guardadoFora
    ? "O XML existe, mas está no armazenamento de arquivos, que não libera leitura para o painel"
    : "Este XML não existe para esta nota";
  return (
    <button
      disabled={!disponivel}
      onClick={() => conteudo && baixar(conteudo, arquivo)}
      title={disponivel ? hint : motivo}
      className="flex items-start gap-2 rounded-lg border border-border px-3 py-2.5 text-left transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
    >
      <Download size={15} className="mt-0.5 shrink-0" />
      <span>
        <span className="block text-sm">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

export function NfceDocumentsSection({
  note,
  documents,
}: {
  note: NfceNote;
  documents: Documents;
}) {
  const [copiado, setCopiado] = useState(false);
  const chave = note.accessKey ?? "";
  const base = chave || `nota-${note.number}`;

  async function copiarChave() {
    await navigator.clipboard.writeText(chave);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="space-y-4">
      {chave && (
        <div className="flex flex-wrap items-center gap-2">
          <code className="flex-1 break-all rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs">
            {chave}
          </code>
          <button
            onClick={() => void copiarChave()}
            title="Copiar a chave de acesso"
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-secondary"
          >
            {copiado ? <Check size={15} className="text-success" /> : <Copy size={15} />}
            {copiado ? "Copiada" : "Copiar"}
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <BotaoXml
          label="XML autorizado"
          hint="O documento que vale legalmente"
          conteudo={documents.authorized}
          guardadoFora={documents.storedElsewhere.authorized}
          arquivo={`${base}.xml`}
        />
        <BotaoXml
          label="XML de cancelamento"
          hint="Vale junto com o autorizado"
          conteudo={documents.cancellation}
          guardadoFora={documents.storedElsewhere.cancellation}
          arquivo={`${base}-cancelamento.xml`}
        />
        <BotaoXml
          label="XML assinado"
          hint="O que foi enviado à SEFAZ"
          conteudo={documents.signed}
          guardadoFora={documents.storedElsewhere.signed}
          arquivo={`${base}-assinado.xml`}
        />
        <BotaoXml
          label="XML gerado"
          hint="Antes da assinatura — para investigar recusa"
          conteudo={documents.generated}
          arquivo={`${base}-gerado.xml`}
        />
      </div>

      {/* O aviso aparece uma vez, e não só na dica de cada botão: é informação
          que muda o que a pessoa vai fazer a seguir — procurar o arquivo em
          outro lugar, em vez de concluir que a nota não tem XML. */}
      {!documents.authorized && documents.storedElsewhere.authorized && (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-warning">
          O XML autorizado desta nota existe e está guardado no armazenamento de arquivos da
          nuvem, que não libera leitura para este painel. Para baixá-lo é preciso liberar esse
          acesso no servidor.
        </p>
      )}

      {documents.queryUrl && (
        <p className="text-xs text-muted-foreground">
          Consulta pública:{" "}
          <a
            href={documents.queryUrl}
            target="_blank"
            rel="noreferrer"
            className="break-all text-primary hover:underline"
          >
            {documents.queryUrl}
          </a>
        </p>
      )}
    </div>
  );
}
