"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";

export interface SessionUser {
  id: string;
  display_name: string;
  github_login: string;
  avatar_url: string | null;
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
  };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data.session?.user ? toSessionUser(data.session.user) : null);
      setIsLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? toSessionUser(session.user) : null);
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
