import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // Caminhos absolutos: o link de recuperação de senha chega em
  // `/reset-password?token_hash=...`, e com caminho relativo os scripts seriam
  // procurados dentro de `/reset-password/`. O relativo só existia para o
  // Electron abrir o index.html pelo sistema de arquivos.
  base: "/",
  plugins: [react()],
  resolve: {
    // `import.meta.url` em vez de `__dirname`: este arquivo é ESM.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: { host: true, port: 8080 },
});
