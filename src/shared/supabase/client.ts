import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Falha alto, na inicialização. No projeto anterior estas credenciais estavam
// escritas no código e as variáveis de ambiente eram ignoradas — mudar o .env
// não mudava nada, e a aplicação apontava silenciosamente para outro projeto.
if (!url || !key) {
  throw new Error(
    "VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY são obrigatórias. Copie o .env.example para .env.",
  );
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, storage: localStorage },
});
