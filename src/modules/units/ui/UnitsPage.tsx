import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { DEFAULT_UNIT_QUERY, type Unit, type UnitQuery } from "../domain/unit";
import { useContainer } from "@/shared/container/container-context";
import {
  Badge,
  Empty,
  ErrorNotice,
  FIELD,
  Loading,
  PageHeader,
  Panel,
} from "@/shared/ui/primitives";

export function UnitsPage() {
  const { units } = useContainer();
  const [query, setQuery] = useState<UnitQuery>(DEFAULT_UNIT_QUERY);

  const { data, isPending, error } = useQuery<Unit[]>({
    queryKey: ["units", query],
    queryFn: () => units.list(query),
    placeholderData: (previous) => previous,
  });

  const total = data?.length ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader title="Unidades" count={total} unit={["unidade", "unidades"]} />

      <div className="relative max-w-md">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={query.search}
          onChange={(e) => setQuery({ search: e.target.value })}
          placeholder="Buscar por sigla ou descrição..."
          className={`${FIELD} w-full pl-9`}
        />
      </div>

      {error && <ErrorNotice error={error} fallback="Não foi possível carregar as unidades." />}

      {isPending ? (
        <Loading label="Carregando unidades..." />
      ) : total === 0 ? (
        <Empty label="Nenhuma unidade encontrada." />
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-right font-medium">Código</th>
                <th className="px-4 py-3 text-left font-medium">Sigla</th>
                <th className="px-4 py-3 text-left font-medium">Descrição</th>
                <th className="px-4 py-3 text-left font-medium">Fracionada</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((unit) => (
                <tr
                  key={unit.id}
                  className="border-t border-border/40 transition-colors hover:bg-secondary/40"
                >
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {unit.legacyCode}
                  </td>
                  <td className="px-4 py-3 font-medium">{unit.shortDescription || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{unit.description || "—"}</td>
                  <td className="px-4 py-3">
                    {unit.isFractional ? (
                      <Badge tone="info">Aceita decimais</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={unit.isActive ? "success" : "destructive"}>
                      {unit.isActive ? "Ativa" : "Inativa"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
