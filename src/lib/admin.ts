import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Site-admin helpers.
 *
 * Admin authority is an explicit role stored in `site_admins`, decoupled from any
 * GitHub handle. RLS is built around `public.is_site_admin()` (DB function) and a
 * self-scoped policy on `site_admins` so ordinary users can never self-grant.
 *
 * The first admin(s) are seeded from INITIAL_ADMIN_LOGINS by `ensureInitialAdmins`,
 * which runs server-side with the service_role key (the only path allowed to
 * insert into site_admins).
 */

/** Mirror of `useMock()` without importing the data layer (avoids a cycle). */
function isMockConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.toLowerCase();
  return !url || url.includes("your-project-ref") || url.includes("example.com");
}

const ADMIN_LOGINS = (process.env.INITIAL_ADMIN_LOGINS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

/** Service-role client for privileged, RLS-bypassing server ops (bootstrap only). */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || url.toLowerCase().includes("your-project-ref")) {
    return null;
  }
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}

/**
 * Seed the first site admin(s) from INITIAL_ADMIN_LOGINS.
 *
 * Idempotent and safe to call on every authenticated request: it's a no-op when
 * the env var is unset, and `upsert` makes repeats harmless. Skips logins whose
 * profile hasn't been created yet (the DB trigger fires on first GitHub OAuth),
 * retrying on the next request.
 */
export async function ensureInitialAdmins(): Promise<void> {
  if (ADMIN_LOGINS.length === 0) return;
  const svc = createServiceClient();
  if (!svc) return;

  for (const login of ADMIN_LOGINS) {
    const { data: prof } = await svc
      .from("profiles")
      .select("id")
      .eq("github_login", login)
      .maybeSingle();
    if (!prof?.id) continue; // profile not ready yet; retry next request

    // Self-grant on cold start: granted_by = the user themselves.
    await svc
      .from("site_admins")
      .upsert(
        { user_id: prof.id, granted_by: prof.id, granted_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
  }
}

/**
 * Whether the currently authenticated user is a site admin.
 * Uses the anon/server client: RLS on site_admins exposes only the caller's own
 * row, so a returned row means the caller is an active admin.
 */
export async function getIsAdmin(): Promise<boolean> {
  if (isMockConfigured()) return false;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  // Bootstrap the first admin(s) from INITIAL_ADMIN_LOGINS on the server
  // (service role). Idempotent; harmless when already seeded. Must run BEFORE
  // the read so the very first admin self-activates on their first /admin
  // visit — otherwise the gate would deadlock against an unseeded row.
  await ensureInitialAdmins();

  const { data } = await supabase
    .from("site_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return !!data;
}
