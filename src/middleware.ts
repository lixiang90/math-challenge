import createMiddleware from "next-intl/middleware";
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

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

  return intlResponse;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
