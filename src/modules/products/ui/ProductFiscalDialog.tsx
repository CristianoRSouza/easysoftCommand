import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { TriangleAlert, X } from "lucide-react";
import type { Product } from "../domain/product";
import {
  hasTaxReformClass,
  ICMS_REGIME_LABEL,
  icmsRegime,
  originLabel,
  type FiscalContribution,
  type ProductFiscal,
} from "../domain/product-fiscal";
import { useContainer } from "@/shared/container/container-context";
import { ErrorNotice, Loading } from "@/shared/ui/primitives";

function Campo({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words text-sm">
        {value === null || value === "" ? "—" : String(value)}
      </p>
    </div>
  );
}

function Bloco({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border/60 pt-4">
      <h3 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

/** PIS e COFINS têm os mesmos campos; o bloco é um só, usado duas vezes. */
function Contribuicao({ title, dados }: { title: string; dados: FiscalContribution }) {
  return (
    <Bloco title={title}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo label="CST" value={dados.cst} />
        <Campo label="Alíquota" value={dados.rate} />
        <Campo label="Valor por unidade" value={dados.rateValue} />
        <Campo label="Tipo de cálculo" value={dados.calculationType} />
        <div className="sm:col-span-2">
          <Campo label="Descrição" value={dados.description} />
        </div>
      </div>
    </Bloco>
  );
}

export function ProductFiscalDialog({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const { products } = useContainer();

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onClose]);

  const { data, isPending, error } = useQuery<ProductFiscal | null>({
    queryKey: ["products", "fiscal", product.id],
    queryFn: () => products.fiscal(product.id),
  });

  const regime = data ? icmsRegime(data.icms) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel my-8 w-full max-w-3xl space-y-4 rounded-lg p-6 shadow-elegant"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-bold">{product.description || "Produto sem descrição"}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Classificação fiscal</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {error && <ErrorNotice error={error} fallback="Não foi possível carregar os dados fiscais." />}

        {isPending ? (
          <Loading label="Carregando os dados fiscais..." />
        ) : !data ? (
          <p className="text-sm text-muted-foreground">
            Este produto não tem cadastro fiscal. Sem NCM e CFOP, a NFC-e que o incluir será
            rejeitada pela SEFAZ.
          </p>
        ) : (
          <>
            {/* CST e CSOSN juntos é cadastro inconsistente, não produto
                especial: um é do Regime Normal e o outro do Simples. */}
            {regime === "conflito" && (
              <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                <span>
                  Este produto tem CST e CSOSN preenchidos ao mesmo tempo. Os dois se excluem — o
                  serviço fiscal vai escolher um deles sem avisar qual.
                </span>
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <Campo label="NCM" value={data.identification.ncm} />
              <Campo label="CFOP" value={data.identification.cfop} />
              <Campo label="CEST" value={data.identification.cest} />
              <div className="sm:col-span-2">
                <Campo label="Descrição do CFOP" value={data.identification.cfopDescription} />
              </div>
              <Campo label="Entrada / saída" value={data.identification.cfopEntryExit} />
              <Campo label="Unidade fiscal" value={data.identification.fiscalUnit} />
              <Campo label="Situação do IPI" value={data.identification.ipiTaxSituation} />
              <Campo label="Código de benefício" value={data.identification.taxBenefitCode} />
              <div className="sm:col-span-3">
                <Campo
                  label="Regra tributária"
                  value={
                    [data.identification.taxRuleCode, data.identification.taxRuleDescription]
                      .filter((parte) => parte !== null && parte !== "")
                      .join(" · ") || null
                  }
                />
              </div>
            </div>

            <Bloco title={`ICMS — ${regime ? ICMS_REGIME_LABEL[regime] : ""}`}>
              <div className="grid gap-4 sm:grid-cols-3">
                <Campo label="CST" value={data.icms.cst} />
                <Campo label="CSOSN" value={data.icms.csosn} />
                <Campo label="Alíquota" value={data.icms.rate} />
                <Campo label="Redução da base" value={data.icms.reductionPercent} />
                <Campo label="Alíquota do fundo de pobreza" value={data.icms.rateFundoPobreza} />
                <Campo label="Crédito no Simples" value={data.icms.creditRateSimples} />
                <Campo label="Origem" value={originLabel(data.icms.origin)} />
                <Campo label="UF de origem" value={data.icms.originState} />
                <Campo label="Tipo" value={data.icms.type} />
                <div className="sm:col-span-3">
                  <Campo label="Descrição" value={data.icms.description} />
                </div>
              </div>

              <div className="mt-4 grid gap-4 border-t border-border/40 pt-4 sm:grid-cols-3">
                <Campo label="Alíquota do ICMS ST" value={data.icms.substitutionRate} />
                <Campo label="ST — fundo de pobreza" value={data.icms.substitutionRateFundoPobreza} />
                <Campo label="Margem de valor agregado" value={data.icms.substitutionMargin} />
                <Campo label="Revendedor" value={data.icms.resellerFlag} />
              </div>
            </Bloco>

            <Contribuicao title="PIS" dados={data.pis} />
            <Contribuicao title="COFINS" dados={data.cofins} />

            {/* Só aparece quando a reforma já classificou o produto: uma seção
                de traços daria a impressão de dado faltando. */}
            {hasTaxReformClass(data.taxReform) && (
              <Bloco title="Reforma tributária (IBS / CBS)">
                <div className="grid gap-4 sm:grid-cols-4">
                  <Campo label="Classificação" value={data.taxReform.taxClassCode} />
                  <Campo label="Alíquota nacional" value={data.taxReform.nationalRate} />
                  <Campo label="Alíquota estadual" value={data.taxReform.stateRate} />
                  <Campo label="Alíquota de importado" value={data.taxReform.importedRate} />
                </div>
              </Bloco>
            )}
          </>
        )}
      </div>
    </div>
  );
}
