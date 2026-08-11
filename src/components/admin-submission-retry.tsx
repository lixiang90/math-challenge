"use client";

import { useState, type FormEvent } from "react";

const SUBMISSION_ID_PATTERN = /^[0-9a-f-]{36}$/i;

type RetryLabels = {
  submissionId: string;
  placeholder: string;
  submit: string;
  submitting: string;
  success: string;
  invalidId: string;
  genericError: string;
};

export function AdminSubmissionRetry({ labels }: { labels: RetryLabels }) {
  const [submissionId, setSubmissionId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = submissionId.trim();
    if (!SUBMISSION_ID_PATTERN.test(id)) {
      setIsError(true);
      setMessage(labels.invalidId);
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/submissions/${encodeURIComponent(id)}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const body = (await response.json()) as {
        error?: string;
        dispatch_attempt?: number;
      };
      if (!response.ok) {
        setIsError(true);
        setMessage(body.error || labels.genericError);
        return;
      }
      setIsError(false);
      setMessage(`${labels.success} #${body.dispatch_attempt ?? ""}`.trim());
    } catch {
      setIsError(true);
      setMessage(labels.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl border border-rule bg-card p-5"
    >
      <label className="block space-y-1.5 text-[13px] font-medium text-ink">
        <span>{labels.submissionId}</span>
        <input
          value={submissionId}
          onChange={(event) => setSubmissionId(event.target.value)}
          placeholder={labels.placeholder}
          spellCheck={false}
          autoComplete="off"
          required
          aria-invalid={isError || undefined}
          className="w-full rounded-lg border border-rule bg-surface px-3 py-2 font-mono text-[13px] outline-none transition-colors focus:border-accent"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-white transition-opacity disabled:opacity-50"
        >
          {submitting ? labels.submitting : labels.submit}
        </button>
        {message ? (
          <p className={`text-[13px] ${isError ? "text-red-600" : "text-accent"}`} role="status">
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
