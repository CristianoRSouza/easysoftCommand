# EasyCommand Refatorado — Plano de Implementação (Fatia Vertical)

> **Para executores:** implemente tarefa a tarefa, na ordem. Os passos usam
> caixas (`- [ ]`) para acompanhamento.

**Objetivo:** Construir a fundação da arquitetura limpa e o módulo de Produtos ponta a
ponta, num aplicativo que abre e funciona no navegador (Supabase) e no programa
instalado (PostgreSQL local).

**Arquitetura:** Feature-first. Cada módulo tem `domain` (puro), `application`
(casos de uso e portas), `infrastructure` (implementações) e `ui` (React). As
dependências apontam para dentro: `domain` não importa nada; nenhum arquivo de
`domain` ou `application` menciona React, Supabase, `pg` ou `window.electronAPI`.
A escolha da fonte de dados acontece uma única vez, em `composition/`.

**Stack:** React 18.3 · TypeScript 5.6 · Vite 5.4 · TailwindCSS 3.4 ·
TanStack Query 5 · React Router 6.28 · Supabase JS 2.103 · Electron 33 · pg 8.13

**Spec:** `docs/specs/2026-09-13-arquitetura-design.md`

## Restrições globais

- **Sem testes automatizados nesta etapa.** Decisão explícita do dono do projeto. Cada
  tarefa termina com verificação concreta (compilação e observação real), não com
  ciclo de teste.
- **Idioma:** toda a interface e mensagens de erro em PT-BR. Nomes de campo, tipos e
  identificadores em inglês.
- **Nada além do necessário.** Nenhuma dependência que a fatia não use. Nenhum
  componente de UI instalado "para depois".
- **`domain` e `application` são puros.** Nenhum import de React, Supabase, `pg`,
  `window` ou qualquer framework.
- **Segredos:** apenas variáveis `VITE_*` chegam ao pacote do navegador. Credenciais
  do PostgreSQL vivem no `.env` lido pelo processo principal do Electron.
- **Electron:** `contextIsolation: true` e `nodeIntegration: false` são fixos. O
  renderer só acessa Node pela superfície mínima do preload.
- **Versões:** use exatamente as fixadas na seção Stack.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/modules/products/domain/product.ts` | Entidade `Product` e tipos de filtro. Puro. |
| `src/modules/products/application/product-repository.ts` | A porta (interface) que a UI consome. |
| `src/modules/products/application/list-products.ts` | Caso de uso de listagem paginada. |
| `src/modules/products/infrastructure/supabase-product-repository.ts` | Lê `pv_products`, filtra por `store_id`. |
| `src/modules/products/infrastructure/postgres-product-repository.ts` | Lê `products` com `JOIN units` via IPC. |
| `src/modules/products/ui/ProductsPage.tsx` | Tela de listagem. |
| `src/modules/products/ui/ProductFilters.tsx` | Barra de busca e filtros. |
| `src/modules/products/ui/ProductTable.tsx` | Tabela e paginação. |
| `src/modules/dashboard/…` | Mesma estrutura, para os três indicadores. |
| `src/shared/runtime/environment.ts` | Detecção de ambiente. Um arquivo, regra explícita. |
| `src/shared/supabase/client.ts` | Cliente Supabase configurado por `.env`. |
| `src/shared/tenant/tenant-context.tsx` | Empresa e loja selecionadas. |
| `src/shared/auth/…` | Sessão, login e proteção de rota. |
| `src/shared/ui/…` | Layout, navegação e componentes base. |
| `src/composition/container.ts` | Onde as implementações são escolhidas. |
| `electron/main.cjs` | Processo principal: janela e pool PostgreSQL. |
| `electron/preload.cjs` | Superfície mínima exposta ao renderer. |

---

## Task 1: Fundação do projeto

**Arquivos:**
- Criar: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`,
  `tailwind.config.ts`, `postcss.config.js`, `index.html`, `.gitignore`,
  `.env.example`, `src/main.tsx`, `src/App.tsx`, `src/index.css`

**Produz:** um projeto que compila e abre uma página em branco estilizada.

- [ ] **Passo 1: Inicializar o projeto**

Na pasta `C:\Users\crist\Desktop\EASYCOMMAND REFATORADO`:

```bash
npm init -y
npm install react@^18.3.1 react-dom@^18.3.1 react-router-dom@^6.28.1 \
  @tanstack/react-query@^5.62.11 @supabase/supabase-js@^2.103.0 \
  lucide-react@^0.469.0 clsx@^2.1.1 tailwind-merge@^2.6.0
npm install -D typescript@^5.6.3 vite@^5.4.11 @vitejs/plugin-react-swc@^3.5.0 \
  @types/react@^18.3.1 @types/react-dom@^18.3.1 tailwindcss@^3.4.17 \
  postcss@^8.4.49 autoprefixer@^10.4.20
```

- [ ] **Passo 2: Escrever `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`strict` e `noUncheckedIndexedAccess` são deliberados: o projeto antigo tinha tipos
frouxos, e é neles que os erros de mapeamento se escondem.

- [ ] **Passo 3: Escrever `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "composite": true,
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Passo 4: Escrever `vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";

export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: { host: true, port: 8080 },
});
```

`base: "./"` é obrigatório: sem isso o Electron não encontra os arquivos ao abrir o
`index.html` pelo sistema de arquivos.

- [ ] **Passo 5: Configurar Tailwind**

`tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: { DEFAULT: "#0B1220", raised: "#111A2C", border: "#1E2A44" },
        ink: { DEFAULT: "#E6EDF7", muted: "#8A9AB5" },
        accent: { DEFAULT: "#3B82F6", hover: "#2563EB" },
        ok: "#10B981",
        warn: "#F59E0B",
        danger: "#EF4444",
      },
    },
  },
  plugins: [],
} satisfies Config;
```

`postcss.config.js`:

```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

- [ ] **Passo 6: Escrever `src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html, body, #root { height: 100%; }
  body {
    @apply bg-base text-ink antialiased;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  }
}
```

- [ ] **Passo 7: Escrever `index.html`**

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>EasyCommand</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Passo 8: Escrever `src/main.tsx` e `src/App.tsx`**

`src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root não encontrado no index.html");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/App.tsx` (provisório, substituído na Task 6):

```tsx
export default function App() {
  return <div className="p-8 text-ink">EasyCommand</div>;
}
```

- [ ] **Passo 9: Escrever `.gitignore` e `.env.example`**

`.gitignore`:

