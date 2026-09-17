import { Lock } from "lucide-react";
import { clampToWindow, earliestAllowedDate, isOutsideWindow } from "./plan-window";
import { usePlanWindow } from "./plan-context";
import type { DateRange } from "@/shared/domain/paging";
import { formatDate } from "@/shared/ui/format";
import { Panel } from "@/shared/ui/primitives";

/**
 * Aviso de período além do que o plano permite.
 *
 * Aparece no lugar do resultado, e não junto dele: a consulta é bloqueada, e
 * mostrar uma lista vazia ao lado do aviso faria parecer que não há dados no
 * período — quando o que houve foi uma recusa.
 *
 * Traz o botão que ajusta o período para o limite, porque a alternativa é a
 * pessoa adivinhar a data digitando.
 */
export function PlanWindowNotice({
  range,
  onAdjust,
  subject,
}: {
  range: DateRange;
  onAdjust: (range: DateRange) => void;
  /** O que foi bloqueado, para a frase dizer: "a consulta de <isto>". */
  subject: string;
}) {
  const plano = usePlanWindow();
  const minimo = earliestAllowedDate(plano);

  if (!minimo || !isOutsideWindow(range, plano)) return null;

  return (
    <Panel className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <Lock size={28} className="text-warning" />
      <p className="font-medium">Período fora do seu plano</p>
      <p className="max-w-lg text-sm text-muted-foreground">
        O plano{" "}
        <span className="text-foreground">{plano.planName ?? plano.planSlug ?? "atual"}</span>{" "}
        permite consultar <span className="text-foreground">{plano.historyWindowDays}</span> dias de
        histórico, a partir de <span className="text-foreground">{formatDate(minimo)}</span>. A
        consulta de {subject} foi bloqueada para este intervalo.
      </p>
      <button
        onClick={() => onAdjust(clampToWindow(range, plano))}
        className="rounded-lg bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Ajustar para {formatDate(minimo)}
      </button>
    </Panel>
  );
}

/** `true` quando o período pedido está além do plano — para travar a consulta. */
export function useOutsidePlanWindow(range: DateRange): boolean {
  return isOutsideWindow(range, usePlanWindow());
}
