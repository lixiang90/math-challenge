export const ROOT_SUBMISSION_PATH = "Submission.lean";
export const MAX_SUBMISSION_FILES = 32;
export const MAX_SUBMISSION_FILE_BYTES = 256 * 1024;
export const MAX_SUBMISSION_TOTAL_BYTES = 1024 * 1024;
export const MAX_SUBMISSION_DEPTH = 4;

const SEGMENT_RE = /^[A-Za-z_][A-Za-z0-9_']*$/;
const WINDOWS_RESERVED_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

export type SolutionFiles = Record<string, string>;

export interface SolutionFilesValidation {
  ok: boolean;
  errors: string[];
  files: SolutionFiles;
  totalBytes: number;
}

export function validateSubmissionPath(path: string): string | null {
  if (path === ROOT_SUBMISSION_PATH) return null;
  if (!path || CONTROL_RE.test(path) || path.includes("\\")) {
    return "Path contains invalid characters.";
  }
  if (path.startsWith("/") || path.includes("..") || path.startsWith(".")) {
    return "Path must be relative, visible, and may not contain '..'.";
  }
  if (!path.startsWith("Submission/") || !path.endsWith(".lean")) {
    return "Only Submission.lean and Submission/**/*.lean are allowed.";
  }

  const relative = path.slice("Submission/".length, -".lean".length);
  const segments = relative.split("/");
  if (segments.length < 1 || segments.length > MAX_SUBMISSION_DEPTH) {
    return `Modules under Submission/ may be at most ${MAX_SUBMISSION_DEPTH} levels deep.`;
  }
  if (
    segments.some(
      (segment) =>
        !SEGMENT_RE.test(segment) || WINDOWS_RESERVED_RE.test(segment),
    )
  ) {
    return "Every module path segment must be a valid Lean identifier.";
  }
  return null;
}

export function validateSolutionFiles(value: unknown): SolutionFilesValidation {
  const errors: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      ok: false,
      errors: ["files must be an object mapping paths to source code."],
      files: {},
      totalBytes: 0,
    };
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length < 1 || entries.length > MAX_SUBMISSION_FILES) {
    errors.push(`File count must be between 1 and ${MAX_SUBMISSION_FILES}.`);
  }

  const files: SolutionFiles = {};
  const folded = new Set<string>();
  let totalBytes = 0;
  for (const [path, source] of entries) {
    const pathError = validateSubmissionPath(path);
    if (pathError) errors.push(`${path}: ${pathError}`);
    const key = path.toLocaleLowerCase("en-US");
    if (folded.has(key)) {
      errors.push(`${path}: another file differs only by letter case.`);
    }
    folded.add(key);

    if (typeof source !== "string") {
      errors.push(`${path}: file contents must be a string.`);
      continue;
    }
    const bytes = new TextEncoder().encode(source).byteLength;
    totalBytes += bytes;
    if (!source.trim()) errors.push(`${path}: file may not be empty.`);
    if (bytes > MAX_SUBMISSION_FILE_BYTES) {
      errors.push(`${path}: a single file may not exceed 256 KiB.`);
    }
    files[path] = source;
  }

  if (!(ROOT_SUBMISSION_PATH in files)) {
    errors.push(`The submission must contain ${ROOT_SUBMISSION_PATH}.`);
  }
  if (totalBytes > MAX_SUBMISSION_TOTAL_BYTES) {
    errors.push("Total submission source may not exceed 1 MiB.");
  }

  return { ok: errors.length === 0, errors, files, totalBytes };
}

export function canonicalSolutionJson(files: SolutionFiles): string {
  const ordered = Object.fromEntries(
    Object.entries(files).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
  return JSON.stringify(ordered);
}

export function pathToModule(path: string): string | null {
  if (path === ROOT_SUBMISSION_PATH) return "Submission";
  if (validateSubmissionPath(path)) return null;
  return path.slice(0, -".lean".length).replaceAll("/", ".");
}

/** Best-effort UI hint only; Lean/comparator remains authoritative. */
export function findUnreachableSubmissionFiles(files: SolutionFiles): string[] {
  const byModule = new Map<string, string>();
  for (const path of Object.keys(files)) {
    const module = pathToModule(path);
    if (module) byModule.set(module, path);
  }

  const reachable = new Set<string>([ROOT_SUBMISSION_PATH]);
  const queue = [ROOT_SUBMISSION_PATH];
  const importRe = /^\s*import\s+([A-Za-z_][A-Za-z0-9_'.]*)\s*$/gm;
  while (queue.length) {
    const path = queue.shift()!;
    const source = files[path] ?? "";
    for (const match of source.matchAll(importRe)) {
      const imported = byModule.get(match[1]);
      if (imported && !reachable.has(imported)) {
        reachable.add(imported);
        queue.push(imported);
      }
    }
  }
  return Object.keys(files).filter(
    (path) => path !== ROOT_SUBMISSION_PATH && !reachable.has(path),
  );
}
