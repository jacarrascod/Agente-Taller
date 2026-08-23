// Cliente Supabase con `service_role`. SOLO se importa desde `src/server/**`
// (SPEC.md §5, "regla de oro"). Un check de CI busca este patrón fuera de
// esa carpeta y debe fallar si lo encuentra (ver scripts/check-server-only.mjs).

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";

let cliente: SupabaseClient<Database> | null = null;

/** Cliente admin: ignora RLS. Nunca se expone al navegador. */
export function supabaseAdmin(): SupabaseClient<Database> {
  if (cliente) return cliente;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. " +
        "Configura .env.local a partir de .env.example.",
    );
  }

  cliente = createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cliente;
}
