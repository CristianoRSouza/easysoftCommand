import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";

/**
 * Notas cuja reconciliação falhou.
 *
 * O critério é o do contador do projeto anterior: só nota emitida normalmente
 * (`emission_type` 1), sem as canceladas e inutilizadas, que não têm o que
 * reconciliar. O Dashboard conta com esta função e a lista filtra com ela —
 * assim o número clicado é o número de linhas que aparece.
 */
export function onlyReconcileFailed<T extends PostgrestFilterBuilder<any, any, any, any, any>>(
  request: T,
): T {
  return request
    .eq("emission_type", 1)
    .eq("reconcile_status", "failed")
    .not("status", "in", "(cancelled,inutilized)") as T;
}
