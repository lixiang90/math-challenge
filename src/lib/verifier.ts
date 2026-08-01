import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { canonicalSolutionJson, type SolutionFiles } from "@/lib/lean-paths";

const GITHUB_API_VERSION = "2022-11-28";
let privateRepoCheck: Promise<void> | null = null;

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const verifierLimits = {
  cooldownSeconds: positiveInt(process.env.VERIFIER_COOLDOWN_SECONDS, 600),
  dailyQuota: positiveInt(process.env.VERIFIER_DAILY_QUOTA, 20),
};

export function solutionDigest(files: SolutionFiles): string {
  return createHash("sha256").update(canonicalSolutionJson(files)).digest("hex");
}

function verifierConfig() {
  const repo = process.env.VERIFIER_REPO;
  const token = process.env.VERIFIER_GITHUB_TOKEN;
  if (!repo || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    throw new Error("VERIFIER_REPO must be configured as owner/repository.");
  }
  if (!token) throw new Error("VERIFIER_GITHUB_TOKEN is not configured.");
  return {
    repo,
    token,
    ref: process.env.VERIFIER_REF || "main",
    workflow: process.env.VERIFIER_WORKFLOW || "verify-website-submission.yml",
  };
}

async function assertPrivateVerifierRepo(config: ReturnType<typeof verifierConfig>) {
  privateRepoCheck ??= (async () => {
    const response = await fetch(`https://api.github.com/repos/${config.repo}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${config.token}`,
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(`Unable to verify verifier repository privacy (${response.status}).`);
    }
    const metadata = (await response.json()) as { private?: boolean };
    if (metadata.private !== true) {
      throw new Error("VERIFIER_REPO must be private because dispatch inputs contain a signed payload URL.");
    }
  })();
  try {
    await privateRepoCheck;
  } catch (error) {
    privateRepoCheck = null;
    throw error;
  }
}

export async function dispatchVerifier(input: {
  submissionId: string;
  problemId: string;
  payloadUrl: string;
  dispatchAttempt: number;
}): Promise<void> {
  const config = verifierConfig();
  await assertPrivateVerifierRepo(config);
  const response = await fetch(
    `https://api.github.com/repos/${config.repo}/actions/workflows/${encodeURIComponent(config.workflow)}/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
      },
      body: JSON.stringify({
        ref: config.ref,
        inputs: {
          submission_id: input.submissionId,
          problem_id: input.problemId,
          payload_url: input.payloadUrl,
          dispatch_attempt: String(input.dispatchAttempt),
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (response.status !== 204) {
    const details = (await response.text()).slice(0, 500);
    throw new Error(`GitHub workflow dispatch failed (${response.status}): ${details}`);
  }
}

export function verifyCallbackSignature(
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
): boolean {
  const secret = process.env.VERIFIER_CALLBACK_SECRET;
  if (!secret || !timestamp || !signature) return false;
  if (!/^\d{10,13}$/.test(timestamp)) return false;
  const millis = timestamp.length === 10 ? Number(timestamp) * 1000 : Number(timestamp);
  if (!Number.isFinite(millis) || Math.abs(Date.now() - millis) > 5 * 60_000) {
    return false;
  }

  const supplied = signature.startsWith("sha256=") ? signature.slice(7) : signature;
  if (!/^[0-9a-f]{64}$/i.test(supplied)) return false;
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(supplied, "hex"));
}

export function publicSubmissionRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    problem_id: row.problem_id,
    user_id: row.user_id,
    source_kind: row.source_kind,
    status: row.status,
    verdict: row.verdict,
    log_url: row.log_url,
    runner_run_id: row.runner_run_id,
    points_awarded: row.points_awarded,
    created_at: row.created_at,
    started_at: row.started_at,
    finished_at: row.finished_at,
    error_message: row.error_message,
    benchmark_commit: row.benchmark_commit,
  };
}