```
node_modules/
dist/
electron-release/
.env
.env.local
*.local
```

`.env.example`:

```
# Navegador (Vite expõe apenas VITE_*)
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=

# Processo principal do Electron — nunca chega ao navegador
PG_HOST=127.0.0.1
PG_PORT=5432
PG_DATABASE=easyfood
PG_USER=
PG_PASSWORD=
```

- [ ] **Passo 10: Adicionar scripts ao `package.json`**

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Passo 11: Verificar**

```bash
npm run dev
```

Esperado: servidor sobe na porta 8080; abrir `http://127.0.0.2:8080` mostra a palavra
"EasyCommand" em texto claro sobre fundo escuro.

```bash
npm run build
```

Esperado: termina sem erro e gera `dist/`.

- [ ] **Passo 12: Commit**

```bash
git init
git add -A
git commit -m "chore: fundação do projeto (Vite + React + TS + Tailwind)"
```

---

## Task 2: Domínio e aplicação de Produtos

**Arquivos:**
- Criar: `src/modules/products/domain/product.ts`
- Criar: `src/modules/products/application/product-repository.ts`
- Criar: `src/modules/products/application/list-products.ts`

**Consome:** nada.

**Produz:** `Product`, `ProductQuery`, `ProductPage`, `ProductRepository`,
`listProducts`.

Esta é a camada que o projeto antigo não tinha: o tipo `Product` vivia dentro de
`mock-data.ts`. Aqui ele é o centro, e não depende de nada.

- [ ] **Passo 1: Escrever a entidade**

`src/modules/products/domain/product.ts`:

```ts
/**
 * Produto — entidade de domínio.
 *
 * Representa o produto como o negócio o entende, independente de onde ele
 * está guardado. As fontes divergem (tabela `products` no PostgreSQL local,
 * `pv_products` no Supabase); traduzir uma na outra é responsabilidade da
 * camada de infraestrutura, nunca daqui.
 */
export interface Product {
  id: string;
  description: string;
  barcode: string;
  salePrice: number;
  stockQuantity: number;
  unitName: string | null;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ActiveFilter = "all" | "active" | "inactive";
export type StockFilter = "all" | "in_stock" | "out_of_stock";
export type ProductSortKey =
  | "description"
  | "barcode"
  | "salePrice"
  | "stockQuantity"
  | "isActive";
export type SortDirection = "asc" | "desc";

/** Critérios de consulta. `page` começa em 1. */
export interface ProductQuery {
  search: string;
  activeFilter: ActiveFilter;
  stockFilter: StockFilter;
  priceMin: number | null;
  priceMax: number | null;
  sortKey: ProductSortKey;
  sortDirection: SortDirection;
  page: number;
  pageSize: number;
}

/** Uma página de resultados. `total` é a contagem do filtro inteiro, não da página. */
export interface ProductPage {
  items: Product[];
  total: number;
}

export const DEFAULT_PRODUCT_QUERY: ProductQuery = {
  search: "",
  activeFilter: "all",
  stockFilter: "all",
  priceMin: null,
  priceMax: null,
  sortKey: "description",
  sortDirection: "asc",
  page: 1,
  pageSize: 50,
};

/** Converte página (base 1) no intervalo de índices que os repositórios usam. */
export function pageToRange(page: number, pageSize: number): { from: number; to: number } {
  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.max(1, Math.floor(pageSize));
  const from = (safePage - 1) * safeSize;
  return { from, to: from + safeSize - 1 };
}
```

- [ ] **Passo 2: Escrever a porta**

`src/modules/products/application/product-repository.ts`:

```ts
import type { ProductPage, ProductQuery } from "../domain/product";

/**
 * Porta de acesso a produtos.
 *
 * A UI depende desta interface, nunca de uma implementação. Quem decide qual
 * implementação usar é `src/composition/container.ts`, uma única vez.
 */
export interface ProductRepository {
  list(query: ProductQuery): Promise<ProductPage>;
}
```

A porta tem um método só. O dashboard conta produtos pelo seu próprio repositório —
acrescentar um `countActive` aqui criaria um método que ninguém chama.

- [ ] **Passo 3: Escrever o caso de uso**

`src/modules/products/application/list-products.ts`:

```ts
import type { ProductPage, ProductQuery } from "../domain/product";
import type { ProductRepository } from "./product-repository";

/**
 * Lista produtos conforme os critérios informados.
 *
 * Não sabe — e não pode saber — se os dados vêm do PostgreSQL local ou do
 * Supabase. É exatamente essa ignorância que elimina as 101 repetições de
 * `if (isElectron())` do projeto antigo.
 */
export function listProducts(repository: ProductRepository) {
  return (query: ProductQuery): Promise<ProductPage> => repository.list(query);
}
```

- [ ] **Passo 4: Verificar**

```bash
npm run typecheck
```

Esperado: nenhum erro.

- [ ] **Passo 5: Commit**

```bash
git add src/modules/products
git commit -m "feat(products): domínio, porta de repositório e caso de uso"
```

---

## Task 3: Infraestrutura Supabase

**Arquivos:**
- Criar: `src/shared/supabase/client.ts`
- Criar: `src/shared/tenant/tenant.ts`
- Criar: `src/modules/products/infrastructure/supabase-product-repository.ts`

**Consome:** `Product`, `ProductQuery`, `ProductPage`, `pageToRange`,
`ProductRepository` (Task 2).

**Produz:** `supabase`, `Tenant`, `SupabaseProductRepository`.

- [ ] **Passo 1: Escrever o cliente Supabase**

`src/shared/supabase/client.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error(
    "VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY são obrigatórias. Copie o .env.example para .env.",
  );
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, storage: localStorage },
});
```

No projeto antigo essas credenciais estavam escritas no código e as variáveis de
ambiente eram ignoradas — mudar o `.env` não mudava nada. Aqui a ausência falha alto,
na inicialização, em vez de silenciosamente apontar para o projeto errado.

- [ ] **Passo 2: Declarar os tipos das variáveis de ambiente**

`src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Passo 3: Escrever o tipo de tenant**

`src/shared/tenant/tenant.ts`:

```ts
/** Empresa e loja selecionadas. Toda leitura no Supabase é filtrada por `storeId`. */
export interface Tenant {
  companyId: string;
  storeId: string;
}
```

- [ ] **Passo 4: Escrever o repositório Supabase**

`src/modules/products/infrastructure/supabase-product-repository.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductRepository } from "../application/product-repository";
import {
  pageToRange,
  type Product,
  type ProductPage,
  type ProductQuery,
} from "../domain/product";
import type { Tenant } from "@/shared/tenant/tenant";

