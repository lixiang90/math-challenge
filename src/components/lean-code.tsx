import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Minimal Lean 4 highlighter.
 *
 * Deliberately dependency-free: Prism and Shiki have no first-class Lean
 * grammar, and pulling a WASM highlighter into the bundle for a read-only
 * snippet is not worth it.
 */

const KEYWORDS = [
  "theorem", "lemma", "def", "abbrev", "example", "import", "open", "namespace",
  "end", "by", "fun", "let", "have", "show", "from", "match", "with", "do",
  "if", "then", "else", "axiom", "instance", "structure", "inductive", "class",
  "variable", "universe", "noncomputable", "private", "protected", "partial",
  "mutual", "where", "deriving", "attribute", "section", "set_option", "exact",
  "intro", "apply", "simp", "omega", "rfl", "calc", "at", "using",
];

const TYPES = [
  "Nat", "Int", "Real", "Prop", "Type", "Sort", "Set", "Fin", "List", "Bool",
  "Measure", "MeasurableSet", "Monotone", "Prime", "MeasureTheory",
];

const PATTERN = new RegExp(
  [
    "(/-[\\s\\S]*?-/)",
    "(--[^\\n]*)",
    '("(?:[^"\\\\]|\\\\.)*")',
    "\\b(sorry)\\b",
    `\\b(${KEYWORDS.join("|")})\\b`,
    `\\b(${TYPES.join("|")})\\b`,
    "([∀∃→↔∧∨¬≤≥≠∈∉⊆∑∏⋂⋃√λ↦⟨⟩⌊⌋₊])",
  ].join("|"),
  "g"
);

const CLASS_BY_GROUP: Record<number, string> = {
  1: "text-lean-comment italic",
  2: "text-lean-comment italic",
  3: "text-lean-green",
  4: "rounded bg-fail-soft px-0.5 font-medium text-fail",
  5: "font-medium text-lean-keyword",
  6: "text-lean-gold",
  7: "text-lean-purple",
};

function tokenize(source: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  PATTERN.lastIndex = 0;

  for (let m = PATTERN.exec(source); m; m = PATTERN.exec(source)) {
    if (m.index > last) out.push(source.slice(last, m.index));
    const group = m.slice(1).findIndex((g) => g !== undefined) + 1;
    out.push(
      <span key={key++} className={CLASS_BY_GROUP[group]}>
        {m[0]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < source.length) out.push(source.slice(last));
  return out;
}

export function LeanCode({
  source,
  filename,
  className,
}: {
  source: string;
  filename?: string;
  className?: string;
}) {
  const lineCount = source.replace(/\n$/, "").split("\n").length;

  return (
    <figure
      className={cn(
        "overflow-hidden rounded-lg border border-rule bg-surface-code",
        className
      )}
    >
      {filename && (
        <figcaption className="flex items-center justify-between border-b border-rule bg-surface-code-bar px-3 py-1.5 font-mono text-[12px] text-ink-muted">
          {filename}
        </figcaption>
      )}
      <div className="flex overflow-x-auto">
        <div
          aria-hidden
          className="shrink-0 select-none border-r border-rule bg-surface-code-gutter px-2.5 py-3 text-right font-mono text-[12px] leading-[1.55] text-ink-faint"
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <pre className="min-w-0 flex-1 px-3.5 py-3 font-mono text-[12.5px] leading-[1.55] text-ink">
          <code>{tokenize(source.replace(/\n$/, ""))}</code>
        </pre>
      </div>
    </figure>
  );
}
