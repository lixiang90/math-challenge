import { setRequestLocale } from "next-intl/server";
import { ProfileView } from "@/components/profile-view";
import {
  getPointsLedger,
  getProfileStats,
  listProjectsByOwner,
  listSubmissionsForUser,
  useMock,
} from "@/lib/mock/db";
import { createClient } from "@/lib/supabase/server";

// Reads the per-request auth session, so this must render on demand.
export const dynamic = "force-dynamic";

const EMPTY_STATS = {
  points: 0,
  solved_count: 0,
  submission_count: 0,
  project_count: 0,
};

export default async function MePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Resolve the signed-in user from the server session.
  let userId: string | null = null;
  if (!useMock()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  }

  // Not signed in (or no real backend configured): render the sign-in prompt.
  if (!userId) {
    return (
      <ProfileView
        stats={EMPTY_STATS}
        submissions={[]}
        projects={[]}
        ledger={[]}
      />
    );
  }

  const [stats, submissions, projects, ledger] = await Promise.all([
    getProfileStats(userId),
    listSubmissionsForUser(userId),
    listProjectsByOwner(userId),
    getPointsLedger(userId),
  ]);

  return (
    <ProfileView
      stats={stats}
      submissions={submissions}
      projects={projects}
      ledger={ledger}
    />
  );
}