/** Colunas de `pv_products`, com a unidade resolvida por relação. */
const COLUMNS =
  "id, description, sale_price, barcode, stock_quantity, image_url, is_active, created_at, updated_at, pv_product_units:unit_id(short_description)";

/** Nome da coluna correspondente a cada chave de ordenação do domínio. */
const SORT_COLUMN: Record<ProductQuery["sortKey"], string> = {
  description: "description",
  barcode: "barcode",
  salePrice: "sale_price",
  stockQuantity: "stock_quantity",
  isActive: "is_active",
};

interface Row {
  id: string;
  description: string | null;
  sale_price: number | string | null;
  barcode: string | null;
  stock_quantity: number | string | null;
  image_url: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  pv_product_units: { short_description: string | null } | null;
}

function toNumber(value: number | string | null): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** Converte a linha do Supabase no `Product` do domínio. */
function toProduct(row: Row): Product {
  return {
    id: row.id,
    description: row.description ?? "",
    barcode: row.barcode ?? "",
    salePrice: toNumber(row.sale_price),
    stockQuantity: toNumber(row.stock_quantity),
    unitName: row.pv_product_units?.short_description ?? null,
    imageUrl: row.image_url,
    isActive: row.is_active ?? false,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

/**
 * Lê produtos do Supabase, sempre restrito à loja selecionada.
 *
 * O `storeId` é injetado na construção. Sem loja não existe repositório —
 * é impossível, por construção, consultar sem filtro de tenant.
 */
export class SupabaseProductRepository implements ProductRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly tenant: Tenant,
  ) {}

  async list(query: ProductQuery): Promise<ProductPage> {
    const { from, to } = pageToRange(query.page, query.pageSize);

    let request = this.client
      .from("pv_products")
      .select(COLUMNS, { count: "exact" })
      .eq("store_id", this.tenant.storeId);

    if (query.activeFilter === "active") request = request.eq("is_active", true);
    else if (query.activeFilter === "inactive") request = request.eq("is_active", false);

    if (query.stockFilter === "in_stock") request = request.gt("stock_quantity", 0);
    else if (query.stockFilter === "out_of_stock") request = request.lte("stock_quantity", 0);

    if (query.priceMin !== null) request = request.gte("sale_price", query.priceMin);
    if (query.priceMax !== null) request = request.lte("sale_price", query.priceMax);

    const term = query.search.trim();
    if (term) {
      // `%`, `,` e parênteses quebram a sintaxe do filtro `or` do PostgREST.
      const safe = term.replace(/[%,()]/g, " ");
      request = request.or(`description.ilike.%${safe}%,barcode.ilike.%${safe}%`);
    }

    const column = SORT_COLUMN[query.sortKey];
    const { data, error, count } = await request
      .order(column, { ascending: query.sortDirection === "asc" })
      .range(from, to);

    if (error) throw new Error(`Falha ao listar produtos: ${error.message}`);

    return {
      items: (data as unknown as Row[] | null)?.map(toProduct) ?? [],
      total: count ?? 0,
    };
  }
}
```

Repare no tratamento de erro: **lança**. O projeto antigo devolvia `null` e caía em
dados falsos, o que fazia uma falha de permissão parecer uma loja sem produtos.

- [ ] **Passo 5: Verificar**

```bash
npm run typecheck
```

Esperado: nenhum erro.

- [ ] **Passo 6: Commit**

```bash
git add src/shared src/modules/products/infrastructure src/vite-env.d.ts
git commit -m "feat(products): repositório Supabase com filtro obrigatório de loja"
```

---

## Task 4: Infraestrutura Electron

**Arquivos:**
- Criar: `electron/main.cjs`, `electron/preload.cjs`
- Criar: `src/shared/runtime/electron-api.ts`
- Criar: `src/modules/products/infrastructure/postgres-product-repository.ts`
- Modificar: `package.json` (dependências e scripts do Electron)

**Consome:** `Product`, `ProductQuery`, `ProductPage`, `pageToRange`,
`ProductRepository` (Task 2).

**Produz:** `ElectronApi`, `getElectronApi`, `PostgresProductRepository`.

- [ ] **Passo 1: Instalar as dependências do Electron**

```bash
npm install -D electron@^33.3.1 @electron/packager@^18.3.5
npm install pg@^8.13.1 dotenv@^16.4.7
```

- [ ] **Passo 2: Escrever o processo principal**

`electron/main.cjs`:

```js
'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');

require('dotenv').config({ path: path.join(app.getAppPath(), '.env') });

let pool = null;

/** Cria o pool sob demanda. Falha alto se faltar configuração. */
function getPool() {
  if (pool) return pool;
  const { PG_HOST, PG_PORT, PG_DATABASE, PG_USER, PG_PASSWORD } = process.env;
  if (!PG_HOST || !PG_DATABASE || !PG_USER) {
    throw new Error('PG_HOST, PG_DATABASE e PG_USER são obrigatórios no .env');
  }
  const { Pool } = require('pg');
  pool = new Pool({
    host: PG_HOST,
    port: Number(PG_PORT ?? 5432),
    database: PG_DATABASE,
    user: PG_USER,
    password: PG_PASSWORD,
    max: 5,
    idleTimeoutMillis: 30000,
  });
  return pool;
}

// Única porta de entrada a dados no modo local. Somente leitura nesta fatia.
ipcMain.handle('db:query', async (_event, sql, params) => {
  try {
    const result = await getPool().query(sql, params);
    return { ok: true, rows: result.rows };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
});

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#0B1220',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (devServer) window.loadURL(devServer);
  else window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
```

- [ ] **Passo 3: Escrever o preload**

`electron/preload.cjs`:

```js
'use strict';

// Superfície mínima exposta ao renderer. Só cresce quando um módulo novo precisar —
// nunca "por precaução".
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  query: (sql, params) => ipcRenderer.invoke('db:query', sql, params),
});
```

- [ ] **Passo 4: Tipar a ponte no renderer**

`src/shared/runtime/electron-api.ts`:

```ts
/** Resultado de uma consulta vinda do processo principal. */
export type QueryResult<T> = { ok: true; rows: T[] } | { ok: false; error: string };

export interface ElectronApi {
  query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
}

declare global {
  interface Window {
    electronAPI?: ElectronApi;
  }
}

