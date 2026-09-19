import { useState } from "react";
import { BookOpen, ChevronDown, TriangleAlert } from "lucide-react";
import { PageHeader, Panel } from "@/shared/ui/primitives";

/**
 * Manual.
 *
 * Conteúdo fixo, sem repositório: não há dado a buscar, e inventar uma camada
 * de dados para texto estático seria estrutura sem propósito.
 *
 * Duas partes, porque são dois leitores: quem **usa** o painel e quem
 * **instala** os serviços da loja. Misturá-las obrigaria cada um a atravessar
 * o que não lhe diz respeito.
 */
interface Secao {
  titulo: string;
  itens: (string | Bloco)[];
}

interface Bloco {
  tipo: "codigo" | "aviso";
  texto: string;
}

function ehBloco(item: string | Bloco): item is Bloco {
  return typeof item !== "string";
}

const USO: Secao[] = [
  {
    titulo: "O que este painel é",
    itens: [
      "Um painel web: ele lê a nuvem, que recebe os dados da loja pela sincronização.",
      "Não é o sistema de venda. O PDV e os totens funcionam na loja, mesmo sem internet.",
      "O que aparece aqui é o que já chegou da loja — a fila da nuvem mostra o que ainda está a caminho.",
    ],
  },
  {
    titulo: "Quando um número não bate",
    itens: [
      "Confira a fila da nuvem: item preso é dado que existe na loja e ainda não chegou aqui.",
      "A fila também traduz o erro do banco, quando um item falhou ao ser aplicado.",
      "O painel não inventa número. Quando algo não pode ser medido daqui, ele diz isso em vez de mostrar zero.",
    ],
  },
  {
    titulo: "NFC-e que precisa de atenção",
    itens: [
      "Rejeitada, denegada ou em revisão manual são vendas sem documento fiscal válido.",
      "O Dashboard separa as três situações e leva à lista filtrada.",
      "Abrir a nota mostra itens, pagamentos, o histórico da SEFAZ e os XML para baixar.",
      "A correção de uma nota rejeitada é feita pelo serviço fiscal da loja — este painel mostra a situação, mas não reenvia à SEFAZ.",
    ],
  },
  {
    titulo: "Antes de abrir a loja",
    itens: [
      "Certificado digital válido — vencido, a loja não emite nota.",
      "Totens ativos e em produção — em demonstração eles não cobram de verdade.",
      "Meios de pagamento habilitados em cada totem.",
      "Licença vinculada a cada totem: o banco recusa totem ativo sem licença.",
    ],
  },
  {
    titulo: "Segredos e credenciais",
    itens: [
      "Tokens e chaves nunca aparecem nas telas: só a informação de que estão configurados.",
      "Isso vale para o emitente, os totens e o PIXnoPDV.",
      "Na auditoria, alterações em campos sensíveis aparecem com o valor oculto.",
      "Para trocar um segredo, digite o novo; deixar em branco mantém o que está gravado.",
    ],
  },
];

