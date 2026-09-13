import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes } from "react-router-dom";
import { SessionProvider } from "@/shared/auth/auth-context";
import { RequireSession } from "@/shared/auth/RequireSession";
import { TenantProvider } from "@/shared/tenant/tenant-context";
import { ContainerProvider } from "@/shared/container/container-context";
import { AppLayout } from "@/shared/ui/AppLayout";
import { DashboardPage } from "@/modules/dashboard/ui/DashboardPage";
import { ProductsPage } from "@/modules/products/ui/ProductsPage";
import { OrdersPage } from "@/modules/orders/ui/OrdersPage";
import { TransactionsPage } from "@/modules/transactions/ui/TransactionsPage";
import { UnitsPage } from "@/modules/units/ui/UnitsPage";

// `staleTime` evita refazer a consulta a cada foco de janela — num painel
// administrativo os dados não mudam de segundo a segundo.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

/**
 * `HashRouter` e não `BrowserRouter`: empacotado, o Electron carrega a
 * aplicação pelo sistema de arquivos, onde rotas por caminho não resolvem.
 */
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <RequireSession>
          <TenantProvider>
            <ContainerProvider>
              <HashRouter>
                <Routes>
                  <Route element={<AppLayout />}>
                    <Route index element={<DashboardPage />} />
                    <Route path="comandas" element={<OrdersPage />} />
                    <Route path="transacoes" element={<TransactionsPage />} />
                    <Route path="produtos" element={<ProductsPage />} />
                    <Route path="unidades" element={<UnitsPage />} />
                  </Route>
                </Routes>
              </HashRouter>
            </ContainerProvider>
          </TenantProvider>
        </RequireSession>
      </SessionProvider>
    </QueryClientProvider>
  );
}
