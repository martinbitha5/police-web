import { createClient } from '@supabase/supabase-js';

/**
 * Client service_role — SERVEUR UNIQUEMENT (route handlers / server actions).
 * Contourne la RLS. Ne jamais importer dans un composant client.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
