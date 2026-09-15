/**
 * Onde um serviço de segundo plano está instalado nesta máquina.
 *
 * O painel não instala nem controla os serviços — isso é feito por quem monta a
 * loja. O que ele guarda é o endereço: a pasta da instalação e o nome do
 * serviço no Windows. Serve para quem der suporte saber onde procurar sem ter
 * que adivinhar.
 */
export interface ServiceRuntime {
  service: ServiceKind;
  installPath: string | null;
  windowsServiceName: string | null;
  updatedAt: string | null;
}

export type ServiceKind = "tef" | "sync";

export const SERVICE_LABEL: Record<ServiceKind, string> = {
  tef: "Serviço TEF (Aditum)",
  sync: "Serviço de Sincronização",
};

/**
 * Nome padrão de cada serviço no Windows.
 *
 * Aparece como sugestão no formulário, não como valor imposto: instalações
 * antigas podem ter outro nome, e sobrescrever isso quebraria o comando que
 * para e inicia o serviço.
 */
export const DEFAULT_WINDOWS_SERVICE: Record<ServiceKind, string> = {
  tef: "EasyCommandPay-TEF-Aditum",
  sync: "EasyCommandPay-Sync-Service",
};

export interface ServiceRuntimeDraft {
  installPath: string;
  windowsServiceName: string;
}

export function draftFrom(runtime: ServiceRuntime): ServiceRuntimeDraft {
  return {
    installPath: runtime.installPath ?? "",
    windowsServiceName: runtime.windowsServiceName ?? DEFAULT_WINDOWS_SERVICE[runtime.service],
  };
}

export interface ServiceWarning {
  field: keyof ServiceRuntimeDraft;
  message: string;
}

/**
 * Avisa, não impede — como no restante do painel.
 *
 * O projeto anterior aceita qualquer texto nestes campos, e reproduzir isso é o
 * trabalho da migração. Mas um caminho que claramente não é do Windows costuma
 * ser erro de digitação, e dizer isso custa nada.
 */
export function inspectRuntime(draft: ServiceRuntimeDraft): ServiceWarning[] {
  const warnings: ServiceWarning[] = [];
  const caminho = draft.installPath.trim();

  if (caminho !== "" && !/^[a-zA-Z]:\\/.test(caminho) && !caminho.startsWith("\\\\")) {
    warnings.push({
      field: "installPath",
      message: 'Caminhos do Windows começam com uma letra de unidade (C:\\) ou \\\\ para rede.',
    });
  }

  if (draft.windowsServiceName.trim() === "") {
    warnings.push({
      field: "windowsServiceName",
      message: "Sem o nome do serviço, o suporte não consegue pará-lo nem reiniciá-lo.",
    });
  }

  return warnings;
}

export function normalizeRuntime(draft: ServiceRuntimeDraft): ServiceRuntimeDraft {
  return {
    installPath: draft.installPath.trim(),
    windowsServiceName: draft.windowsServiceName.trim(),
  };
}

export function isUnchanged(runtime: ServiceRuntime, draft: ServiceRuntimeDraft): boolean {
  const normalizado = normalizeRuntime(draft);
  return (
    (runtime.installPath ?? "") === normalizado.installPath &&
    (runtime.windowsServiceName ?? "") === normalizado.windowsServiceName
  );
}
