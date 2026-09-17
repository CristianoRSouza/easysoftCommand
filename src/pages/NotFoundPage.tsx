import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { Panel } from "@/shared/ui/primitives";

/** Endereço que não leva a tela nenhuma. Sem isto, a área principal fica vazia. */
export function NotFoundPage() {
  return (
    <Panel className="mx-auto mt-12 max-w-md space-y-3 px-6 py-10 text-center">
      <Compass size={30} className="mx-auto text-muted-foreground" />
      <h1 className="font-heading text-lg font-bold">Página não encontrada</h1>
      <p className="text-sm text-muted-foreground">
        O endereço não corresponde a nenhuma tela do painel.
      </p>
      <Link to="/" className="inline-block text-sm text-primary hover:underline">
        Ir para o Dashboard
      </Link>
    </Panel>
  );
}