/** Devolve a ponte, ou `null` quando a aplicação roda no navegador. */
export function getElectronApi(): ElectronApi | null {
  return typeof window === "undefined" ? null : (window.electronAPI ?? null);
}
```

- [ ] **Passo 5: Escrever o repositório PostgreSQL**

`src/modules/products/infrastructure/postgres-product-repository.ts`:

```ts
import type { ProductRepository } from "../application/product-repository";
import {
  pageToRange,
  type Product,
  type ProductPage,
  type ProductQuery,
} from "../domain/product";
import type { ElectronApi } from "@/shared/runtime/electron-api";

/** Coluna correspondente a cada chave de ordenação. Lista fechada: nunca interpolar entrada do usuário. */
const SORT_COLUMN: Record<ProductQuery["sortKey"], string> = {
  description: "p.description",
  barcode: "p.barcode",
  salePrice: "p.sale_price",
  stockQuantity: "p.stock_quantity",
  isActive: "p.is_active",
};

interface Row {
  id: string;
  description: string | null;
  barcode: string | null;
  sale_price: string | number | null;
  stock_quantity: string | number | null;
  unit_name: string | null;
  image_url: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  total: string | number;
}

function toNumber(value: string | number | null): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toProduct(row: Row): Product {
  return {
    id: row.id,
    description: row.description ?? "",
    barcode: row.barcode ?? "",
    salePrice: toNumber(row.sale_price),
    stockQuantity: toNumber(row.stock_quantity),
    unitName: row.unit_name,
    imageUrl: row.image_url,
    isActive: row.is_active ?? false,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

/**
 * Lê produtos do PostgreSQL local, via IPC.
 *
 * A tabela local (`products`) não tem a unidade resolvida nem coluna de loja —
 * daí o JOIN e a ausência de filtro de tenant, ao contrário do Supabase.
 * Essa diferença termina aqui: quem chama recebe o mesmo `Product`.
 */
export class PostgresProductRepository implements ProductRepository {
  constructor(private readonly api: ElectronApi) {}

  async list(query: ProductQuery): Promise<ProductPage> {
    const { from } = pageToRange(query.page, query.pageSize);
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.activeFilter === "active") conditions.push("p.is_active = true");
    else if (query.activeFilter === "inactive") conditions.push("p.is_active = false");

    if (query.stockFilter === "in_stock") conditions.push("p.stock_quantity > 0");
    else if (query.stockFilter === "out_of_stock") conditions.push("p.stock_quantity <= 0");

    if (query.priceMin !== null) {
      params.push(query.priceMin);
      conditions.push(`p.sale_price >= $${params.length}`);
    }
    if (query.priceMax !== null) {
      params.push(query.priceMax);
      conditions.push(`p.sale_price <= $${params.length}`);
    }

    const term = query.search.trim();
    if (term) {
      params.push(`%${term}%`);
      conditions.push(`(p.description ILIKE $${params.length} OR p.barcode ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const orderColumn = SORT_COLUMN[query.sortKey];
    const direction = query.sortDirection === "asc" ? "ASC" : "DESC";

    params.push(query.pageSize, from);
    const limitParam = params.length - 1;
    const offsetParam = params.length;

    // COUNT(*) OVER () devolve o total do filtro junto das linhas da página,
    // evitando uma segunda ida ao banco.
    const sql = `
      SELECT p.id, p.description, p.barcode, p.sale_price, p.stock_quantity,
             p.image_url, p.is_active, p.created_at, p.updated_at,
             u.short_description AS unit_name,
             COUNT(*) OVER () AS total
      FROM products p
      LEFT JOIN units u ON u.id = p.unit_id
      ${where}
      ORDER BY ${orderColumn} ${direction}
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    const result = await this.api.query<Row>(sql, params);
    if (!result.ok) throw new Error(`Falha ao listar produtos: ${result.error}`);

    const rows = result.rows;
    const first = rows[0];
    return {
      items: rows.map(toProduct),
      total: first ? toNumber(first.total) : 0,
    };
  }
}
```

Os filtros entram como parâmetros (`$1`, `$2`, …) e a ordenação vem de uma lista
fechada. Nenhuma entrada do usuário é concatenada no SQL.

- [ ] **Passo 6: Adicionar os scripts do Electron ao `package.json`**

```json
{
  "main": "electron/main.cjs",
  "scripts": {
    "electron:dev": "set VITE_DEV_SERVER_URL=http://localhost:8080&& electron .",
    "electron:build": "npm run build && electron .",
    "package:win": "npm run build && electron-packager . easycommand --platform=win32 --arch=x64 --out=electron-release --overwrite --prune=true --ignore=\"^/src($|/)\" --ignore=\"^/docs($|/)\" --ignore=\"^/\\.env$\""
  }
}
```

O `--ignore` do `.env` é deliberado: ele contém a senha do PostgreSQL e nunca deve
entrar no pacote distribuído.

- [ ] **Passo 7: Verificar**

```bash
npm run typecheck
```

Esperado: nenhum erro.

- [ ] **Passo 8: Commit**

```bash
git add electron src/shared/runtime src/modules/products/infrastructure package.json
git commit -m "feat(products): processo Electron e repositório PostgreSQL local"
```

---

## Task 5: Detecção de ambiente e composição

**Arquivos:**
- Criar: `src/shared/runtime/environment.ts`
- Criar: `src/composition/container.ts`

**Consome:** `getElectronApi` (Task 4), `SupabaseProductRepository` (Task 3),
`PostgresProductRepository` (Task 4), `Tenant` (Task 3).

**Produz:** `DataSource`, `detectDataSource`, `createContainer`, `Container`.

Esta é a tarefa que impede o god object de renascer.

- [ ] **Passo 1: Escrever a detecção de ambiente**

`src/shared/runtime/environment.ts`:

```ts
import { getElectronApi } from "./electron-api";

export type DataSource = "postgres" | "supabase";

/**
 * Decide de onde vêm os dados. Uma regra, um lugar, sem exceções.
 *
 * O projeto antigo espalhava essa decisão por três funções encadeadas, e o
 * resultado surpreendia: em `localhost`, o resolvedor de endereço da API
 * devolvia a origem da própria página, a aplicação concluía que havia
 * encontrado uma API e nunca alcançava o Supabase. Sem heurística de nome de
 * host, esse problema não tem como existir.
 */
export function detectDataSource(): DataSource {
  return getElectronApi() ? "postgres" : "supabase";
}
```

- [ ] **Passo 2: Escrever o container**

`src/composition/container.ts`:

```ts
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
```

- [ ] **Passo 3: Verificar**

```bash
npm run typecheck
```

Esperado: nenhum erro.

- [ ] **Passo 4: Commit**

```bash
git add src/shared/runtime/environment.ts src/composition
git commit -m "feat: detecção de ambiente explícita e raiz de composição"
```

---

## Task 6: Autenticação, tenant e casca da aplicação

**Arquivos:**
- Criar: `src/shared/auth/auth-context.tsx`, `src/shared/auth/LoginPage.tsx`,
  `src/shared/auth/RequireSession.tsx`
- Criar: `src/shared/tenant/tenant-context.tsx`
- Criar: `src/shared/ui/AppLayout.tsx`, `src/shared/ui/Sidebar.tsx`
- Criar: `src/shared/container/container-context.tsx`
- Modificar: `src/App.tsx`

**Consome:** `supabase` (Task 3), `Tenant` (Task 3), `createContainer`,
`detectDataSource` (Task 5).

**Produz:** `useSession`, `useTenant`, `useContainer`, `AppLayout`.

- [ ] **Passo 1: Escrever o contexto de sessão**

`src/shared/auth/auth-context.tsx`:

```tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/shared/supabase/client";
import { detectDataSource } from "@/shared/runtime/environment";

interface SessionState {
  session: Session | null;
  loading: boolean;
  /** No modo local não há login: o acesso ao banco já é a credencial. */
  requiresLogin: boolean;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const requiresLogin = detectDataSource() === "supabase";
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(requiresLogin);

  useEffect(() => {
    if (!requiresLogin) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, [requiresLogin]);

  const value = useMemo<SessionState>(
    () => ({
      session,
      loading,
      requiresLogin,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error("E-mail ou senha inválidos.");
      },
      async signOut() {
        await supabase.auth.signOut();
      },
    }),
    [session, loading, requiresLogin],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession precisa estar dentro de SessionProvider.");
  return context;
}
```

- [ ] **Passo 2: Escrever o contexto de tenant**

`src/shared/tenant/tenant-context.tsx`:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useSession } from "@/shared/auth/auth-context";
import { detectDataSource } from "@/shared/runtime/environment";
import type { Tenant } from "./tenant";

const TenantContext = createContext<Tenant | null>(null);

/**
 * Resolve a loja a partir dos metadados do usuário autenticado.
 *
 * Um seletor de empresa/loja é trabalho do módulo de multi-tenant, que não faz
 * parte desta fatia. Aqui basta ler o que o Supabase já entrega no login.
 */
export function TenantProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const [tenant, setTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    if (detectDataSource() === "postgres") return;
    const metadata = session?.user.user_metadata as Record<string, unknown> | undefined;
    const companyId = typeof metadata?.company_id === "string" ? metadata.company_id : null;
    const storeId = typeof metadata?.store_id === "string" ? metadata.store_id : null;
    setTenant(companyId && storeId ? { companyId, storeId } : null);
  }, [session]);

  return <TenantContext.Provider value={tenant}>{children}</TenantContext.Provider>;
}

export function useTenant(): Tenant | null {
  return useContext(TenantContext);
}
```

- [ ] **Passo 3: Escrever o contexto do container**

`src/shared/container/container-context.tsx`:

```tsx
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createContainer, type Container } from "@/composition/container";
import { useTenant } from "@/shared/tenant/tenant-context";

const ContainerContext = createContext<Container | null>(null);

export function ContainerProvider({ children }: { children: ReactNode }) {
  const tenant = useTenant();
  const container = useMemo(() => createContainer(tenant), [tenant]);
  return <ContainerContext.Provider value={container}>{children}</ContainerContext.Provider>;
}

export function useContainer(): Container {
  const context = useContext(ContainerContext);
  if (!context) throw new Error("useContainer precisa estar dentro de ContainerProvider.");
  return context;
}
```

- [ ] **Passo 4: Escrever a tela de login**

`src/shared/auth/LoginPage.tsx`:

```tsx
import { useState, type FormEvent } from "react";
import { useSession } from "./auth-context";

export function LoginPage() {
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível entrar.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 rounded-xl border border-base-border bg-base-raised p-8"
      >
        <div>
          <h1 className="text-xl font-semibold">EasyCommand</h1>
          <p className="mt-1 text-sm text-ink-muted">Acesse para gerenciar a loja.</p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm text-ink-muted">E-mail</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-base-border bg-base px-3 py-2 outline-none focus:border-accent"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm text-ink-muted">Senha</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-base-border bg-base px-3 py-2 outline-none focus:border-accent"
          />
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-accent py-2 font-medium text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {submitting ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Passo 5: Escrever a proteção de rota**

`src/shared/auth/RequireSession.tsx`:

```tsx
import type { ReactNode } from "react";
import { useSession } from "./auth-context";
import { LoginPage } from "./LoginPage";

export function RequireSession({ children }: { children: ReactNode }) {
  const { session, loading, requiresLogin } = useSession();

  if (!requiresLogin) return <>{children}</>;
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-ink-muted">Carregando…</div>;
  }
  if (!session) return <LoginPage />;
  return <>{children}</>;
}
```

- [ ] **Passo 6: Escrever o layout e a navegação**

`src/shared/ui/Sidebar.tsx`:

```tsx
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Package } from "lucide-react";

const ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/produtos", label: "Produtos", icon: Package },
] as const;

export function Sidebar() {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-base-border bg-base-raised">
      <div className="px-5 py-5">
        <h1 className="text-lg font-semibold">EasyCommand</h1>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                isActive ? "bg-accent/15 text-accent" : "text-ink-muted hover:bg-base hover:text-ink"
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
```

`src/shared/ui/AppLayout.tsx`:

```tsx
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useSession } from "@/shared/auth/auth-context";
import { detectDataSource } from "@/shared/runtime/environment";

export function AppLayout() {
  const { signOut, requiresLogin } = useSession();
  const source = detectDataSource();

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center justify-end gap-4 border-b border-base-border px-5">
          <span className="text-xs text-ink-muted">
            {source === "postgres" ? "Local · PostgreSQL" : "Nuvem · Supabase"}
          </span>
          {requiresLogin && (
            <button onClick={() => void signOut()} className="text-sm text-ink-muted hover:text-ink">
              Sair
            </button>
          )}
        </header>
        <main className="min-h-0 flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Passo 7: Reescrever `src/App.tsx`**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes } from "react-router-dom";
import { SessionProvider } from "@/shared/auth/auth-context";
import { RequireSession } from "@/shared/auth/RequireSession";
import { TenantProvider } from "@/shared/tenant/tenant-context";
import { ContainerProvider } from "@/shared/container/container-context";
import { AppLayout } from "@/shared/ui/AppLayout";
import { DashboardPage } from "@/modules/dashboard/ui/DashboardPage";
import { ProductsPage } from "@/modules/products/ui/ProductsPage";

// `staleTime` evita refazer a consulta a cada foco de janela — no painel os dados
// não mudam de segundo a segundo.
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

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
                    <Route path="produtos" element={<ProductsPage />} />
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
```

`HashRouter` e não `BrowserRouter`: o Electron carrega a aplicação pelo sistema de
arquivos, onde rotas por caminho não resolvem.

- [ ] **Passo 8: Verificar**

Este passo só compila depois da Task 7 e da Task 8, que criam `ProductsPage` e
`DashboardPage`. Execute-o ao final da Task 8.

- [ ] **Passo 9: Commit**

```bash
git add src/shared src/App.tsx
git commit -m "feat: sessão, tenant, container e casca da aplicação"
```

---

## Task 7: Tela de Produtos

**Arquivos:**
- Criar: `src/modules/products/ui/useProducts.ts`
- Criar: `src/modules/products/ui/ProductFilters.tsx`
- Criar: `src/modules/products/ui/ProductTable.tsx`
- Criar: `src/modules/products/ui/ProductsPage.tsx`
- Criar: `src/shared/ui/format.ts`

**Consome:** `useContainer` (Task 6), `listProducts` (Task 2),
`DEFAULT_PRODUCT_QUERY`, `Product`, `ProductQuery` (Task 2).

**Produz:** `ProductsPage`, `formatCurrency`.

- [ ] **Passo 1: Escrever o formatador**

`src/shared/ui/format.ts`:

```ts
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatCurrency(value: number): string {
  return currency.format(value);
}
```

- [ ] **Passo 2: Escrever o hook de consulta**

`src/modules/products/ui/useProducts.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { useContainer } from "@/shared/container/container-context";
import { listProducts } from "../application/list-products";
import type { ProductPage, ProductQuery } from "../domain/product";

export function useProducts(query: ProductQuery) {
  const { products } = useContainer();
  return useQuery<ProductPage>({
    queryKey: ["products", query],
    queryFn: () => listProducts(products)(query),
    placeholderData: (previous) => previous,
  });
}
```

`placeholderData` mantém a página anterior visível enquanto a próxima carrega, em vez
de piscar a tabela vazia a cada troca de filtro.

- [ ] **Passo 3: Escrever os filtros**

`src/modules/products/ui/ProductFilters.tsx`:

```tsx
import { Search } from "lucide-react";
import type { ActiveFilter, ProductQuery, StockFilter } from "../domain/product";

interface Props {
  query: ProductQuery;
  onChange: (patch: Partial<ProductQuery>) => void;
}

const FIELD =
  "rounded-lg border border-base-border bg-base-raised px-3 py-2 text-sm outline-none focus:border-accent";

export function ProductFilters({ query, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-64 flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          value={query.search}
          onChange={(e) => onChange({ search: e.target.value, page: 1 })}
          placeholder="Buscar por nome ou código de barras…"
          className={`${FIELD} w-full pl-9`}
        />
      </div>

      <select
        value={query.activeFilter}
        onChange={(e) => onChange({ activeFilter: e.target.value as ActiveFilter, page: 1 })}
        className={FIELD}
      >
        <option value="all">Todos</option>
        <option value="active">Ativos</option>
        <option value="inactive">Inativos</option>
      </select>

      <select
        value={query.stockFilter}
        onChange={(e) => onChange({ stockFilter: e.target.value as StockFilter, page: 1 })}
        className={FIELD}
      >
        <option value="all">Estoque: todos</option>
        <option value="in_stock">Com estoque</option>
        <option value="out_of_stock">Sem estoque</option>
      </select>

      <input
        type="number"
        value={query.priceMin ?? ""}
        onChange={(e) => onChange({ priceMin: e.target.value === "" ? null : Number(e.target.value), page: 1 })}
        placeholder="Preço mín."
        className={`${FIELD} w-28`}
      />
      <input
        type="number"
        value={query.priceMax ?? ""}
        onChange={(e) => onChange({ priceMax: e.target.value === "" ? null : Number(e.target.value), page: 1 })}
        placeholder="Preço máx."
        className={`${FIELD} w-28`}
      />
    </div>
  );
}
```

- [ ] **Passo 4: Escrever a tabela**

`src/modules/products/ui/ProductTable.tsx`:

```tsx
import type { Product, ProductQuery, ProductSortKey } from "../domain/product";
import { formatCurrency } from "@/shared/ui/format";

interface Props {
  items: Product[];
  query: ProductQuery;
  onSort: (key: ProductSortKey) => void;
}

const COLUMNS: { key: ProductSortKey; label: string; align?: "right" }[] = [
  { key: "description", label: "Produto" },
  { key: "barcode", label: "Código de barras" },
  { key: "salePrice", label: "Preço", align: "right" },
  { key: "stockQuantity", label: "Estoque", align: "right" },
  { key: "isActive", label: "Status" },
];

export function ProductTable({ items, query, onSort }: Props) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-base-border bg-base-raised px-4 py-10 text-center text-sm text-ink-muted">
        Nenhum produto encontrado com os filtros atuais.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-base-border">
      <table className="w-full text-sm">
        <thead className="bg-base-raised text-ink-muted">
          <tr>
            {COLUMNS.map(({ key, label, align }) => (
              <th
                key={key}
                onClick={() => onSort(key)}
                className={`cursor-pointer select-none px-4 py-3 font-medium hover:text-ink ${
                  align === "right" ? "text-right" : "text-left"
                }`}
              >
                {label}
                {query.sortKey === key && (query.sortDirection === "asc" ? " ↑" : " ↓")}
              </th>
            ))}
            <th className="px-4 py-3 text-left font-medium">Unidade</th>
          </tr>
        </thead>
        <tbody>
          {items.map((product) => (
            <tr key={product.id} className="border-t border-base-border">
              <td className="px-4 py-3">{product.description}</td>
              <td className="px-4 py-3 font-mono text-xs text-ink-muted">{product.barcode}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(product.salePrice)}</td>
              <td className="px-4 py-3 text-right">{product.stockQuantity}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    product.isActive ? "bg-ok/15 text-ok" : "bg-danger/15 text-danger"
                  }`}
                >
                  {product.isActive ? "Ativo" : "Inativo"}
                </span>
              </td>
              <td className="px-4 py-3 text-ink-muted">{product.unitName ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Passo 5: Escrever a página**

`src/modules/products/ui/ProductsPage.tsx`:

```tsx
import { useState } from "react";
import { DEFAULT_PRODUCT_QUERY, type ProductQuery, type ProductSortKey } from "../domain/product";
import { useProducts } from "./useProducts";
import { ProductFilters } from "./ProductFilters";
import { ProductTable } from "./ProductTable";

export function ProductsPage() {
  const [query, setQuery] = useState<ProductQuery>(DEFAULT_PRODUCT_QUERY);
  const { data, isPending, error } = useProducts(query);

  const patch = (next: Partial<ProductQuery>) => setQuery((current) => ({ ...current, ...next }));

  const sortBy = (key: ProductSortKey) =>
    patch({
      sortKey: key,
      sortDirection: query.sortKey === key && query.sortDirection === "asc" ? "desc" : "asc",
      page: 1,
    });

  const total = data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / query.pageSize));

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Produtos</h1>
        <span className="text-sm text-ink-muted">
          {total.toLocaleString("pt-BR")} {total === 1 ? "produto" : "produtos"}
        </span>
      </div>

      <ProductFilters query={query} onChange={patch} />

      {error && (
        <p className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error instanceof Error ? error.message : "Não foi possível carregar os produtos."}
        </p>
      )}

      {isPending ? (
        <p className="px-4 py-10 text-center text-sm text-ink-muted">Carregando produtos…</p>
      ) : (
        <ProductTable items={data?.items ?? []} query={query} onSort={sortBy} />
      )}

      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-muted">
          Página {query.page} de {lastPage}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => patch({ page: query.page - 1 })}
            disabled={query.page <= 1}
            className="rounded-lg border border-base-border px-3 py-1.5 hover:bg-base-raised disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            onClick={() => patch({ page: query.page + 1 })}
            disabled={query.page >= lastPage}
            className="rounded-lg border border-base-border px-3 py-1.5 hover:bg-base-raised disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Passo 6: Commit**

