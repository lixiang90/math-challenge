import { setRequestLocale } from "next-intl/server";
import { ProfileView } from "@/components/profile-view";
import {
  getPointsLedger,
  getProfileStats,
  listProjectsByOwner,
  listSubmissionsForUser,
} from "@/lib/mock/db";
import { DEMO_USER_ID } from "@/lib/mock/profiles";

export default async function MePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [stats, submissions, projects, ledger] = await Promise.all([
    getProfileStats(DEMO_USER_ID),
    listSubmissionsForUser(DEMO_USER_ID),
    listProjectsByOwner(DEMO_USER_ID),
    getPointsLedger(DEMO_USER_ID),
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
