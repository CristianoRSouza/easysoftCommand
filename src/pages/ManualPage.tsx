import { BookOpen } from "lucide-react";
import { PageHeader, Panel } from "@/shared/ui/primitives";

/**
 * Manual de uso.
 *
 * Conteúdo fixo, sem repositório: não há dado a buscar, e inventar uma camada
 * de dados para texto estático seria estrutura sem propósito.
 */
const SECOES = [
  {
    titulo: "Os dois modos de uso",
    itens: [
      "Na loja, o programa instalado lê o PostgreSQL do próprio computador e funciona sem internet.",
      "De fora, o navegador lê o Supabase e mostra os dados que a loja já sincronizou.",
      "O canto superior direito sempre diz qual dos dois está em uso.",
    ],
  },
  {
    titulo: "Quando um número não bate",
    itens: [
      "Confira a fila da nuvem: item preso significa dado que existe na loja e ainda não chegou aqui.",
      "Confira a sincronização (só no programa da loja): serviço parado interrompe a atualização.",
      "O painel nunca inventa número. Quando algo não pode ser medido, ele diz isso em vez de mostrar zero.",
    ],
  },
  {
    titulo: "NFC-e que precisa de atenção",
    itens: [
      "Rejeitada, denegada ou em revisão manual são vendas sem documento fiscal válido.",
      "A tela de NFC-e destaca essas linhas e mostra o código de retorno da SEFAZ.",
      "Abrir a nota mostra os itens, os pagamentos e o histórico do que a SEFAZ respondeu.",
    ],
  },
  {
    titulo: "Antes de abrir a loja",
    itens: [
      "Certificado digital válido — vencido, a loja não emite nota.",
      "Totens ativos e em produção — em demonstração eles não cobram de verdade.",
      "Meios de pagamento habilitados em cada totem.",
    ],
  },
  {
    titulo: "Segredos e credenciais",
    itens: [
      "Tokens e chaves nunca aparecem nas telas: só a informação de que estão configurados.",
      "Isso vale para o emitente, os totens e o PIXnoPDV.",
      "Na auditoria, alterações em campos sensíveis aparecem com o valor oculto.",
    ],
  },
];

export function ManualPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Manual" />
      <div className="grid gap-4 lg:grid-cols-2">
        {SECOES.map((secao) => (
          <Panel key={secao.titulo} className="p-5">
            <h2 className="mb-3 flex items-center gap-2 font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <BookOpen size={15} /> {secao.titulo}
            </h2>
            <ul className="space-y-2">
              {secao.itens.map((item) => (
                <li key={item} className="flex gap-2 text-sm">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
    </div>
  );
}
