/**
 * A quantidade que o subtotal indica, quando a gravada foi truncada.
 *
 * A nuvem guarda a quantidade dos itens como número inteiro: 0,202 kg de pão
 * de queijo chega como 0, e 7,82 kg de pão francês como 7. O subtotal chega
 * certo. Só se aponta o caso quando a quantidade gravada é exatamente a parte
 * inteira de subtotal ÷ preço — desconto ou acréscimo não produzem esse
 * padrão, e não devem ser confundidos com truncamento.
 */
export function truncatedQuantity(item: {
  quantity: number;
  unitPrice: number;
  subtotal: number;
}): number | null {
  if (item.unitPrice <= 0 || item.subtotal <= 0) return null;
  const indicada = Math.round((item.subtotal / item.unitPrice) * 1000) / 1000;
  if (Number.isInteger(indicada)) return null;
  return Math.trunc(indicada) === item.quantity ? indicada : null;
}
