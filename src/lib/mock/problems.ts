import type { ChallengeProblem } from "@/lib/types";

const DEFAULT_AXIOMS = ["propext", "Quot.sound", "Classical.choice"];

export const problems: ChallengeProblem[] = [
  {
    id: "pr_imo_2019_p1",
    project_id: "p_imo",
    slug: "imo-2019-p1",
    order_index: 1,
    title: {
      en: "IMO 2019 Problem 1 — Cauchy-like functional equation",
      zh: "IMO 2019 第 1 题 —— 类柯西函数方程",
    },
    statement: {
      en: "Let $f : \\mathbb{Z} \\to \\mathbb{Z}$ satisfy\n\n$$f(2a) + 2f(b) = f(f(a+b))$$\n\nfor all integers $a, b$. Show that $f$ is either identically zero, or of the form $f(x) = 2x + c$ for some constant $c$.\n\nThe Lean statement fixes the conclusion as a disjunction; you must prove that disjunction, not merely one branch.",
      zh: "设 $f : \\mathbb{Z} \\to \\mathbb{Z}$ 对所有整数 $a, b$ 满足\n\n$$f(2a) + 2f(b) = f(f(a+b))$$\n\n证明 $f$ 要么恒为零，要么形如 $f(x) = 2x + c$（$c$ 为常数）。\n\nLean 陈述把结论固定为一个析取式；你需要证明整个析取式，而不只是其中一支。",
    },
    challenge_lean_path: "Challenge/Imo2019P1.lean",
    challenge_lean_source: `import Mathlib.Tactic

/-- IMO 2019 Problem 1. Do not modify this statement. -/
theorem imo_2019_p1 (f : Int → Int)
    (hf : ∀ a b : Int, f (2 * a) + 2 * f b = f (f (a + b))) :
    (∀ z : Int, f z = 0) ∨ ∃ c : Int, ∀ z : Int, f z = 2 * z + c := by
  sorry
`,
    solution_module: "Solution",
    theorem_names: ["imo_2019_p1"],
    permitted_axioms: DEFAULT_AXIOMS,
    definition_names: [],
    enable_nanoda: true,
    bonus_points: 120,
    deadline: null,
    status: "open",
  },
  {
    id: "pr_imo_2021_p2",
    project_id: "p_imo",
    slug: "imo-2021-p2",
    order_index: 2,
    title: {
      en: "IMO 2021 Problem 2 — Square root inequality",
      zh: "IMO 2021 第 2 题 —— 平方根不等式",
    },
    statement: {
      en: "Show that for all real numbers $x_1, \\dots, x_n$,\n\n$$\\sum_{i=1}^{n}\\sum_{j=1}^{n} \\sqrt{|x_i - x_j|} \\le \\sum_{i=1}^{n}\\sum_{j=1}^{n} \\sqrt{|x_i + x_j|}.$$\n\nThis one is genuinely hard to formalize; the real-analysis lemmas you need are all present in Mathlib, but assembling them is the work.",
      zh: "证明对任意实数 $x_1, \\dots, x_n$ 有\n\n$$\\sum_{i=1}^{n}\\sum_{j=1}^{n} \\sqrt{|x_i - x_j|} \\le \\sum_{i=1}^{n}\\sum_{j=1}^{n} \\sqrt{|x_i + x_j|}.$$\n\n这道题的形式化确实很难；所需的实分析引理 Mathlib 里都有，难点在于把它们组装起来。",
    },
    challenge_lean_path: "Challenge/Imo2021P2.lean",
    challenge_lean_source: `import Mathlib.Tactic
import Mathlib.Analysis.SpecialFunctions.Sqrt

/-- IMO 2021 Problem 2. Do not modify this statement. -/
theorem imo_2021_p2 (n : Nat) (x : Fin n → Real) :
    ∑ i, ∑ j, Real.sqrt |x i - x j| ≤ ∑ i, ∑ j, Real.sqrt |x i + x j| := by
  sorry
`,
    solution_module: "Solution",
    theorem_names: ["imo_2021_p2"],
    permitted_axioms: DEFAULT_AXIOMS,
    definition_names: [],
    enable_nanoda: true,
    bonus_points: 200,
    deadline: "2026-12-31T23:59:00Z",
    status: "open",
  },
  {
    id: "pr_bertrand",
    project_id: "p_primes",
    slug: "bertrand-postulate",
    order_index: 1,
    title: {
      en: "Bertrand's postulate",
      zh: "伯特兰假设",
    },
    statement: {
      en: "For every natural number $n \\ge 1$ there exists a prime $p$ with $n < p \\le 2n$.\n\nMathlib already contains `Nat.exists_prime_lt_and_le_two_mul`, but the permitted axiom list is unchanged, so a one-line `exact` is a perfectly valid solution. Consider it a smoke test of your submission pipeline.",
      zh: "对每个自然数 $n \\ge 1$，存在素数 $p$ 使得 $n < p \\le 2n$。\n\nMathlib 里已有 `Nat.exists_prime_lt_and_le_two_mul`，而允许公理列表未作限制，因此一行 `exact` 就是完全合法的解答。把它当作提交流程的冒烟测试。",
    },
    challenge_lean_path: "Challenge/Bertrand.lean",
    challenge_lean_source: `import Mathlib.NumberTheory.Bertrand

/-- Bertrand's postulate. Do not modify this statement. -/
theorem bertrand_postulate (n : Nat) (hn : 1 ≤ n) :
    ∃ p : Nat, p.Prime ∧ n < p ∧ p ≤ 2 * n := by
  sorry
`,
    solution_module: "Solution",
    theorem_names: ["bertrand_postulate"],
    permitted_axioms: DEFAULT_AXIOMS,
    definition_names: [],
    enable_nanoda: false,
    bonus_points: 20,
    deadline: null,
    status: "open",
  },
  {
    id: "pr_chebyshev",
    project_id: "p_primes",
    slug: "chebyshev-lower-bound",
    order_index: 2,
    title: {
      en: "Explicit Chebyshev lower bound",
      zh: "显式切比雪夫下界",
    },
    statement: {
      en: "Supply an explicit constant $c > 0$ and prove\n\n$$\\pi(x) \\ge c \\cdot \\frac{x}{\\log x} \\quad \\text{for all } x \\ge 2.$$\n\nThe challenge file leaves the constant as a **definition hole**: you provide both the value and the proof. Because comparator cannot rule out a degenerate choice on its own, passing submissions enter manual review before scoring.",
      zh: "给出一个显式常数 $c > 0$ 并证明\n\n$$\\pi(x) \\ge c \\cdot \\frac{x}{\\log x} \\quad \\text{对所有 } x \\ge 2.$$\n\n挑战文件把该常数留作**定义空洞**：取值与证明都由你提供。由于 comparator 本身无法排除退化取值，通过的提交会先进入人工复核再计分。",
    },
    challenge_lean_path: "Challenge/Chebyshev.lean",
    challenge_lean_source: `import Mathlib.NumberTheory.PrimeCounting

/-- Definition hole: the solver supplies the constant. -/
def chebyshevConst : Real := sorry

/-- Explicit Chebyshev lower bound. Do not modify this statement. -/
theorem chebyshev_lower (x : Real) (hx : 2 ≤ x) :
    chebyshevConst > 0 ∧
    (Nat.primeCounting ⌊x⌋₊ : Real) ≥ chebyshevConst * x / Real.log x := by
  sorry
`,
    solution_module: "Solution",
    theorem_names: ["chebyshev_lower"],
    permitted_axioms: DEFAULT_AXIOMS,
    definition_names: ["chebyshevConst"],
    enable_nanoda: true,
    bonus_points: 150,
    deadline: null,
    status: "open",
  },
  {
    id: "pr_sigma_algebra",
    project_id: "p_measure",
    slug: "sigma-algebra-closure",
    order_index: 1,
    title: {
      en: "Sigma-algebras are closed under countable intersection",
      zh: "σ-代数对可数交封闭",
    },
    statement: {
      en: "Given a sigma-algebra $\\mathcal{A}$ on a set $X$ and a countable family $(A_n)_{n \\in \\mathbb{N}}$ of members of $\\mathcal{A}$, show that $\\bigcap_n A_n \\in \\mathcal{A}$.\n\nA short warm-up. Expect the whole verification to finish in under a minute.",
      zh: "给定集合 $X$ 上的 σ-代数 $\\mathcal{A}$ 与一族可数的成员 $(A_n)_{n \\in \\mathbb{N}}$，证明 $\\bigcap_n A_n \\in \\mathcal{A}$。\n\n一道短热身题。整个验证预计一分钟内完成。",
    },
    challenge_lean_path: "Challenge/SigmaAlgebra.lean",
    challenge_lean_source: `import Mathlib.MeasureTheory.MeasurableSpace.Basic

/-- Countable intersections stay measurable. Do not modify this statement. -/
theorem measurable_iInter {X : Type*} [MeasurableSpace X]
    (A : Nat → Set X) (hA : ∀ n, MeasurableSet (A n)) :
    MeasurableSet (⋂ n, A n) := by
  sorry
`,
    solution_module: "Solution",
    theorem_names: ["measurable_iInter"],
    permitted_axioms: DEFAULT_AXIOMS,
    definition_names: [],
    enable_nanoda: false,
    bonus_points: 15,
    deadline: null,
    status: "open",
  },
  {
    id: "pr_monotone_conv",
    project_id: "p_measure",
    slug: "monotone-convergence",
    order_index: 2,
    title: {
      en: "Monotone convergence for indicator sums",
      zh: "指示函数和的单调收敛",
    },
    statement: {
      en: "Let $(A_n)$ be an increasing sequence of measurable sets. Show that\n\n$$\\mu\\Big(\\bigcup_n A_n\\Big) = \\lim_{n \\to \\infty} \\mu(A_n).$$\n\nSlightly longer than the first warm-up, but still a single-file solution.",
      zh: "设 $(A_n)$ 是一列递增的可测集。证明\n\n$$\\mu\\Big(\\bigcup_n A_n\\Big) = \\lim_{n \\to \\infty} \\mu(A_n).$$\n\n比第一道热身题稍长，但仍是单文件解答。",
    },
    challenge_lean_path: "Challenge/MonotoneConv.lean",
    challenge_lean_source: `import Mathlib.MeasureTheory.Measure.MeasureSpace

open MeasureTheory

/-- Continuity from below. Do not modify this statement. -/
theorem measure_iUnion_monotone {X : Type*} [MeasurableSpace X]
    (mu : Measure X) (A : Nat → Set X)
    (hA : ∀ n, MeasurableSet (A n)) (hmono : Monotone A) :
    mu (⋃ n, A n) = ⨆ n, mu (A n) := by
  sorry
`,
    solution_module: "Solution",
    theorem_names: ["measure_iUnion_monotone"],
    permitted_axioms: DEFAULT_AXIOMS,
    definition_names: [],
    enable_nanoda: false,
    bonus_points: 25,
    deadline: null,
    status: "open",
  },
];
