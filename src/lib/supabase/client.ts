import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client (runs in the client component).
 * Reads the public env vars injected at build time.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
