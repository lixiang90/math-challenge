import { NextRequest, NextResponse } from "next/server";
import { ensureInitialAdmins } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { dispatchVerifier, publicSubmissionRow } from "@/lib/verifier";

export const runtime = "nodejs";

const RETRYABLE_STATUSES = ["error", "timeout"] as const;

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const allowed = new Set([request.nextUrl.origin]);
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    try {
      allowed.add(new URL(configured).origin);
    } catch {
      return false;
    }
  }
  return allowed.has(origin);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Origin not allowed." }, { status: 403 });
  }

  const { submissionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(submissionId)) {
    return NextResponse.json({ error: "Invalid submission id." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  await ensureInitialAdmins();
  const { data: adminRow, error: adminError } = await supabase
    .from("site_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (adminError) {
    return NextResponse.json({ error: "Unable to verify administrator access." }, { status: 503 });
  }
  if (!adminRow) {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: submission, error: submissionError } = await admin
    .from("submissions")
    .select(
      "id,user_id,problem_id,status,verdict,log_url,runner_run_id,started_at,finished_at,payload_path,solution_digest,verifier_problem_id,benchmark_commit,dispatch_attempt,queued_at,callback_received_at,error_message",
    )
    .eq("id", submissionId)
    .maybeSingle();
  if (submissionError) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }
  if (!submission) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }
  if (!RETRYABLE_STATUSES.includes(submission.status as (typeof RETRYABLE_STATUSES)[number])) {
    return NextResponse.json(
      { error: "Only verifier errors and timeouts can be retried." },
      { status: 409 },
    );
  }
  if (!submission.payload_path || !submission.verifier_problem_id) {
    return NextResponse.json({ error: "Stored verifier payload is unavailable." }, { status: 409 });
  }

  const { data: active, error: activeError } = await admin
    .from("submissions")
    .select("id")
    .eq("user_id", submission.user_id)
    .eq("problem_id", submission.problem_id)
    .neq("id", submission.id)
    .in("status", ["queued", "running"])
    .limit(1);
  if (activeError) {
    return NextResponse.json({ error: "Unable to check active submissions." }, { status: 503 });
  }
  if (active?.length) {
    return NextResponse.json(
      { error: "Another submission for this user and problem is already running." },
      { status: 409 },
    );
  }

  const signed = await admin.storage
    .from("submission-payloads")
    .createSignedUrl(submission.payload_path, 60 * 60);
  if (signed.error || !signed.data.signedUrl) {
    return NextResponse.json({ error: "Unable to authorize the verifier." }, { status: 503 });
  }

  const dispatchAttempt = submission.dispatch_attempt + 1;
  const queuedAt = new Date().toISOString();
  const { data: queued, error: queueError } = await admin
    .from("submissions")
    .update({
      status: "queued",
      dispatch_attempt: dispatchAttempt,
      queued_at: queuedAt,
      started_at: null,
      finished_at: null,
      verdict: null,
      log_url: null,
      runner_run_id: null,
      benchmark_commit: null,
      callback_received_at: null,
      error_message: null,
    })
    .eq("id", submission.id)
    .eq("status", submission.status)
    .eq("dispatch_attempt", submission.dispatch_attempt)
    .select("*")
    .maybeSingle();
  if (queueError || !queued) {
    return NextResponse.json({ error: "Submission state changed before retry." }, { status: 409 });
  }

  try {
    await dispatchVerifier({
      submissionId: submission.id,
      problemId: submission.verifier_problem_id,
      payloadUrl: signed.data.signedUrl,
      dispatchAttempt,
    });
  } catch (error) {
    const { error: rollbackError } = await admin
      .from("submissions")
      .update({
        status: submission.status,
        dispatch_attempt: submission.dispatch_attempt,
        queued_at: submission.queued_at,
        started_at: submission.started_at,
        finished_at: submission.finished_at,
        verdict: submission.verdict,
        log_url: submission.log_url,
        runner_run_id: submission.runner_run_id,
        benchmark_commit: submission.benchmark_commit,
        callback_received_at: submission.callback_received_at,
        error_message: submission.error_message,
      })
      .eq("id", submission.id)
      .eq("status", "queued")
      .eq("dispatch_attempt", dispatchAttempt);
    console.error("Administrator verifier retry dispatch failed.", error);
    if (rollbackError) {
      console.error("Unable to restore submission after failed retry dispatch.", rollbackError);
    }
    return NextResponse.json({ error: "Verifier dispatch failed." }, { status: 503 });
  }

  const startedAt = new Date().toISOString();
  const { data: running } = await admin
    .from("submissions")
    .update({ status: "running", started_at: startedAt })
    .eq("id", submission.id)
    .eq("status", "queued")
    .eq("dispatch_attempt", dispatchAttempt)
    .select("*")
    .maybeSingle();

  return NextResponse.json(
    {
      submission: publicSubmissionRow(
        (running ?? { ...queued, status: "running", started_at: startedAt }) as Record<
          string,
          unknown
        >,
      ),
      retried: true,
      dispatch_attempt: dispatchAttempt,
    },
    { status: 202 },
  );
}
