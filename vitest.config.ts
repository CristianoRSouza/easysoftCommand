import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Os testes cobrem o domínio e os mapeadores: regra de negócio e leitura de
 * linha de banco, que é onde os defeitos desta migração apareceram. Não há
 * ambiente de navegador aqui — nenhum deles precisa de tela.
 */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: { include: ["src/**/domain/**", "src/shared/domain/**"], reporter: ["text-summary"] },
  },
});
