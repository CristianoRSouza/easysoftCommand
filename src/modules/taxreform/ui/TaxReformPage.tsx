import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import {
  columnsOf,
  REFERENCE_TABLES,
  tableById,
  type ReferenceColumn,
  type ReferenceTableId,
} from "../domain/reference-table";
import {
  DEFAULT_REFERENCE_QUERY,
  type ReferenceQuery,
  type ReferenceRow,
} from "../application/tax-reform-repository";
import { useContainer } from "@/shared/container/container-context";
import { lastPageOf, type Page } from "@/shared/domain/paging";
import { formatDate } from "@/shared/ui/format";
import {
  Empty,
  ErrorNotice,
  FIELD,
  Loading,
  PageHeader,
  Pagination,
  Panel,
} from "@/shared/ui/primitives";

/**
 * Formata a célula conforme o tipo declarado na tabela.
 *
 * Alíquota é mostrada **como está**, sem multiplicar por cem: a base já guarda
 * percentual. As alíquotas de teste da reforma em 2026 são 0,9% da CBS e 0,1%
 * do IBS — uma regra de "se for menor que 1, multiplique" leria 0,9 como 90%,
 * cem vezes o valor real. O projeto anterior também só acrescenta o sinal.
 */
function celula(valor: unknown, coluna: ReferenceColumn): string {
  if (valor == null || valor === "") return "—";

  if (coluna.format === "boolean") return valor === true ? "Sim" : "Não";

  if (coluna.format === "date") {
    const texto = String(valor);
    return texto.length >= 10 ? formatDate(texto.slice(0, 10)) : texto;
  }

  if (coluna.format === "rate") {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return String(valor);
    return `${numero.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`;
  }

  return String(valor);
}

export function TaxReformPage() {
  const { taxReform } = useContainer();
  const [tabelaId, setTabelaId] = useState<ReferenceTableId>("cst");
  const [query, setQuery] = useState<ReferenceQuery>(DEFAULT_REFERENCE_QUERY);

  const tabela = tableById(tabelaId);

  const { data, isPending, error } = useQuery<Page<ReferenceRow>>({
    queryKey: ["tax-reform", tabela.view, query],
    queryFn: () => taxReform.list(tabela, query),
    placeholderData: (previous) => previous,
  });

  function trocarTabela(id: ReferenceTableId) {
    setTabelaId(id);
    setQuery(DEFAULT_REFERENCE_QUERY);
  }

  const total = data?.total ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader title="Reforma tributária" count={total} unit={["registro", "registros"]} />

      <p className="text-sm text-muted-foreground">
        As listas oficiais de IBS, CBS e Imposto Seletivo. Servem para conferir o que o cadastro do
        produto diz — ninguém as edita aqui: elas chegam prontas.
      </p>

      <div className="flex flex-wrap gap-2">
        {REFERENCE_TABLES.map((item) => (
          <button
            key={item.id}
            onClick={() => trocarTabela(item.id)}
            title={item.purpose}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              item.id === tabelaId
                ? "bg-gradient-primary font-medium text-primary-foreground"
                : "border border-border hover:bg-secondary"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 text-sm text-muted-foreground">{tabela.purpose}</p>
        {tabela.searchable.length > 0 && (
          <div className="relative min-w-64">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={query.search}
              onChange={(e) => setQuery((q) => ({ ...q, search: e.target.value, page: 1 }))}
              placeholder="Buscar nesta tabela..."
              className={`${FIELD} w-full pl-9`}
            />
          </div>
        )}
      </div>

      {error && <ErrorNotice error={error} fallback="Não foi possível carregar a tabela." />}

      {isPending ? (
        <Loading label="Carregando a tabela..." />
      ) : (data?.items.length ?? 0) === 0 ? (
        <Empty label="Nenhum registro com os filtros atuais." />
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 text-muted-foreground">
              <tr>
                {tabela.columns.map((coluna) => (
                  <th
                    key={coluna.key}
                    className={`px-4 py-3 font-medium ${
                      coluna.align === "right" ? "text-right" : "text-left"
                    }`}
                  >
                    {coluna.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.items.map((linha, indice) => (
                <tr
                  key={String(linha.id ?? indice)}
                  className="border-t border-border/40 transition-colors hover:bg-secondary/40"
                >
                  {tabela.columns.map((coluna) => (
                    <td
                      key={coluna.key}
                      className={`px-4 py-3 ${
                        coluna.align === "right" ? "text-right tabular-nums" : ""
                      }`}
                    >
                      {celula(linha[coluna.key], coluna)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <Pagination
        page={query.page}
        lastPage={lastPageOf(total, query.pageSize)}
        onChange={(page) => setQuery((q) => ({ ...q, page }))}
      />

      <p className="text-xs text-muted-foreground">
        Só versões em vigor aparecem: as anteriores continuam na base marcadas como inativas, e
        mostrá-las levaria alguém a usar um código que saiu de vigência. Colunas lidas:{" "}
        <span className="font-mono">{columnsOf(tabela)}</span>.
      </p>
    </div>
  );
}
