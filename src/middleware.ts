import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { updateSession } from "@/lib/supabase/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

// /<locale>/admin (any trailing sub-path), e.g. /en/admin, /zh/admin/foo
const ADMIN_PATH = /^\/(en|zh)\/admin(\/.*)?$/;

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return !!url && !!anon && !url.toLowerCase().includes("your-project-ref");
}

export async function middleware(request: NextRequest) {
  // 1. Refresh the Supabase auth session (sets/rotates auth cookies).
  const supabaseResponse = await updateSession(request);

  // 2. Run the next-intl middleware on the original request.
  const intlResponse = intlMiddleware(request);

  // 3. Forward any cookies set by Supabase onto the intl response.
  if (supabaseResponse) {
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      intlResponse.cookies.set(cookie);
    });
  }

  // 4. Lightweight gate for /<locale>/admin: bounce anonymous visitors before
  //    the page runs. Authenticated users are passed through to the page, which
  //    performs the definitive (seed-aware) admin check via getIsAdmin().
  //
  //    We deliberately do NOT run the full admin check here: that would require
  //    a service-role call (unavailable/safe in the Edge runtime) and would
  //    deadlock the first admin, whose site_admins row is seeded lazily on an
  //    authenticated hit and confirmed by the page itself. The page's
  //    force-dynamic + getIsAdmin() is the authoritative gate; this is just a
  //    cheap pre-filter so logged-out traffic never reaches the gated render.
  const adminMatch = ADMIN_PATH.exec(request.nextUrl.pathname);
  if (adminMatch && isSupabaseConfigured()) {
    const locale = adminMatch[1];
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {
            // Session already refreshed by updateSession(); read-only here.
          },
        },
      },
    );

    let authed = false;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      authed = !!user;
    } catch {
      authed = false;
    }

    if (!authed) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = `/${locale}`;
      return NextResponse.redirect(redirectUrl);
    }
  }

  return intlResponse;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
