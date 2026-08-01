import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { publicSubmissionRow } from "@/lib/verifier";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid submission id." }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("submissions")
    .select("*")
    .eq("id", id)
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to load submission." }, { status: 503 });
  if (!data) return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  return NextResponse.json({ submission: publicSubmissionRow(data) });
}
