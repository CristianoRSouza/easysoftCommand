import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/shared/auth/auth-context";
import { supabase } from "@/shared/supabase/client";
import { SupabaseAccessResolver } from "./supabase-access-resolver";
import { NO_ACCESS, type AccessProfile } from "./access";

interface AccessState {
  profile: AccessProfile;
  loading: boolean;
}

const AccessContext = createContext<AccessState | null>(null);

const resolver = new SupabaseAccessResolver(supabase);

export function AccessProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const userId = session?.user.id ?? null;

  const query = useQuery<AccessProfile>({
    queryKey: ["access", userId],
    queryFn: async () => (userId ? resolver.resolve(userId) : NO_ACCESS),
    enabled: userId !== null,
    // O papel muda raramente, mas não é imutável: revogação precisa valer sem
    // exigir novo login.
    staleTime: 5 * 60 * 1000,
  });

  return (
    <AccessContext.Provider
      value={{ profile: query.data ?? NO_ACCESS, loading: query.isPending }}
    >
      {children}
    </AccessContext.Provider>
  );
}

export function useAccess(): AccessState {
  const context = useContext(AccessContext);
  if (!context) throw new Error("useAccess precisa estar dentro de AccessProvider.");
  return context;
}
