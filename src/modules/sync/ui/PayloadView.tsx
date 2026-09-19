/**
 * O conteúdo do evento como chave e valor, em vez de JSON cru.
 *
 * Quem investiga um evento procura um campo — o id da comanda, o valor, a
 * data. Um bloco de JSON de trinta linhas obriga a ler tudo para achar um.
 */
const DATA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function valorSimples(valor: unknown): string {
  if (valor === null || valor === undefined) return "—";
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (typeof valor === "string" && DATA_ISO.test(valor)) {
    const data = new Date(valor);
    return Number.isNaN(data.getTime()) ? valor : data.toLocaleString("pt-BR");
  }
  return String(valor);
}

function composto(valor: unknown): valor is object {
  return valor !== null && typeof valor === "object";
}

export function PayloadView({ data }: { data: unknown }) {
  if (!composto(data)) {
    return <p className="font-mono text-xs">{valorSimples(data)}</p>;
  }

  const entradas = Array.isArray(data)
    ? data.map((item, indice) => [`#${indice + 1}`, item] as const)
    : Object.entries(data);

  if (entradas.length === 0) return <p className="text-xs italic text-muted-foreground">Vazio</p>;

  return (
    <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
      {entradas.map(([chave, valor]) =>
        composto(valor) ? (
          <div key={chave} className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {chave}
            </dt>
            <dd className="mt-1 border-l-2 border-primary/30 pl-3">
              <PayloadView data={valor} />
            </dd>
          </div>
        ) : (
          <div key={chave} className="flex items-baseline gap-2 border-b border-border/30 py-1">
            <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {chave}
            </dt>
            <dd className="break-all font-mono text-xs">{valorSimples(valor)}</dd>
          </div>
        ),
      )}
    </dl>
  );
}
