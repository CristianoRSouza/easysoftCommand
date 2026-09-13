# EasyCommand Refatorado — Design da Arquitetura

**Data:** 2026-09-13
**Origem:** migração do `EasyFoodManager-Web` (pasta `easycommandpay`)
**Status:** aprovado para implementação da primeira fatia

---

## 1. Objetivo

Reconstruir o painel administrativo com arquitetura limpa, eliminando os *code smells*
estruturais do projeto atual. A entrega desta etapa é uma **fatia vertical completa**:
a fundação da arquitetura mais o módulo de Produtos ponta a ponta, num aplicativo que
abre e funciona.

Não é uma reescrita de tudo. É a prova de que a arquitetura sustenta os outros 21
módulos antes de replicá-la 21 vezes.

## 2. O que está sendo corrigido

O projeto atual funciona, mas concentra quatro problemas estruturais:

| Problema | Onde | Efeito |
|---|---|---|
| God object | `data-service.ts`, 5197 linhas | 77 operações e 101 `if (isElectron())` num arquivo |
| Camada duplicada | `cloud-data.ts`, 3161 linhas | a lógica de nuvem repete a estrutura da local |
| Domínio no lugar errado | `interface Product` dentro de `mock-data.ts` | a entidade de negócio mora no arquivo de dados falsos |
| Detecção implícita de ambiente | `cloud-mode.ts` + `admin-api-client.ts` | em `localhost` o app se autoconvence de ter uma API e nunca chega ao Supabase |

A causa raiz é uma só: **a decisão de onde buscar dados está espalhada por todo o código**,
em vez de ser tomada uma única vez.

## 3. Decisões tomadas

| Decisão | Escolha | Motivo |
|---|---|---|
| Stack | React 18 + TypeScript + Vite | Next.js foi descartado: Server Components e rotas de API exigem servidor Node, incompatível com o empacotamento Electron |
| Entrega | `.exe` (Electron) **e** navegador | a loja opera offline no PG local; o acesso remoto usa Supabase |
| Fontes de dados | PostgreSQL local e Supabase | a Admin API (porta 4080) e o modo mock ficam de fora |
| Organização | por funcionalidade (*feature-first*) | com 22 módulos, organizar por camada transforma cada pasta num depósito |
| Testes | adiados | decisão explícita do dono do projeto; a arquitetura nasce pronta para recebê-los |

## 4. Estrutura

```
EASYCOMMAND REFATORADO/
├─ electron/                    processo main e preload
├─ src/
│  ├─ modules/
│  │  └─ products/
│  │     ├─ domain/             Product e regras puras
│  │     ├─ application/        casos de uso
│  │     ├─ infrastructure/     PostgresProductRepository · SupabaseProductRepository
│  │     └─ ui/                 ProductsPage e componentes do módulo
│  ├─ shared/
│  │  ├─ auth/                  sessão e login
│  │  ├─ tenant/                empresa e loja selecionadas
│  │  ├─ runtime/               detecção de ambiente (um arquivo, explícito)
│  │  └─ ui/                    componentes base e layout
│  └─ composition/              onde as implementações são escolhidas
└─ docs/specs/
```

### Regra que define a arquitetura

**As dependências apontam para dentro.** `domain` não importa nada. `application`
importa `domain`. `infrastructure` implementa as interfaces de `application`. `ui`
consome `application`.

Consequência prática: nenhum arquivo de `domain` ou `application` menciona React,
Supabase, `pg` ou `window.electronAPI`.

## 5. O fluxo de Produtos

```
ProductsPage (React)
      │ chama
      ▼
ListProductsUseCase              não sabe qual é a fonte
      │ depende da interface
      ▼
ProductRepository (porta)
      │ implementada por
      ├─ PostgresProductRepository    SELECT ... FROM products LEFT JOIN units
      └─ SupabaseProductRepository    from("pv_products").eq("store_id", …)
```

A escolha da implementação acontece **uma vez**, em `composition/`, durante a
inicialização. Nenhuma regra de negócio pergunta onde está rodando.

### As duas fontes divergem de verdade

| | PostgreSQL local | Supabase |
|---|---|---|
| Tabela | `products` | `pv_products` |
| Unidade | `LEFT JOIN units` no SQL | coluna já resolvida |
| Filtro de loja | nenhum | `.eq("store_id", …)` obrigatório |