```bash
git add src/modules/products/ui src/shared/ui/format.ts
git commit -m "feat(products): tela de listagem com busca, filtros e paginação"
```

---

## Task 8: Módulo Dashboard

**Arquivos:**
- Criar: `src/modules/dashboard/domain/dashboard-summary.ts`
- Criar: `src/modules/dashboard/application/dashboard-repository.ts`
- Criar: `src/modules/dashboard/infrastructure/supabase-dashboard-repository.ts`
- Criar: `src/modules/dashboard/infrastructure/postgres-dashboard-repository.ts`
- Criar: `src/modules/dashboard/ui/DashboardPage.tsx`
- Modificar: `src/composition/container.ts`

**Consome:** `Tenant` (Task 3), `ElectronApi` (Task 4), `useContainer` (Task 6).

**Produz:** `DashboardSummary`, `DashboardRepository`, `DashboardPage`.

O dashboard tem repositório próprio e conta linhas diretamente. Não depende dos
módulos de Comandas e Transações, que não existem nesta fatia.

- [ ] **Passo 1: Escrever o domínio**

`src/modules/dashboard/domain/dashboard-summary.ts`:

```ts
/**
 * Indicadores da tela inicial.
 *
 * Apenas o que pode ser medido nas duas fontes. Erros recentes, última
 * sincronização e batimentos dos serviços ficam de fora: as tabelas
 * `sync_log` e `sync_heartbeat` existem só no PostgreSQL local, e no projeto
 * antigo esses valores eram constantes escritas no código quando se rodava
 * pelo navegador. Entram junto com o módulo de Sincronização.
 */
export interface DashboardSummary {
  activeProducts: number;
  openOrders: number;
  todayTransactions: number;
}
```

