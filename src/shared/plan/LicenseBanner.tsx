import { useState } from "react";
import { CreditCard, LoaderCircle, TriangleAlert } from "lucide-react";
import { openExternal } from "@/shared/external/external-access";
import { useLicense } from "./plan-context";

function data(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR");
}

/**
 * Faixa no topo quando a licença venceu ou vence em até sete dias.
 *
 * Fica em todas as telas, e não só no painel inicial: quem descobre que o
 * plano venceu quando o totem para de vender descobriu tarde demais.
 */
export function LicenseBanner() {
  const licenca = useLicense();
  const [abrindo, setAbrindo] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);

  if (licenca.state !== "expired" && licenca.state !== "expiring_soon") return null;

  const vencida = licenca.state === "expired";
  const quando = data(licenca.expiresAt);
  const plano = licenca.planName ? `do plano ${licenca.planName} ` : "";

  const texto = vencida
    ? `A licença ${plano}venceu${quando ? ` em ${quando}` : ""}. Revise o pagamento para restaurar todos os recursos.`
    : `A licença ${plano}vence em ${licenca.daysUntilExpiry} dia(s)${quando ? ` (${quando})` : ""}. Revise o pagamento para evitar interrupções.`;

  async function revisar() {
    setAbrindo(true);
    setFalha(null);
    try {
      await openExternal("billing");
    } catch (erro) {
      setFalha(erro instanceof Error ? erro.message : "Não foi possível abrir o EasyBilling.");
    } finally {
      setAbrindo(false);
    }
  }

  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center gap-2 border-b px-5 py-2 text-xs ${
        vencida
          ? "border-destructive/50 bg-destructive/15 text-destructive"
          : "border-warning/50 bg-warning/15 text-warning"
      }`}
    >
      <TriangleAlert size={15} className="shrink-0" />
      <p className="min-w-0 flex-1">
        <strong className="mr-1">
          {vencida ? "Seu plano venceu e não foi renovado." : "Renovação do plano pendente."}
        </strong>
        {texto}
        {falha && <span className="ml-2 font-medium">{falha}</span>}
      </p>
      <button
        onClick={() => void revisar()}
        disabled={abrindo}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-current px-2.5 py-1 font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
      >
        {abrindo ? <LoaderCircle size={13} className="animate-spin" /> : <CreditCard size={13} />}
        Revisar pagamento
      </button>
    </div>
  );
}
