import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useTenant } from "./tenant-context";
import { FIELD } from "@/shared/ui/primitives";

/** A partir de quantas empresas a lista vira busca em vez de lista corrida. */
const LIMIAR_BUSCA = 12;
/** Quantas empresas aparecem de cada vez na busca. */
const MAXIMO_VISIVEL = 40;

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Escolha de empresa e loja.
 *
 * Um administrador do sistema enxerga centenas de empresas; uma lista suspensa
 * com trezentas e sessenta linhas não é escolha, é rolagem. Acima de poucas
 * empresas a escolha vira busca — por nome ou CNPJ, sem acento.
 */
export function StorePicker({ compact = false }: { compact?: boolean }) {
  const { companies, stores, selectedCompanyId, tenant, selectCompany, selectStore } =
    useTenant();
  const [busca, setBusca] = useState("");

  const comBusca = companies.length > LIMIAR_BUSCA;

  const filtradas = useMemo(() => {
    const termo = normalizar(busca.trim());
    const digitos = busca.replace(/\D/g, "");
    const todas = termo
      ? companies.filter(
          (c) =>
            normalizar(c.name).includes(termo) ||
            (digitos.length >= 3 && (c.cnpj ?? "").replace(/\D/g, "").includes(digitos)),
        )
      : companies;
    return todas.slice(0, MAXIMO_VISIVEL);
  }, [busca, companies]);

  const empresaAtual = companies.find((c) => c.id === selectedCompanyId) ?? null;

  return (
    <div className={compact ? "flex flex-wrap items-center gap-2" : "space-y-4"}>
      {comBusca ? (
        <div className={compact ? "relative w-64" : "space-y-2"}>
          {!compact && <p className="text-sm text-muted-foreground">Empresa</p>}
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={empresaAtual ? empresaAtual.name : "Buscar empresa por nome ou CNPJ..."}
              className={`${FIELD} w-full pl-9`}
            />
          </div>
          {busca.trim() !== "" && (
            <ul
              className={`max-h-72 overflow-y-auto rounded-lg border border-border bg-popover ${
                compact ? "absolute left-0 right-0 top-full z-40 mt-1 shadow-elegant" : ""
              }`}
            >
              {filtradas.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">Nenhuma empresa encontrada.</li>
              ) : (
                filtradas.map((empresa) => (
                  <li key={empresa.id}>
                    <button
                      type="button"
                      onClick={() => {
                        selectCompany(empresa.id);
                        setBusca("");
                      }}
                      className="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-secondary"
                    >
                      {empresa.name}
                      {empresa.cnpj && (
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          {empresa.cnpj}
                        </span>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      ) : (
        companies.length > 1 && (
          <label className={compact ? "" : "block space-y-2"}>
            {!compact && <span className="text-sm text-muted-foreground">Empresa</span>}
            <select
              value={selectedCompanyId ?? ""}
              onChange={(e) => selectCompany(e.target.value)}
              className={`${FIELD} ${compact ? "max-w-56" : "w-full"}`}
            >
              {!selectedCompanyId && <option value="">Escolha a empresa</option>}
              {companies.map((empresa) => (
                <option key={empresa.id} value={empresa.id}>
                  {empresa.name}
                </option>
              ))}
            </select>
          </label>
        )
      )}

      {selectedCompanyId && (
        <label className={compact ? "" : "block space-y-2"}>
          {!compact && <span className="text-sm text-muted-foreground">Loja</span>}
          {stores.length === 0 ? (
            <p className="text-sm text-warning">Você não tem acesso a nenhuma loja desta empresa.</p>
          ) : (
            <select
              value={tenant?.storeId ?? ""}
              onChange={(e) => selectStore(e.target.value)}
              className={`${FIELD} ${compact ? "max-w-56" : "w-full"}`}
            >
              {!tenant && <option value="">Escolha a loja</option>}
              {stores.map((loja) => (
                <option key={loja.id} value={loja.id}>
                  {loja.name}
                  {loja.code ? ` (${loja.code})` : ""}
                </option>
              ))}
            </select>
          )}
        </label>
      )}
    </div>
  );
}