- [ ] **Passo 2: Escrever a porta**

`src/modules/dashboard/application/dashboard-repository.ts`:

```ts
import type { DashboardSummary } from "../domain/dashboard-summary";

export interface DashboardRepository {
  summary(): Promise<DashboardSummary>;
}
```

- [ ] **Passo 3: Escrever o repositório Supabase**

`src/modules/dashboard/infrastructure/supabase-dashboard-repository.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardRepository } from "../application/dashboard-repository";
import type { DashboardSummary } from "../domain/dashboard-summary";
import type { Tenant } from "@/shared/tenant/tenant";

function startOfToday(): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

export class SupabaseDashboardRepository implements DashboardRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly tenant: Tenant,
  ) {}

  async summary(): Promise<DashboardSummary> {
    const { storeId } = this.tenant;

    const [products, orders, transactions] = await Promise.all([
      this.client
        .from("pv_products")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId)
        .eq("is_active", true),
      this.client
        .from("vw_command_orders")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId)
        .eq("status", "open"),
      this.client
        .from("vw_command_transactions")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId)
        .gte("created_at", startOfToday()),
    ]);

    const failure = products.error ?? orders.error ?? transactions.error;
    if (failure) throw new Error(`Falha ao carregar indicadores: ${failure.message}`);

    return {
      activeProducts: products.count ?? 0,
      openOrders: orders.count ?? 0,
      todayTransactions: transactions.count ?? 0,
    };
  }
}
```