Essa divergência é responsabilidade exclusiva da camada `infrastructure`. Cada
repositório tem um mapeador isolado que converte o formato da sua fonte no `Product`
do domínio. O resto do sistema nunca vê a diferença.

## 6. Detecção de ambiente

O projeto atual decide o modo através de três funções que se chamam em cadeia, e o
resultado surpreende: em `localhost`, `getAdminApiBaseUrl()` devolve a origem da própria
página, o app conclui que achou uma API e nunca alcança o Supabase.

No projeto novo isso vira **uma função, num arquivo, com regra explícita**:

```
se window.electronAPI existe  → PostgreSQL local
senão                         → Supabase
```

Sem heurística de hostname, sem cache em `sessionStorage`, sem precedência implícita.
A armadilha do `localhost` deixa de existir porque a regra que a causava deixa de existir.

## 7. Multi-tenant

No Supabase, toda leitura é filtrada por `store_id`. A loja selecionada vive em
`shared/tenant` e é injetada no repositório Supabase na composição — o caso de uso não
a recebe nem a conhece.

**Invariante:** o repositório Supabase falha explicitamente quando não há loja
selecionada. Nunca devolve dados de outra loja, nunca cai em dados falsos para
disfarçar a ausência.

## 8. Segurança — herdado do projeto atual

| Invariante | Como se mantém |
|---|---|
| Electron tem prioridade absoluta | é a primeira condição da detecção de ambiente |
| `contextIsolation: true`, `nodeIntegration: false` | mantidos; o renderer só acessa Node pelo preload |
| Superfície mínima do `contextBridge` | só o necessário para a fatia de Produtos |
| Segredos de servidor fora do frontend | apenas variáveis `VITE_*` chegam ao bundle |

## 9. Escopo desta fatia

**Incluído:** fundação da arquitetura, login, layout com navegação lateral, módulo de
Produtos completo (listagem, paginação, busca por nome e código de barras, filtros de
status/estoque/preço), e as duas implementações de repositório.

**Dashboard:** três indicadores — produtos ativos, comandas abertas e transações de hoje.
São três contagens simples (`COUNT`), não exigem os módulos de Comandas e Transações.
O dashboard tem repositório próprio e lê os contadores diretamente, que é o padrão
correto para uma tela de leitura: ela não depende dos módulos que produzem os dados.

**Fora do dashboard nesta fatia:** erros recentes, última sincronização e batimentos dos
serviços. O motivo não é custo — é honestidade. No projeto atual, esses valores são
constantes escritas no código quando se roda pelo navegador, porque `sync_log` e
`sync_heartbeat` existem apenas no PostgreSQL local:

```js
recentErrors: 0,
lastSuccessSync: null,
serviceHeartbeats: { sync: null, nfce: null, tef: null, … },
```

Quem abre o painel pelo navegador vê esses indicadores como medição, e são constantes.
Eles entram junto com o módulo de Sincronização — funcionando nos dois modos, ou
declarando explicitamente que a informação não existe na nuvem.

**Identidade visual:** mantida a do projeto atual (tema escuro "Navy Trust"). Os
componentes base são regerados pelo CLI do shadcn/ui conforme necessários, nunca copiados
do projeto antigo — no projeto atual eles são arquivos gerados, marcados como "nunca
editar à mão". Serão instalados apenas os componentes que esta fatia usa.

**Fora:** os outros 21 módulos, testes automatizados, Admin API, modo mock, Edge Functions.

**Edge Functions:** nenhuma. Produtos é leitura direta de dados. Funções serverless só
se justificam quando há segredo de servidor envolvido, o que não é o caso aqui.

## 10. Como isto será verificado

Sem testes automatizados nesta etapa, a verificação é manual e observável:

1. `npm run dev`, abrir no navegador, autenticar no Supabase e conferir a listagem de
   produtos da loja selecionada
2. `npm run build` sem erro de TypeScript
3. Conferir no bundle gerado que nenhum segredo de servidor aparece

O caminho Electron depende de um PostgreSQL local com dados e será verificado quando
esse ambiente estiver disponível.

## 11. Próximos passos

1. Implementar esta fatia
2. Adicionar a suíte de testes (Vitest), começando pelo contrato compartilhado que
   garante que os dois repositórios devolvem o mesmo `Product`
3. Replicar o padrão para os demais módulos, um a um
