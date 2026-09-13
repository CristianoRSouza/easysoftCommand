# EasyCommand Refatorado

Painel administrativo de loja. Roda no navegador, com dados do Supabase, e como
programa instalado, com dados do PostgreSQL local. Mesmo código, duas entregas.

## Rodar

```bash
cp .env.example .env   # preencher as credenciais
npm install
npm run dev            # abrir http://localhost:8080
```

```bash
npm run electron:dev   # janela do programa (exige o npm run dev rodando)
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

A fonte de dados é escolhida **uma única vez**, em
[`src/composition/container.ts`](src/composition/container.ts). Nenhuma regra de
negócio pergunta onde está rodando. O projeto anterior fazia essa pergunta 101
vezes, num arquivo de 5.197 linhas.

### Como a fonte é decidida

[`src/shared/runtime/environment.ts`](src/shared/runtime/environment.ts), inteiro:

```
se window.electronAPI existe  →  PostgreSQL local
senão                         →  Supabase
```

Sem heurística de nome de host e sem precedência implícita. No projeto anterior
essa decisão passava por três funções encadeadas, e em `localhost` o resolvedor
de endereço devolvia a origem da própria página: a aplicação concluía que havia
encontrado uma API local e nunca alcançava o Supabase.

### As duas fontes divergem

|  | PostgreSQL local | Supabase |
|---|---|---|
| Tabela | `products` | `pv_products` |
| Unidade de medida | `LEFT JOIN units` | coluna já resolvida |
| Filtro de loja | nenhum | `store_id` obrigatório |

A diferença termina na camada `infrastructure`: cada repositório tem um mapeador
que converte o formato da sua fonte na entidade do domínio. Quem chama recebe o
mesmo `Product`.

### Multi-tenant

No Supabase, o `storeId` é injetado no construtor do repositório — não passado
por parâmetro. Consultar sem filtro de loja é impossível por construção, e não
por disciplina de quem escreve a chamada.

A loja em uso aparece sempre no cabeçalho. Esta fatia ainda não tem seletor de
loja: [`SupabaseTenantResolver`](src/shared/tenant/supabase-tenant-resolver.ts)
escolhe a marcada como padrão em `pb_user_store_access`, ou a primeira por
código.

## Estado

Fatia vertical concluída: **Produtos** e **Dashboard**, nos dois modos.

Sem testes automatizados — decisão consciente para esta etapa. O próximo passo é
o contrato compartilhado que garante que os dois repositórios devolvem o mesmo
`Product`, que é o risco real desta arquitetura.

Ver [`docs/specs/`](docs/specs/) e [`docs/plans/`](docs/plans/).

## Verificado

- Navegador: login, dashboard e listagem de produtos com dados reais
- Busca por nome e código de barras, filtros de status/estoque/preço,
  ordenação por coluna e paginação
- Dashboard e o filtro "Ativos" da listagem chegam ao mesmo número por
  repositórios diferentes
- Console sem erros; nenhum segredo de servidor no pacote gerado

O caminho do PostgreSQL local depende de um banco com dados e ainda não foi
exercitado.
