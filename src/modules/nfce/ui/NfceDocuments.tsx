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
}: {
  label: string;
  hint: string;
  conteudo: string | null;
  arquivo: string;
}) {
  // Botão desabilitado e explicado, em vez de escondido: a ausência do XML é
  // informação — quem procura o arquivo precisa saber que ele não existe.
  const disponivel = Boolean(conteudo);
  return (
    <button
      disabled={!disponivel}
      onClick={() => conteudo && baixar(conteudo, arquivo)}
      title={disponivel ? hint : "Este XML não existe para esta nota"}
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
          arquivo={`${base}.xml`}
        />
        <BotaoXml
          label="XML de cancelamento"
          hint="Vale junto com o autorizado"
          conteudo={documents.cancellation}
          arquivo={`${base}-cancelamento.xml`}
        />
        <BotaoXml
          label="XML assinado"
          hint="O que foi enviado à SEFAZ"
          conteudo={documents.signed}
          arquivo={`${base}-assinado.xml`}
        />
        <BotaoXml
          label="XML gerado"
          hint="Antes da assinatura — para investigar recusa"
          conteudo={documents.generated}
          arquivo={`${base}-gerado.xml`}
        />
      </div>

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