- [ ] **Passo 4: Escrever o repositório PostgreSQL**

`src/modules/dashboard/infrastructure/postgres-dashboard-repository.ts`:

```ts
import type { DashboardRepository } from "../application/dashboard-repository";
import type { DashboardSummary } from "../domain/dashboard-summary";
import type { ElectronApi } from "@/shared/runtime/electron-api";

interface CountRow {
  active_products: string | number;
  open_orders: string | number;
  today_transactions: string | number;
}

function toNumber(value: string | number | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export class PostgresDashboardRepository implements DashboardRepository {
  constructor(private readonly api: ElectronApi) {}

  async summary(): Promise<DashboardSummary> {
    // Uma consulta só: três subconsultas de contagem numa ida ao banco.
    const result = await this.api.query<CountRow>(`
      SELECT
        (SELECT COUNT(*) FROM products WHERE is_active = true) AS active_products,
        (SELECT COUNT(*) FROM orders WHERE status = 'open') AS open_orders,
        (SELECT COUNT(*) FROM transactions WHERE created_at >= CURRENT_DATE) AS today_transactions
    `);

    if (!result.ok) throw new Error(`Falha ao carregar indicadores: ${result.error}`);

    const row = result.rows[0];
    return {
      activeProducts: toNumber(row?.active_products),
      openOrders: toNumber(row?.open_orders),
      todayTransactions: toNumber(row?.today_transactions),
    };
  }
}
```

