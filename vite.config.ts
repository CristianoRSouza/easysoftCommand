import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // Caminhos relativos: o Electron carrega o index.html pelo sistema de
  // arquivos, onde caminhos absolutos não resolvem.
  base: "./",
  plugins: [react()],
  resolve: {
    // `import.meta.url` em vez de `__dirname`: este arquivo é ESM.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: { host: true, port: 8080 },
});
