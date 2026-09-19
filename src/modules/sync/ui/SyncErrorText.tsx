import { parseSyncError, SYNC_ERROR_HINT, SYNC_ERROR_LABEL } from "../domain/sync-error";

/**
 * O erro, traduzido — com o texto original a um clique.
 *
 * A causa em português resolve a maioria dos casos; a mensagem crua continua
 * disponível porque é dela que o desenvolvedor precisa quando a categoria não
 * basta.
 */
export function SyncErrorText({ erro, comDica = false }: { erro: string | null; comDica?: boolean }) {
  const analisado = parseSyncError(erro);
  if (!analisado) return <>—</>;

  const detalhes = [analisado.table, analisado.column, analisado.constraint].filter(Boolean);

  return (
    <details>
      <summary className="cursor-pointer text-destructive">
        {SYNC_ERROR_LABEL[analisado.category]}
        {detalhes.length > 0 && (
          <span className="ml-1 font-mono text-muted-foreground">({detalhes.join(" · ")})</span>
        )}
      </summary>
      {comDica && (
        <p className="mt-1 text-muted-foreground">{SYNC_ERROR_HINT[analisado.category]}</p>
      )}
      <p className="mt-1 max-w-xl whitespace-pre-wrap break-words font-mono text-[11px] text-muted-foreground">
        {analisado.raw}
      </p>
    </details>
  );
}
