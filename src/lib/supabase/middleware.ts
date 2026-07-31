import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PLACEHOLDER = "your-project-ref";

/**
 * Refresh the Supabase auth session on every request and persist the
 * rotated cookies. Returns `null` when env vars are not yet configured
 * (e.g. placeholders in `.env.local`), so the rest of the app keeps
 * working without a backend.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Guard: skip entirely when not configured to avoid crashing the site.
  // Case-insensitive so mixed-case placeholders (YOUR-PROJECT-ref) also match.
  if (!url || !anon || url.toLowerCase().includes(PLACEHOLDER)) {
    return null;
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: refresh the session before any other code reads the user.
  await supabase.auth.getUser();

  return supabaseResponse;
}
