import type { ServiceRepository } from "../application/service-repository";
import type { ServiceRuntime } from "../domain/service-runtime";

const MOTIVO =
  "O registro de instalação dos serviços guarda caminhos de arquivo do computador da loja. Abra o programa instalado lá para vê-lo ou alterá-lo.";

/**
 * Não existe na nuvem, e diz isso.
 *
 * Um caminho como C:\EasyFood\Servico só faz sentido na máquina onde o serviço
 * está. Mostrar isso pelo navegador seria exibir informação de outro
 * computador como se fosse do atual.
 */
export class SupabaseServiceRepository implements ServiceRepository {
  isAvailable(): boolean {
    return false;
  }

  async list(): Promise<ServiceRuntime[]> {
    throw new Error(MOTIVO);
  }

  async save(): Promise<void> {
    throw new Error(MOTIVO);
  }
}