- [ ] **Passo 5: Registrar o dashboard no container**

Em `src/composition/container.ts`, adicione os imports:

```ts
import type { DashboardRepository } from "@/modules/dashboard/application/dashboard-repository";
import { SupabaseDashboardRepository } from "@/modules/dashboard/infrastructure/supabase-dashboard-repository";
import { PostgresDashboardRepository } from "@/modules/dashboard/infrastructure/postgres-dashboard-repository";
```

Estenda a interface:

```ts
export interface Container {
  products: ProductRepository;
  dashboard: DashboardRepository;
}
```

E os dois retornos de `createContainer`:

```ts
    return {
      products: new PostgresProductRepository(api),
      dashboard: new PostgresDashboardRepository(api),
    };
```

```ts
  return {
    products: new SupabaseProductRepository(supabase, tenant),
    dashboard: new SupabaseDashboardRepository(supabase, tenant),
  };
```

- [ ] **Passo 6: Escrever a página**

`src/modules/dashboard/ui/DashboardPage.tsx`:

```tsx
import { useQuery } from "@tanstack/react-query";
import { useContainer } from "@/shared/container/container-context";
import type { DashboardSummary } from "../domain/dashboard-summary";

function Card({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-xl border border-base-border bg-base-raised p-5">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold">
        {value === null ? "—" : value.toLocaleString("pt-BR")}
      </p>
    </div>
  );
}

export function DashboardPage() {
  const { dashboard } = useContainer();
  const { data, isPending, error } = useQuery<DashboardSummary>({
    queryKey: ["dashboard-summary"],
    queryFn: () => dashboard.summary(),
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {error && (
        <p className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error instanceof Error ? error.message : "Não foi possível carregar os indicadores."}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card label="Produtos ativos" value={isPending ? null : (data?.activeProducts ?? null)} />
        <Card label="Comandas abertas" value={isPending ? null : (data?.openOrders ?? null)} />
        <Card label="Transações hoje" value={isPending ? null : (data?.todayTransactions ?? null)} />
      </div>
    </div>
  );
}
```

- [ ] **Passo 7: Verificar a compilação completa**

```bash
npm run typecheck
npm run build
```

Esperado: ambos terminam sem erro. Este é o passo 8 pendente da Task 6.

- [ ] **Passo 8: Commit**

```bash
git add src/modules/dashboard src/composition/container.ts
git commit -m "feat(dashboard): indicadores com repositório próprio nas duas fontes"
```

---

## Task 9: Verificação e documentação final

**Arquivos:**
- Criar: `README.md`
- Criar: `.env` (local, não versionado)

- [ ] **Passo 1: Criar o `.env` local**

Copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` e
`VITE_SUPABASE_PUBLISHABLE_KEY` com os valores do projeto Supabase. Preencha as
variáveis `PG_*` apenas se for testar o modo local.

- [ ] **Passo 2: Verificar o modo navegador**

```bash
npm run dev
```

Abra `http://127.0.0.2:8080`, autentique e confirme:

- a tela de login aparece e aceita as credenciais
- o cabeçalho mostra "Nuvem · Supabase"
- o dashboard traz os três indicadores com números
- a tela de Produtos lista os produtos da loja, com o total no canto superior direito
- a busca por nome e por código de barras filtra
- os filtros de status, estoque e preço funcionam
- a ordenação alterna ao clicar no cabeçalho da coluna
- a paginação avança e volta
- o console do navegador não acusa nenhum erro

- [ ] **Passo 3: Confirmar que nenhum segredo foi ao pacote**

```bash
npm run build
grep -r "PG_PASSWORD\|service_role" dist/ ; echo "saída vazia acima = correto"
```

- [ ] **Passo 4: Escrever o `README.md`**

````markdown
# EasyCommand Refatorado

Painel administrativo de loja. Roda no navegador (dados do Supabase) e como
programa instalado (dados do PostgreSQL local).

## Rodar

```bash
cp .env.example .env   # preencher as credenciais
npm install
npm run dev            # abrir http://127.0.0.2:8080
```

```bash
npm run electron:dev   # janela do programa, com o servidor de desenvolvimento
npm run package:win    # gerar o executável portátil
```

## Arquitetura

Organização por funcionalidade. Cada módulo em `src/modules/<nome>/`:

| Camada | Responsabilidade | Pode importar |
|---|---|---|
| `domain` | entidades e regras | nada |
| `application` | casos de uso e portas | `domain` |
| `infrastructure` | implementações (Supabase, PostgreSQL) | `domain`, `application` |
| `ui` | React | `domain`, `application` |

**As dependências apontam para dentro.** Nenhum arquivo de `domain` ou
`application` menciona React, Supabase, `pg` ou `window.electronAPI`.

A fonte de dados é escolhida uma única vez, em `src/composition/container.ts`.
Nenhuma regra de negócio pergunta onde está rodando.

## Estado

Fatia vertical: Produtos e Dashboard. Sem testes automatizados — próximo passo
é o contrato compartilhado que garante que os dois repositórios devolvem o mesmo
`Product`. Ver `docs/specs/` e `docs/plans/`.
````

- [ ] **Passo 5: Commit**

```bash
git add README.md
git commit -m "docs: README com instruções de execução e regra da arquitetura"
```

---

## Verificação do plano contra a spec

| Requisito da spec | Tarefa |
|---|---|
| Stack React + TS + Vite | Task 1 |
| Feature-first, dependências para dentro | Tasks 2, 7, 8 e README |
| Domínio fora do arquivo de dados falsos | Task 2 |
| Duas fontes (PostgreSQL e Supabase) | Tasks 3 e 4 |
| Divergência isolada na infraestrutura | Tasks 3 e 4 (mapeadores) |
| Escolha única na composição | Task 5 |
| Detecção de ambiente explícita | Task 5 |
| Multi-tenant obrigatório, falha explícita | Tasks 3, 5 e 6 |
| `contextIsolation` e `nodeIntegration` | Task 4 |
| Superfície mínima do preload | Task 4 |
| Segredos fora do pacote do navegador | Tasks 4 e 9 |
| Produtos: lista, busca, filtros, paginação | Task 7 |
| Dashboard com três indicadores | Task 8 |
| Sem Edge Functions | nenhuma tarefa cria |
| Sem testes automatizados | nenhuma tarefa cria |
| Verificação manual observável | Task 9 |
