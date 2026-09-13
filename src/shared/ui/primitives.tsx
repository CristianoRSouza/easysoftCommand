import type { ReactNode } from "react";

/**
 * Peças visuais compartilhadas pelos módulos.
 *
 * Existem para que Produtos, Comandas, Transações e Unidades não repitam as
 * mesmas classes. Quando o design mudar, muda aqui — não em quatro telas.
 */

/** Classes de campo de formulário. Usadas em `input` e `select`. */
export const FIELD =
  "rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary";

export function PageHeader({ title, count, unit }: { title: string; count?: number; unit?: [string, string] }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h1 className="font-heading text-2xl font-bold tracking-tight">{title}</h1>
      {count !== undefined && unit && (
        <span className="shrink-0 text-sm text-muted-foreground">
          {count.toLocaleString("pt-BR")} {count === 1 ? unit[0] : unit[1]}
        </span>
      )}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`glass-panel rounded-lg shadow-elegant ${className}`}>{children}</div>;
}

export function StatCard({ label, value }: { label: string; value: number | null }) {
  return (
    <Panel className="p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-heading text-3xl font-bold">
        {value === null ? "—" : value.toLocaleString("pt-BR")}
      </p>
    </Panel>
  );
}

type Tone = "success" | "warning" | "destructive" | "info" | "muted";

const TONE: Record<Tone, string> = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/15 text-destructive",
  info: "bg-info/15 text-info",
  muted: "bg-muted text-muted-foreground",
};

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TONE[tone]}`}>
      {children}
    </span>
  );
}

export function Loading({ label }: { label: string }) {
  return <p className="px-4 py-12 text-center text-sm text-muted-foreground">{label}</p>;
}

export function Empty({ label }: { label: string }) {
  return (
    <Panel className="px-4 py-12 text-center text-sm text-muted-foreground">{label}</Panel>
  );
}

export function ErrorNotice({ error, fallback }: { error: unknown; fallback: string }) {
  return (
    <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {error instanceof Error ? error.message : fallback}
    </p>
  );
}

export function Pagination({
  page,
  lastPage,
  onChange,
}: {
  page: number;
  lastPage: number;
  onChange: (page: number) => void;
}) {
  const button =
    "rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">
        Página {page} de {lastPage}
      </span>
      <div className="flex gap-2">
        <button onClick={() => onChange(page - 1)} disabled={page <= 1} className={button}>
          Anterior
        </button>
        <button onClick={() => onChange(page + 1)} disabled={page >= lastPage} className={button}>
          Próxima
        </button>
      </div>
    </div>
  );
}

/** Cabeçalho de coluna clicável, com indicador de ordenação. */
export function SortableHeader<K extends string>({
  column,
  label,
  activeKey,
  direction,
  onSort,
  align = "left",
}: {
  column: K;
  label: string;
  activeKey: K;
  direction: "asc" | "desc";
  onSort: (key: K) => void;
  align?: "left" | "right";
}) {
  const active = activeKey === column;
  return (
    <th
      onClick={() => onSort(column)}
      className={`cursor-pointer select-none px-4 py-3 font-medium transition-colors hover:text-foreground ${
        align === "right" ? "text-right" : "text-left"
      } ${active ? "text-foreground" : ""}`}
    >
      {label}
      {active && <span className="ml-1 text-primary">{direction === "asc" ? "↑" : "↓"}</span>}
    </th>
  );
}
