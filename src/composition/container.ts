import { supabase } from "@/shared/supabase/client";
import { detectDataSource } from "@/shared/runtime/environment";
import { getElectronApi } from "@/shared/runtime/electron-api";
import type { Tenant } from "@/shared/tenant/tenant";
import type { ProductRepository } from "@/modules/products/application/product-repository";
import { SupabaseProductRepository } from "@/modules/products/infrastructure/supabase-product-repository";
import { PostgresProductRepository } from "@/modules/products/infrastructure/postgres-product-repository";

export interface Container {
  products: ProductRepository;
}

/**
 * Único ponto do sistema que sabe quais implementações existem.
 *
 * `tenant` é obrigatório no modo Supabase e ignorado no modo PostgreSQL, onde
 * o banco local já pertence a uma única loja.
 */
export function createContainer(tenant: Tenant | null): Container {
  if (detectDataSource() === "postgres") {
    const api = getElectronApi();
    if (!api) throw new Error("Ponte do Electron indisponível no modo local.");
    return { products: new PostgresProductRepository(api) };
  }

  if (!tenant) {
    throw new Error("Selecione uma empresa e uma loja para carregar os dados.");
  }
  return { products: new SupabaseProductRepository(supabase, tenant) };
}
