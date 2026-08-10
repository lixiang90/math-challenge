import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { validateSolutionFiles } from "@/lib/lean-paths";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  dispatchVerifier,
  publicSubmissionRow,
  solutionDigest,
  verifierLimits,
} from "@/lib/verifier";

export const runtime = "nodejs";

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

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Origin not allowed." }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const problemId = typeof record.problem_id === "string" ? record.problem_id : "";
  if (!/^[0-9a-f-]{36}$/i.test(problemId)) {
    return NextResponse.json({ error: "Invalid problem id." }, { status: 400 });
  }

  const validation = validateSolutionFiles(record.files);
  if (!validation.ok) {
    return NextResponse.json(
      { error: "Invalid submission files.", details: validation.errors },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: problem, error: problemError } = await admin
    .from("challenge_problems")
    .select(
      "id,status,definition_names,verifier_problem_id,submission_templates,submission_enabled,projects!inner(status)",
    )
    .eq("id", problemId)
    .single();
  const project = Array.isArray(problem?.projects) ? problem.projects[0] : problem?.projects;
  if (
    problemError ||
    !problem ||
    problem.status !== "open" ||
    !problem.submission_enabled ||
    !problem.verifier_problem_id ||
    !project ||
    project.status !== "published"
  ) {
    return NextResponse.json({ error: "This problem is not accepting submissions." }, { status: 409 });
  }

  const templates = problem.submission_templates as Record<string, string> | null;
  if (!templates?.["Submission.lean"]) {
    return NextResponse.json({ error: "Submission template is unavailable." }, { status: 503 });
  }
  if (validation.files["Submission.lean"] === templates["Submission.lean"]) {
    return NextResponse.json(
      { error: "Submission.lean is unchanged from the starter template." },
      { status: 400 },
    );
  }

  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60_000).toISOString();
  const cooldownAgo = new Date(
    now - verifierLimits.cooldownSeconds * 1000,
  ).toISOString();
  const userId = authData.user.id;
  const [daily, recent, active] = await Promise.all([
    admin
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", dayAgo),
    admin
      .from("submissions")
      .select("id")
      .eq("user_id", userId)
      .eq("problem_id", problemId)
      .gte("created_at", cooldownAgo)
      .limit(1),
    admin
      .from("submissions")
      .select("id")
      .eq("user_id", userId)
      .eq("problem_id", problemId)
      .in("status", ["queued", "running"])
      .limit(1),
  ]);
  if (daily.error || recent.error || active.error) {
    return NextResponse.json({ error: "Unable to check submission quota." }, { status: 503 });
  }
  if ((daily.count ?? 0) >= verifierLimits.dailyQuota) {
    return NextResponse.json({ error: "Daily submission quota exceeded." }, { status: 429 });
  }
  if (recent.data?.length) {
    return NextResponse.json(
      { error: `Please wait ${verifierLimits.cooldownSeconds} seconds before resubmitting this problem.` },
      { status: 429 },
    );
  }
  if (active.data?.length) {
    return NextResponse.json(
      { error: "A submission for this problem is already running." },
      { status: 409 },
    );
  }

  const submissionId = randomUUID();
  const digest = solutionDigest(validation.files);
  const payloadPath = `${userId}/${submissionId}.json`;
  const dispatchAttempt = 1;
  const payload = {
    schema_version: 1,
    submission_id: submissionId,
    problem_id: problem.verifier_problem_id,
    solution_digest: digest,
    files: validation.files,
  };

  const upload = await admin.storage
    .from("submission-payloads")
    .upload(payloadPath, JSON.stringify(payload), {
      contentType: "application/json",
      upsert: false,
    });
  if (upload.error) {
    return NextResponse.json({ error: "Unable to store submission payload." }, { status: 503 });
  }

  const { data: inserted, error: insertError } = await admin
    .from("submissions")
    .insert({
      id: submissionId,
      problem_id: problemId,
      user_id: userId,
      source_kind: "inline",
      payload_path: payloadPath,
      solution_digest: digest,
      verifier_problem_id: problem.verifier_problem_id,
      dispatch_attempt: dispatchAttempt,
      status: "queued",
      queued_at: new Date(now).toISOString(),
    })
    .select("*")
    .single();
  if (insertError || !inserted) {
    await admin.storage.from("submission-payloads").remove([payloadPath]);
    const conflict = insertError?.code === "23505";
    return NextResponse.json(
      { error: conflict ? "A submission is already active." : "Unable to queue submission." },
      { status: conflict ? 409 : 503 },
    );
  }

  const signed = await admin.storage
    .from("submission-payloads")
    .createSignedUrl(payloadPath, 60 * 60);
  if (signed.error || !signed.data.signedUrl) {
    await admin.from("submissions").delete().eq("id", submissionId);
    await admin.storage.from("submission-payloads").remove([payloadPath]);
    return NextResponse.json({ error: "Unable to authorize the verifier." }, { status: 503 });
  }

  try {
    await dispatchVerifier({
      submissionId,
      problemId: problem.verifier_problem_id,
      payloadUrl: signed.data.signedUrl,
      dispatchAttempt,
    });
  } catch (error) {
    await admin.from("submissions").delete().eq("id", submissionId);
    await admin.storage.from("submission-payloads").remove([payloadPath]);
    console.error(error);
    return NextResponse.json({ error: "Verifier dispatch failed." }, { status: 503 });
  }

  const startedAt = new Date().toISOString();
  const { data: running } = await admin
    .from("submissions")
    .update({ status: "running", started_at: startedAt })
    .eq("id", submissionId)
    .eq("status", "queued")
    .select("*")
    .single();

  return NextResponse.json(
    { submission: publicSubmissionRow((running ?? { ...inserted, status: "running", started_at: startedAt }) as Record<string, unknown>) },
    { status: 202 },
  );
}
