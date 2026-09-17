import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes } from "react-router-dom";
import { AppProviders } from "@/shared/providers/AppProviders";
import { AppLayout } from "@/shared/ui/AppLayout";
import { DashboardPage } from "@/modules/dashboard/ui/DashboardPage";
import { ProductsPage } from "@/modules/products/ui/ProductsPage";
import { OrdersPage } from "@/modules/orders/ui/OrdersPage";
import { TransactionsPage } from "@/modules/transactions/ui/TransactionsPage";
import { UnitsPage } from "@/modules/units/ui/UnitsPage";
import { NfcePage } from "@/modules/nfce/ui/NfcePage";
import { NfceDetailPage } from "@/modules/nfce/ui/NfceDetailPage";
import { IssuerPage } from "@/modules/issuer/ui/IssuerPage";
import { TotemsPage } from "@/modules/totems/ui/TotemsPage";
import { RevenuePage } from "@/modules/revenue/ui/RevenuePage";
import { AuditPage } from "@/modules/audit/ui/AuditPage";
import { AgentsPage } from "@/modules/agents/ui/AgentsPage";
import { PixPage } from "@/modules/pixnopdv/ui/PixPage";
import { CloudQueuePage } from "@/modules/sync/ui/CloudQueuePage";
import { ManualPage } from "@/pages/ManualPage";
import { WizardPage } from "@/pages/WizardPage";
import { BootstrapCodePage } from "@/pages/BootstrapCodePage";
import { NotFoundPage } from "@/pages/NotFoundPage";

// `staleTime` evita refazer a consulta a cada foco de janela — num painel
// administrativo os dados não mudam de segundo a segundo.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

/**
 * `HashRouter` veio do tempo do Electron, que abria a aplicação pelo sistema
 * de arquivos. Ficou porque a troca muda todos os endereços e a migração para
 * Next.js vai refazer o roteamento de qualquer forma. O link de recuperação de
 * senha não depende dele: o token chega na query e é lido antes das rotas.
 */
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProviders>
        <HashRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="comandas" element={<OrdersPage />} />
              <Route path="transacoes" element={<TransactionsPage />} />
              <Route path="nfce" element={<NfcePage />} />
              <Route path="nfce/:noteId" element={<NfceDetailPage />} />
              <Route path="produtos" element={<ProductsPage />} />
              <Route path="unidades" element={<UnitsPage />} />
              <Route path="emitente" element={<IssuerPage />} />
              <Route path="receitas" element={<RevenuePage />} />
              <Route path="totens" element={<TotemsPage />} />
              <Route path="auditoria" element={<AuditPage />} />
              <Route path="fila-nuvem" element={<CloudQueuePage />} />
              <Route path="agentes" element={<AgentsPage />} />
              <Route path="pixnopdv" element={<PixPage />} />
              <Route path="assistente" element={<WizardPage />} />
              <Route path="primeiro-acesso" element={<BootstrapCodePage />} />
              <Route path="manual" element={<ManualPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </HashRouter>
      </AppProviders>
    </QueryClientProvider>
  );
}
