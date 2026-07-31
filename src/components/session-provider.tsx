"use client";

import * as React from "react";
import type { Profile } from "@/lib/types";

/**
 * Phase-1 stand-in for Supabase Auth.
 *
 * Phase 2 replaces this with the real GitHub OAuth session. Consumers only
 * ever read `user`, so the swap does not touch any component below.
 */

const STORAGE_KEY = "formalia.demo-session";

interface SessionValue {
  user: Profile | null;
  isDemo: true;
  signIn: () => void;
  signOut: () => void;
}

const SessionContext = React.createContext<SessionValue | null>(null);

export function SessionProvider({
  demoUser,
  children,
}: {
  demoUser: Profile;
  children: React.ReactNode;
}) {
  const [signedIn, setSignedIn] = React.useState(false);

  React.useEffect(() => {
    try {
      setSignedIn(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* storage unavailable — stay signed out */
    }
  }, []);

  const persist = React.useCallback((next: boolean) => {
    setSignedIn(next);
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, "1");
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = React.useMemo<SessionValue>(
    () => ({
      user: signedIn ? demoUser : null,
      isDemo: true,
      signIn: () => persist(true),
      signOut: () => persist(false),
    }),
    [signedIn, demoUser, persist]
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
