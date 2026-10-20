import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const gate = process.env.CONFERENCIA_DB_KEY;
  if (!url || !key || !gate) {
    throw new AppError("O banco da conferência não está configurado.", 500);
  }

  client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { "x-conferencia-key": gate },
    },
  });
  return client;
}
