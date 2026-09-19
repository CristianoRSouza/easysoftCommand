import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { METHOD_LABEL, REVENUE_METHODS, type RevenueReport } from "../domain/revenue";
import {
  AXIS,
  COMPARISON_SERIES,
  GRID,
  METHOD_COLOR,
  SINGLE_SERIES,
  SURFACE,
  shortCurrency,
  TOOLTIP_STYLE,
} from "./charts";
import { formatCurrency, formatQuantity } from "@/shared/ui/format";
import { Empty, Panel } from "@/shared/ui/primitives";

const ALTURA = 260;

function Bloco({
  title,
  hint,
  aviso,
  vazio,
  children,
}: {
  title: string;
  hint?: string;
  aviso?: string | null;
  vazio: boolean;
  children: React.ReactNode;
}) {
  return (
    <Panel className="p-5">
      <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      {aviso && <p className="mt-1 text-xs text-warning">{aviso}</p>}
      <div className="mt-4">
        {vazio ? (
          <Empty label="Sem dados neste intervalo." />
        ) : (
          <ResponsiveContainer width="100%" height={ALTURA}>
            {children as React.ReactElement}
          </ResponsiveContainer>
        )}
      </div>
    </Panel>
  );
}

const moeda = (valor: number) => formatCurrency(valor);

/**
 * As três séries empilhadas, com 2px de fundo separando as fatias.
 *
 * Devolve uma lista, e não um componente: o recharts lê os próprios filhos
 * para descobrir as séries, e não atravessa fragmentos nem componentes
 * próprios. Embrulhar as barras fazia o gráfico desenhar os eixos e nenhuma
 * barra — sem erro nenhum no console.
 */
function methodBars(stackId: string) {
  return REVENUE_METHODS.map((method) => (
    <Bar
      key={method}
      dataKey={method}
      name={METHOD_LABEL[method]}
      stackId={stackId}
      fill={METHOD_COLOR[method]}
      stroke={SURFACE}
      strokeWidth={2}
    />
  ));
}

/** A legenda mostra o nome do meio de pagamento, não a chave da coluna. */
const legendaDeMetodo = (value: string) =>
  METHOD_LABEL[value as keyof typeof METHOD_LABEL] ?? value;

export default function RevenueCharts({ report }: { report: RevenueReport }) {
  const fatias = report.byMethod.filter((entry) => entry.amount > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Bloco title="Receita por dia" vazio={report.byDay.length === 0}>
        <BarChart data={report.byDay}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={shortCurrency} />
          <Tooltip {...TOOLTIP_STYLE} formatter={moeda} cursor={{ fill: "hsl(var(--muted)/0.4)" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {methodBars("dia")}
        </BarChart>
      </Bloco>

      <Bloco
        title="Distribuição por forma de pagamento"
        hint="Valores aprovados no período"
        vazio={fatias.length === 0}
      >
        <PieChart>
          <Tooltip {...TOOLTIP_STYLE} formatter={moeda} />
          <Legend wrapperStyle={{ fontSize: 12 }} formatter={legendaDeMetodo} />
          <Pie
            data={fatias}
            dataKey="amount"
            nameKey="method"
            innerRadius={60}
            outerRadius={95}
            paddingAngle={2}
            stroke={SURFACE}
            strokeWidth={2}
            // Rótulo direto na fatia: a identidade não fica só na cor.
            label={({ name, percent }: { name: string; percent: number }) =>
              `${METHOD_LABEL[name as keyof typeof METHOD_LABEL]} ${(percent * 100).toFixed(0)}%`
            }
            labelLine={false}
          >
            {fatias.map((entry) => (
              <Cell key={entry.method} fill={METHOD_COLOR[entry.method]} />
            ))}
          </Pie>
        </PieChart>
      </Bloco>

      <Bloco
        title="Receita acumulada"
        hint="Soma progressiva no período"
        vazio={report.byDay.length === 0}
      >
        <LineChart data={report.byDay}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={shortCurrency} />
          <Tooltip {...TOOLTIP_STYLE} formatter={moeda} />
          <Line
            type="monotone"
            dataKey="cumulative"
            name="Acumulado"
            stroke={SINGLE_SERIES}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </Bloco>

      <Bloco
        title="Receita por hora do dia"
        hint="Todas as 24 horas, inclusive as sem venda"
        vazio={report.total.count === 0}
      >
        <BarChart data={report.byHour}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" interval={2} tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={shortCurrency} />
          <Tooltip {...TOOLTIP_STYLE} formatter={moeda} cursor={{ fill: "hsl(var(--muted)/0.4)" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {methodBars("hora")}
        </BarChart>
      </Bloco>

      <Bloco
        title="Comparativo mensal"
        hint="Os mesmos meses no ano anterior"
        vazio={report.byMonth.length === 0}
      >
        <LineChart data={report.byMonth}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={shortCurrency} />
          <Tooltip {...TOOLTIP_STYLE} formatter={moeda} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="current"
            name="Ano atual"
            stroke={SINGLE_SERIES}
            strokeWidth={2}
            dot={false}
          />
          {/* Tracejado além da cor: a comparação continua legível impressa. */}
          <Line
            type="monotone"
            dataKey="previous"
            name="Ano anterior"
            stroke={COMPARISON_SERIES}
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
          />
        </LineChart>
      </Bloco>

      <Bloco title="Vendas por totem" hint="Os 12 maiores" vazio={report.byTotem.length === 0}>
        <BarChart data={report.byTotem} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={shortCurrency} />
          <YAxis
            type="category"
            dataKey="totem"
            width={120}
            tick={AXIS}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip {...TOOLTIP_STYLE} formatter={moeda} cursor={{ fill: "hsl(var(--muted)/0.4)" }} />
          <Bar dataKey="amount" name="Receita" fill={SINGLE_SERIES} radius={[0, 4, 4, 0]} />
        </BarChart>
      </Bloco>

      <Bloco
        title="Top 10 produtos"
        hint="Por quantidade vendida"
        aviso={
          report.truncatedItems > 0
            ? `${report.truncatedItems.toLocaleString("pt-BR")} itens vendidos por peso foram gravados na nuvem sem as casas decimais (0,202 kg vira 0). O ranking por quantidade fica distorcido.`
            : null
        }
        vazio={report.topProducts.length === 0}
      >
        <BarChart data={report.topProducts} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="product"
            width={150}
            tick={AXIS}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(valor: number) => formatQuantity(valor)}
            cursor={{ fill: "hsl(var(--muted)/0.4)" }}
          />
          <Bar dataKey="quantity" name="Quantidade" fill={SINGLE_SERIES} radius={[0, 4, 4, 0]} />
        </BarChart>
      </Bloco>
    </div>
  );
}
