import { supabase } from "@/shared/supabase/client";
import { detectDataSource } from "@/shared/runtime/environment";
import { getElectronApi } from "@/shared/runtime/electron-api";
import type { Tenant } from "@/shared/tenant/tenant";

import type { ProductRepository } from "@/modules/products/application/product-repository";
import { SupabaseProductRepository } from "@/modules/products/infrastructure/supabase-product-repository";
import { PostgresProductRepository } from "@/modules/products/infrastructure/postgres-product-repository";

import type { DashboardRepository } from "@/modules/dashboard/application/dashboard-repository";
import { SupabaseDashboardRepository } from "@/modules/dashboard/infrastructure/supabase-dashboard-repository";
import { PostgresDashboardRepository } from "@/modules/dashboard/infrastructure/postgres-dashboard-repository";

import type { OrderRepository } from "@/modules/orders/application/order-repository";
import { SupabaseOrderRepository } from "@/modules/orders/infrastructure/supabase-order-repository";
import { PostgresOrderRepository } from "@/modules/orders/infrastructure/postgres-order-repository";

import type { TransactionRepository } from "@/modules/transactions/application/transaction-repository";
import { SupabaseTransactionRepository } from "@/modules/transactions/infrastructure/supabase-transaction-repository";
import { PostgresTransactionRepository } from "@/modules/transactions/infrastructure/postgres-transaction-repository";

import type { UnitRepository } from "@/modules/units/application/unit-repository";
import { SupabaseUnitRepository } from "@/modules/units/infrastructure/supabase-unit-repository";
import { PostgresUnitRepository } from "@/modules/units/infrastructure/postgres-unit-repository";

export interface Container {
  products: ProductRepository;
  dashboard: DashboardRepository;
  orders: OrderRepository;
  transactions: TransactionRepository;
  units: UnitRepository;
}

/**
 * Único ponto do sistema que sabe quais implementações existem.
 *
 * Este arquivo é o motivo de nenhuma regra de negócio precisar perguntar onde
 * está rodando. Ele cresce uma linha por módulo novo; o resto do código, zero.
 *
 * `tenant` é obrigatório no modo Supabase e ignorado no modo PostgreSQL, onde
 * o banco local já pertence a uma única loja.
 */
export function createContainer(tenant: Tenant | null): Container {
  if (detectDataSource() === "postgres") {
    const api = getElectronApi();
    if (!api) throw new Error("Ponte do Electron indisponível no modo local.");
    return {
      products: new PostgresProductRepository(api),
      dashboard: new PostgresDashboardRepository(api),
      orders: new PostgresOrderRepository(api),
      transactions: new PostgresTransactionRepository(api),
      units: new PostgresUnitRepository(api),
    };
  }

  if (!tenant) {
    throw new Error("Nenhuma loja associada a este usuário. Verifique o cadastro de acesso.");
  }
  return {
    products: new SupabaseProductRepository(supabase, tenant),
    dashboard: new SupabaseDashboardRepository(supabase, tenant),
    orders: new SupabaseOrderRepository(supabase, tenant),
    transactions: new SupabaseTransactionRepository(supabase, tenant),
    units: new SupabaseUnitRepository(supabase, tenant),
  };
}