const INSTALACAO: Secao[] = [
  {
    titulo: "Como as peças se encaixam",
    itens: [
      "Totens — terminais de autoatendimento onde o cliente pede e paga.",
      "Servidor da loja (Windows) — roda o serviço de sincronização, o PostgreSQL e o servidor de imagens.",
      "PostgreSQL — o banco da operação: produtos, comandas e transações.",
      "Firebird — o banco do ERP legado, sincronizado nos dois sentidos.",
      "Sync-Service — o serviço Node.js que mantém Firebird e PostgreSQL em dia, e publica para a nuvem.",
      "O caminho do dado: totem → PostgreSQL → Sync-Service → Firebird, e do PostgreSQL para a nuvem.",
    ],
  },
  {
    titulo: "Requisitos",
    itens: [
      "Servidor: Windows 10/11 ou Server 2016+, 4 GB de memória (8 GB recomendado).",
      "Servidor: Node.js 20 ou superior, PostgreSQL 14+, Firebird 3.0+.",
      "Servidor: portas 3001 (imagens) e 5432 (PostgreSQL) liberadas.",
      "Totem: Windows 10/11, tela sensível ao toque de 15 polegadas ou mais, mínimo de 1024x768.",
      "Totem: rede local com acesso ao servidor.",
    ],
  },
  {
    titulo: "PostgreSQL",
    itens: [
      "Baixe o instalador em postgresql.org e defina a senha do superusuário.",
      "Crie o banco `easycommandpay`.",
      "Em `postgresql.conf`, use `listen_addresses = '*'` e `port = 5432`.",
      "Em `pg_hba.conf`, libere a rede da loja com `scram-sha-256`.",
      { tipo: "codigo", texto: "host all all 192.168.0.0/24 scram-sha-256" },
      "Libere a porta 5432 no firewall do Windows.",
    ],
  },
  {
    titulo: "Sync-Service",
    itens: [
      "Copie a pasta `sync-service` para `C:\\EasyCommandPay\\sync-service`.",
      "Configure o `.env` com os caminhos dos bancos Firebird e PostgreSQL.",
      "No `firebird.conf`, use `AuthServer = Srp, Srp256` e `WireCrypt = Enabled`.",
      "Instale as dependências, teste a conexão e registre como serviço do Windows.",
      {
        tipo: "aviso",
        texto:
          "Senha com caractere especial (#, @) precisa de aspas duplas no .env — sem elas, o serviço lê a senha pela metade e a conexão falha sem dizer por quê.",
      },
    ],
  },
  {
    titulo: "Rede e firewall",
    itens: [
      "Todos os equipamentos na mesma rede local, com IP fixo no servidor.",
      "Perfil de rede do Windows como Privado.",
      "Regras de entrada liberando TCP nas portas 3001 e 5432.",
      {
        tipo: "codigo",
        texto: [
          'New-NetFirewallRule -DisplayName "EasyCommandPay - Images" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow',
          'New-NetFirewallRule -DisplayName "EasyCommandPay - PostgreSQL" -Direction Inbound -Protocol TCP -LocalPort 5432 -Action Allow',
        ].join("\n"),
      },
    ],
  },
  {
    titulo: "Serviço TEF (Aditum)",
    itens: [
      "O serviço escuta na porta definida em `HTTP_PORT` (padrão 3090) e conversa com o runtime da Aditum.",
      "Com `HTTP_API_KEY` definida, toda requisição precisa do cabeçalho `X-Api-Key`.",
      "A URL base e a chave são configuradas por totem, na tela de Totens.",
      "Rotas úteis: `/health` para saúde do serviço e `/v1/tef/diagnostics` para rede, TLS e token.",
    ],
  },
  {
    titulo: "Domínio próprio",
    itens: [
      "Cadastre um registro A apontando o subdomínio para o IP da hospedagem.",
      "Cadastre o registro TXT de verificação exigido pela plataforma.",
      "O certificado HTTPS é emitido sozinho depois que a verificação passa.",
      "A propagação pode levar até 72 horas; confira em dnschecker.org.",
      {
        tipo: "aviso",
        texto:
          "Não remova o registro TXT depois de verificado — ele é revalidado de tempos em tempos, e sem ele o domínio deixa de responder.",
      },
    ],
  },
];

function Item({ item }: { item: string | Bloco }) {
  if (!ehBloco(item)) {
    return (
      <li className="flex gap-2 text-sm">
        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
        <span>{item}</span>
      </li>
    );
  }

  if (item.tipo === "aviso") {
    return (
      <li className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
        <TriangleAlert size={15} className="mt-0.5 shrink-0" />
        <span>{item.texto}</span>
      </li>
    );
  }

  return (
    <li>
      <pre className="overflow-x-auto rounded-lg bg-background px-3 py-2 font-mono text-xs">
        {item.texto}
      </pre>
    </li>
  );
}

function Cartao({ secao }: { secao: Secao }) {
  return (
    <Panel className="p-5">
      <h2 className="mb-3 flex items-center gap-2 font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <BookOpen size={15} /> {secao.titulo}
      </h2>
      <ul className="space-y-2">
        {secao.itens.map((item, indice) => (
          <Item key={ehBloco(item) ? `bloco-${indice}` : item} item={item} />
        ))}
      </ul>
    </Panel>
  );
}

export function ManualPage() {
  // A instalação começa recolhida: quem usa o painel no dia a dia não precisa
  // atravessar sete seções de servidor para chegar ao que lhe serve.
  const [mostrarInstalacao, setMostrarInstalacao] = useState(false);

  return (
    <div className="space-y-5">
      <PageHeader title="Manual" />

      <div className="grid gap-4 lg:grid-cols-2">
        {USO.map((secao) => (
          <Cartao key={secao.titulo} secao={secao} />
        ))}
      </div>

      <button
        onClick={() => setMostrarInstalacao((atual) => !atual)}
        className="flex w-full items-center gap-2 rounded-lg border border-border px-4 py-3 text-left text-sm transition-colors hover:bg-secondary"
      >
        <ChevronDown
          size={16}
          className={`shrink-0 transition-transform ${mostrarInstalacao ? "" : "-rotate-90"}`}
        />
        <span>
          <span className="font-medium">Instalação dos serviços da loja</span>
          <span className="block text-xs text-muted-foreground">
            PostgreSQL, Sync-Service, rede, TEF e domínio — para quem monta o ambiente
          </span>
        </span>
      </button>

      {mostrarInstalacao && (
        <div className="grid gap-4 lg:grid-cols-2">
          {INSTALACAO.map((secao) => (
            <Cartao key={secao.titulo} secao={secao} />
          ))}
        </div>
      )}
    </div>
  );
}
