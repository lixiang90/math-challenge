import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCallbackSignature } from "@/lib/verifier";

export const runtime = "nodejs";
const MAX_CALLBACK_BYTES = 64 * 1024;

type CallbackStatus = "passed" | "failed" | "error" | "timeout";

interface VerifierCallback {
  schema_version: 1;
  submission_id: string;
  problem_id: string;
  dispatch_attempt: number;
  benchmark_commit: string;
  run_id: string;
  run_attempt: number;
  status: CallbackStatus;
  summary: Record<string, unknown> | null;
  error_message?: string | null;
}

function parseCallback(value: unknown): VerifierCallback | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (
    v.schema_version !== 1 ||
    typeof v.submission_id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(v.submission_id) ||
    typeof v.problem_id !== "string" ||
    v.problem_id.length < 1 ||
    v.problem_id.length > 200 ||
    typeof v.dispatch_attempt !== "number" ||
    !Number.isSafeInteger(v.dispatch_attempt) ||
    v.dispatch_attempt < 1 ||
    typeof v.benchmark_commit !== "string" ||
    !/^[0-9a-f]{40}$/i.test(v.benchmark_commit) ||
    typeof v.run_id !== "string" ||
    !/^\d{1,30}$/.test(v.run_id) ||
    typeof v.run_attempt !== "number" ||
    !Number.isSafeInteger(v.run_attempt) ||
    v.run_attempt < 1 ||
    !["passed", "failed", "error", "timeout"].includes(String(v.status)) ||
    !(v.summary === null || (typeof v.summary === "object" && !Array.isArray(v.summary))) ||
    !(v.error_message == null ||
      (typeof v.error_message === "string" && v.error_message.length <= 2_000))
  ) {
    return null;
  }
  return v as unknown as VerifierCallback;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_CALLBACK_BYTES) {
    return NextResponse.json({ error: "Callback payload is too large." }, { status: 413 });
  }
  if (
    !verifyCallbackSignature(
      rawBody,
      request.headers.get("x-verifier-timestamp"),
      request.headers.get("x-verifier-signature"),
    )
  ) {
    return NextResponse.json({ error: "Invalid callback signature." }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid callback JSON." }, { status: 400 });
  }
  const callback = parseCallback(parsed);
  if (!callback) {
    return NextResponse.json({ error: "Invalid callback payload." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: submission, error } = await admin
    .from("submissions")
    .select("id,status,dispatch_attempt,verifier_problem_id,problem_id")
    .eq("id", callback.submission_id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  if (!submission) return NextResponse.json({ error: "Submission not found." }, { status: 404 });

  if (["passed", "failed", "error", "timeout", "review"].includes(submission.status)) {
    return NextResponse.json({ ok: true, replay: true });
  }
  if (
    submission.dispatch_attempt !== callback.dispatch_attempt ||
    submission.verifier_problem_id !== callback.problem_id
  ) {
    return NextResponse.json({ error: "Stale verifier callback." }, { status: 409 });
  }

  const { data: problem } = await admin
    .from("challenge_problems")
    .select("definition_names")
    .eq("id", submission.problem_id)
    .single();
  const needsReview =
    callback.status === "passed" &&
    Array.isArray(problem?.definition_names) &&
    problem.definition_names.length > 0;
  const status = needsReview ? "review" : callback.status;
  const finishedAt = new Date().toISOString();
  const runUrl = process.env.VERIFIER_REPO
    ? `https://github.com/${process.env.VERIFIER_REPO}/actions/runs/${callback.run_id}`
    : null;
  const message =
    callback.error_message ||
    (needsReview
      ? "Comparator accepted the submission; definition holes require manual review."
      : callback.status === "passed"
        ? "Comparator and kernel replay accepted the submission."
        : callback.status === "failed"
          ? "Comparator rejected the submission."
          : "The verifier could not complete the submission.");

  const { error: updateError } = await admin
    .from("submissions")
    .update({
      status,
      verdict: {
        ok: callback.status === "passed",
        stage: callback.status === "passed" ? "done" : "verification",
        message,
        summary: callback.summary,
      },
      benchmark_commit:
        /^0{40}$/.test(callback.benchmark_commit)
          ? null
          : callback.benchmark_commit.toLowerCase(),
      runner_run_id: callback.run_id,
      log_url: runUrl,
      error_message: callback.error_message ?? null,
      callback_received_at: finishedAt,
      finished_at: finishedAt,
    })
    .eq("id", callback.submission_id)
    .eq("dispatch_attempt", callback.dispatch_attempt)
    .in("status", ["queued", "running"]);
  if (updateError) {
    return NextResponse.json({ error: "Unable to record verdict." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, status });
}
