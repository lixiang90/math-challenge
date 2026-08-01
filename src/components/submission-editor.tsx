"use client";

import * as React from "react";
import { FilePlus2, Trash2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import {
  findUnreachableSubmissionFiles,
  ROOT_SUBMISSION_PATH,
  validateSolutionFiles,
  validateSubmissionPath,
  type SolutionFiles,
} from "@/lib/lean-paths";

export function SubmissionEditor({
  files,
  onChange,
  disabled,
}: {
  files: SolutionFiles;
  onChange: (files: SolutionFiles) => void;
  disabled?: boolean;
}) {
  const paths = React.useMemo(() => Object.keys(files), [files]);
  const [active, setActive] = React.useState(paths[0] ?? ROOT_SUBMISSION_PATH);
  const [newPath, setNewPath] = React.useState("Submission/Lemmas.lean");
  const [pathError, setPathError] = React.useState<string | null>(null);
  const unreachable = React.useMemo(
    () => new Set(findUnreachableSubmissionFiles(files)),
    [files],
  );

  React.useEffect(() => {
    if (!(active in files)) setActive(Object.keys(files)[0] ?? ROOT_SUBMISSION_PATH);
  }, [active, files]);

  function addFile() {
    const path = newPath.trim();
    const error = validateSubmissionPath(path);
    if (error) return setPathError(error);
    if (path in files) return setPathError("这个文件已经存在。");
    setPathError(null);
    onChange({ ...files, [path]: `namespace ${path.slice(0, -5).replaceAll("/", ".")}\n\nend ${path.slice(0, -5).replaceAll("/", ".")}\n` });
    setActive(path);
  }

  function removeFile(path: string) {
    if (path === ROOT_SUBMISSION_PATH) return;
    const next = { ...files };
    delete next[path];
    onChange(next);
  }

  const validation = validateSolutionFiles(files);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {paths.map((path) => (
          <button
            type="button"
            key={path}
            onClick={() => setActive(path)}
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 font-mono text-[11.5px] transition-colors ${
              active === path
                ? "border-accent bg-accent-soft text-accent"
                : "border-rule bg-surface-2 text-ink-muted hover:text-ink"
            }`}
          >
            {unreachable.has(path) && <Unlink className="size-3 text-pending" />}
            {path}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-rule bg-surface-3">
        <div className="flex items-center justify-between border-b border-rule px-3 py-2">
          <code className="text-[12px] text-ink-muted">{active}</code>
          {active !== ROOT_SUBMISSION_PATH && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => removeFile(active)}
              className="text-ink-faint hover:text-fail disabled:opacity-50"
              aria-label={`Delete ${active}`}
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
        <textarea
          value={files[active] ?? ""}
          disabled={disabled}
          onChange={(event) => onChange({ ...files, [active]: event.target.value })}
          spellCheck={false}
          className="min-h-72 w-full resize-y bg-transparent p-3 font-mono text-[12.5px] leading-relaxed text-ink outline-none disabled:opacity-60"
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={newPath}
          disabled={disabled}
          onChange={(event) => {
            setNewPath(event.target.value);
            setPathError(null);
          }}
          className="font-mono text-[12px]"
          placeholder="Submission/Lemmas.lean"
        />
        <Button type="button" variant="outline" disabled={disabled} onClick={addFile}>
          <FilePlus2 className="size-4" />
          Add file
        </Button>
      </div>
      {pathError && <p className="text-[12px] text-fail">{pathError}</p>}
      {unreachable.size > 0 && (
        <p className="text-[12px] text-pending">
          带断链图标的文件无法从 Submission.lean 的 import 图到达，不会参与编译。
        </p>
      )}
      {!validation.ok && (
        <ul className="space-y-1 text-[12px] text-fail">
          {validation.errors.slice(0, 4).map((error) => <li key={error}>{error}</li>)}
        </ul>
      )}
    </div>
  );
}
