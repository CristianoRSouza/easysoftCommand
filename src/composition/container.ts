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

import type { NfceRepository } from "@/modules/nfce/application/nfce-repository";
import { SupabaseNfceRepository } from "@/modules/nfce/infrastructure/supabase-nfce-repository";
import { PostgresNfceRepository } from "@/modules/nfce/infrastructure/postgres-nfce-repository";

import type { IssuerRepository } from "@/modules/issuer/application/issuer-repository";
import { SupabaseIssuerRepository } from "@/modules/issuer/infrastructure/supabase-issuer-repository";
import { PostgresIssuerRepository } from "@/modules/issuer/infrastructure/postgres-issuer-repository";

import type { TotemRepository } from "@/modules/totems/application/totem-repository";
import { SupabaseTotemRepository } from "@/modules/totems/infrastructure/supabase-totem-repository";
import { PostgresTotemRepository } from "@/modules/totems/infrastructure/postgres-totem-repository";

import type { SyncRepository } from "@/modules/sync/application/sync-repository";
import { SupabaseSyncRepository } from "@/modules/sync/infrastructure/supabase-sync-repository";
import { PostgresSyncRepository } from "@/modules/sync/infrastructure/postgres-sync-repository";

import type { RevenueRepository } from "@/modules/revenue/application/revenue-repository";
import { SupabaseRevenueRepository } from "@/modules/revenue/infrastructure/supabase-revenue-repository";
import { PostgresRevenueRepository } from "@/modules/revenue/infrastructure/postgres-revenue-repository";

import type { AuditRepository } from "@/modules/audit/application/audit-repository";
import { SupabaseAuditRepository } from "@/modules/audit/infrastructure/supabase-audit-repository";
import { PostgresAuditRepository } from "@/modules/audit/infrastructure/postgres-audit-repository";

import type { AgentRepository } from "@/modules/agents/application/agent-repository";
import { SupabaseAgentRepository } from "@/modules/agents/infrastructure/supabase-agent-repository";
import { PostgresAgentRepository } from "@/modules/agents/infrastructure/postgres-agent-repository";

import type { PixRepository } from "@/modules/pixnopdv/application/pix-repository";
import { SupabasePixRepository } from "@/modules/pixnopdv/infrastructure/supabase-pix-repository";
import { PostgresPixRepository } from "@/modules/pixnopdv/infrastructure/postgres-pix-repository";

import type { UnitRepository } from "@/modules/units/application/unit-repository";
import { SupabaseUnitRepository } from "@/modules/units/infrastructure/supabase-unit-repository";
import { PostgresUnitRepository } from "@/modules/units/infrastructure/postgres-unit-repository";

export interface Container {
  products: ProductRepository;
  dashboard: DashboardRepository;
  orders: OrderRepository;
  transactions: TransactionRepository;
  units: UnitRepository;
  nfce: NfceRepository;
  issuer: IssuerRepository;
  totems: TotemRepository;
  sync: SyncRepository;
  revenue: RevenueRepository;
  audit: AuditRepository;
  agents: AgentRepository;
  pix: PixRepository;
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
      nfce: new PostgresNfceRepository(api),
      issuer: new PostgresIssuerRepository(api),
      totems: new PostgresTotemRepository(api),
      sync: new PostgresSyncRepository(api),
      revenue: new PostgresRevenueRepository(api),
      audit: new PostgresAuditRepository(api),
      agents: new PostgresAgentRepository(api),
      pix: new PostgresPixRepository(api),
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
    nfce: new SupabaseNfceRepository(supabase, tenant),
    issuer: new SupabaseIssuerRepository(supabase, tenant),
    totems: new SupabaseTotemRepository(supabase, tenant),
    sync: new SupabaseSyncRepository(supabase, tenant),
    revenue: new SupabaseRevenueRepository(supabase, tenant),
    audit: new SupabaseAuditRepository(supabase, tenant),
    agents: new SupabaseAgentRepository(supabase, tenant),
    pix: new SupabasePixRepository(supabase, tenant),
  };
}
