import type { ServiceKind, ServiceRuntime, ServiceRuntimeDraft } from "../domain/service-runtime";

/**
 * Porta do registro de instalação dos serviços.
 *
 * Só existe no modo local: as tabelas guardam caminhos de arquivo desta
 * máquina, e um caminho de outro computador não significa nada.
 */
export interface ServiceRepository {
  isAvailable(): boolean;
  list(): Promise<ServiceRuntime[]>;
  save(service: ServiceKind, draft: ServiceRuntimeDraft): Promise<void>;
}
