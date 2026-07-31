"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";

export interface SessionUser {
  id: string;
  display_name: string;
  github_login: string;
  avatar_url: string | null;
  /** Whether this user is a site admin (computed from the site_admins table). */
  isAdmin: boolean;
}

/**
 * Real GitHub OAuth session backed by Supabase Auth.
 *
 * Replaces the phase-1 localStorage demo. Consumers only ever read `user`,
 * so swapping the source did not touch views below.
 */

interface SessionValue {
  user: SessionUser | null;
  isLoading: boolean;
  isDemo: false;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = React.createContext<SessionValue | null>(null);

function toSessionUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): SessionUser {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof meta[k] === "string" ? (meta[k] as string) : "");

  const name =
    str("full_name") ||
    str("name") ||
    str("user_name") ||
    (typeof user.email === "string" ? user.email : "") ||
    "User";

  return {
    id: user.id,
    display_name: name,
    github_login: str("user_name") || str("preferred_username") || user.id,
    avatar_url: str("avatar_url") || null,
    isAdmin: false,
  };
}

/**
 * Whether the given user is a site admin. Uses the browser Supabase client:
 * RLS on site_admins exposes only the caller's own row, so a returned row means
 * the caller is an active admin. Safe to call from the client (no secrets).
 */
async function fetchIsAdmin(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("site_admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const supabase = createClient();
    let active = true;

    const hydrate = async (rawUser: SessionUser | null) => {
      if (!rawUser) return null;
      const isAdmin = await fetchIsAdmin(supabase, rawUser.id);
      return { ...rawUser, isAdmin };
    };

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const next = await hydrate(
        data.session?.user ? toSessionUser(data.session.user) : null
      );
      setUser(next);
      setIsLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const next = await hydrate(
        session?.user ? toSessionUser(session.user) : null
      );
      setUser(next);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = React.useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: window.location.href },
    });
  }, []);

  const signOut = React.useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const value = React.useMemo<SessionValue>(
    () => ({ user, isLoading, isDemo: false, signIn, signOut }),
    [user, isLoading, signIn, signOut],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = React.useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
