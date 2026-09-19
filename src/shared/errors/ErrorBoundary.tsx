import { Component, type ErrorInfo, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { reportError } from "./error-report";

/**
 * Última barreira contra erro de tela.
 *
 * Sem ela, um erro em qualquer componente desmonta o painel inteiro e deixa a
 * página em branco, sem dizer nada. Aqui a pessoa vê o que houve e pode
 * recarregar, e o erro vai para o relatório.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { mensagem: string | null }> {
  state = { mensagem: null as string | null };

  static getDerivedStateFromError(erro: Error) {
    return { mensagem: erro.message || "Erro desconhecido" };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    void reportError(erro, info.componentStack ?? undefined);
  }

  render() {
    if (this.state.mensagem === null) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md space-y-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <TriangleAlert size={32} className="text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="font-heading text-xl font-semibold">Algo deu errado</h1>
            <p className="text-sm text-muted-foreground">
              Um erro inesperado interrompeu a tela. Um relatório foi enviado para análise.
            </p>
            <p className="break-all font-mono text-xs text-muted-foreground/70">
              {this.state.mensagem}
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}
