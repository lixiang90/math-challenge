import type { FileNode, I18nText, Project } from "@/lib/types";

const leanTree: FileNode[] = [
  {
    name: "Formalia",
    type: "dir",
    children: [
      { name: "Basic.lean", type: "file", size: 4213 },
      { name: "Lemmas.lean", type: "file", size: 11894 },
      { name: "Challenge.lean", type: "file", size: 1620 },
    ],
  },
  { name: "lakefile.lean", type: "file", size: 412 },
  { name: "lean-toolchain", type: "file", size: 19 },
  { name: "README.md", type: "file", size: 3180 },
  { name: "LICENSE", type: "file", size: 1071 },
];

/**
 * Mock seed projects. Shape mirrors the real Supabase `projects` row:
 * long-form body lives in Storage under `content_path` (mirrored here as the
 * `body` field for offline rendering), so `description`/`readme`/`file_tree`
 * are no longer columns. `file_tree` is fetched live from GitHub in the data
 * layer (`fetchGithubFileTree`) and falls back to `leanTree` in mock mode.
 */
export const projects: (Project & { body?: I18nText })[] = [
  {
    id: "p_analysis",
    slug: "elementary-real-analysis",
    owner_id: "u_ai",
    type: "normal",
    title: {
      en: "Elementary Real Analysis in Lean 4",
      zh: "Lean 4 中的初等实分析",
    },
    summary: {
      en: "A self-contained formalization of limits, continuity and the Riemann integral, written to be readable rather than clever.",
      zh: "极限、连续性与黎曼积分的自洽形式化，追求可读性而非技巧性。",
    },
    content_path: "projects/elementary-real-analysis",
    content_locales: ["en", "zh"],
    body: {
      en: "# Elementary Real Analysis\n\nA readable Lean 4 formalization of a first analysis course. Every definition mirrors the one you would meet in a textbook, and each proof is annotated so students can follow the formal argument alongside the informal one.\n\nThe library deliberately avoids heavy Mathlib automation in the core chapters, so readers can see the epsilon-delta reasoning explicitly.",
      zh: "# 初等实分析\n\n一份可读的 Lean 4 实分析初级课程形式化。每个定义都对应教科书中的写法，每个证明都附有注释，方便学生对照形式化论证与非形式化论证。\n\n核心章节刻意避免使用重度的 Mathlib 自动化，让读者能看清推理的每一步。",
    },
    repo_url: "https://github.com/formalia/elementary-real-analysis",
    default_branch: "main",
    difficulty: "easy",
    tags: ["analysis", "teaching", "mathlib"],
    status: "published",
    managed_by_sync: false,
    created_at: "2026-02-14T09:00:00Z",
    updated_at: "2026-07-21T11:30:00Z",
  },
  {
    id: "p_imo",
    slug: "imo-formalization-challenge",
    owner_id: "u_tanaka",
    type: "challenge",
    title: {
      en: "IMO Formalization Challenge",
      zh: "IMO 形式化挑战",
    },
    summary: {
      en: "Olympiad problems restated as Lean theorems. Prove them, submit your repository, get a machine verdict.",
      zh: "把奥数题重述为 Lean 定理。证明它，提交仓库，由机器给出判定。",
    },
    content_path: "projects/imo-formalization-challenge",
    content_locales: ["en", "zh"],
    body: {
      en: "# IMO Formalization Challenge\n\nFormal statements of IMO problems, graded by comparator. Each problem is a faithful Lean 4 statement of an International Mathematical Olympiad problem. The statement is fixed and trusted. Your job is to supply a proof term that the comparator accepts.\n\nSubmissions are checked in a sandbox: your solution must prove exactly the stated theorem, using only the permitted axioms, and must be accepted by the Lean kernel.",
      zh: "# IMO 形式化挑战\n\nIMO 题目的形式化陈述，由 comparator 评判。每道题都是国际数学奥林匹克题目的忠实 Lean 4 陈述。命题是固定且受信的。你要做的是给出一个 comparator 能接受的证明项。\n\n提交会在沙箱中检查：你的解答必须恰好证明所述定理，只能使用允许的公理，并且要被 Lean 内核接受。",
    },
    repo_url: "https://github.com/formalia/imo-challenge",
    default_branch: "main",
    difficulty: "hard",
    tags: ["olympiad", "challenge", "number-theory", "combinatorics"],
    status: "published",
    managed_by_sync: false,
    created_at: "2026-03-02T04:00:00Z",
    updated_at: "2026-07-28T16:45:00Z",
  },
  {
    id: "p_topos",
    slug: "topos-theory-notes",
    owner_id: "u_dubois",
    type: "normal",
    title: {
      en: "Topos Theory Working Notes",
      zh: "拓扑斯理论工作笔记",
    },
    summary: {
      en: "Ongoing formalization of elementary topoi, subobject classifiers and sheaf semantics.",
      zh: "初等拓扑斯、子对象分类子与层语义的持续形式化。",
    },
    content_path: "projects/topos-theory-notes",
    content_locales: ["en", "zh"],
    body: {
      en: "# Topos Theory Working Notes\n\nA working repository rather than a polished library. Expect churn: definitions get renamed, proofs get golfed, and whole files occasionally disappear.\n\nThe long term goal is a usable internal language interface for reasoning inside a topos.",
      zh: "# 拓扑斯理论工作笔记\n\n这是一个工作仓库，而非成品库。请预期频繁变动：定义会改名，证明会被压缩，整个文件偶尔会消失。\n\n长期目标是提供一套可用的内部语言接口，用于在拓扑斯内部进行推理。",
    },
    repo_url: "https://github.com/formalia/topos-notes",
    default_branch: "main",
    difficulty: "research",
    tags: ["category-theory", "topos", "wip"],
    status: "published",
    managed_by_sync: false,
    created_at: "2026-04-19T12:00:00Z",
    updated_at: "2026-07-30T08:10:00Z",
  },
  {
    id: "p_primes",
    slug: "prime-gaps-challenge",
    owner_id: "u_mei",
    type: "challenge",
    title: {
      en: "Prime Gaps and Elementary Bounds",
      zh: "素数间隙与初等界",
    },
    summary: {
      en: "A graded ladder of number-theory problems, from Bertrand's postulate up to explicit Chebyshev bounds.",
      zh: "一组由浅入深的数论题，从伯特兰假设到显式切比雪夫界。",
    },
    content_path: "projects/prime-gaps-challenge",
    content_locales: ["en", "zh"],
    body: {
      en: "# Prime Gaps\n\nElementary prime counting results, organized as a graded challenge set. Problems are ordered so that each one reuses lemmas you proved in the previous step.\n\nOne problem in this set uses definition holes: the challenge file leaves a bound as a placeholder and you must supply both the value and the proof. Those submissions enter manual review.",
      zh: "# 素数间隙\n\n初等素数计数结果，组织为分级挑战题集。题目按顺序排列，每道题都会复用你在上一步证明的引理。\n\n本组中有一道题使用了定义空洞：挑战文件把一个界留作占位符，你需要同时给出取值与证明。这类提交会进入人工复核。",
    },
    repo_url: "https://github.com/formalia/prime-gaps",
    default_branch: "main",
    difficulty: "medium",
    tags: ["number-theory", "challenge", "primes"],
    status: "published",
    managed_by_sync: false,
    created_at: "2026-01-28T07:30:00Z",
    updated_at: "2026-07-25T13:20:00Z",
  },
  {
    id: "p_tactics",
    slug: "tactic-cookbook",
    owner_id: "u_kovacs",
    type: "normal",
    title: {
      en: "Lean 4 Tactic Cookbook",
      zh: "Lean 4 策略手册",
    },
    summary: {
      en: "Short, runnable recipes for the tactics people actually reach for, with failure modes documented.",
      zh: "一份简短可运行的常用策略配方集，并记录了各自的失败模式。",
    },
    content_path: "projects/tactic-cookbook",
    content_locales: ["en", "zh"],
    body: {
      en: "# Tactic Cookbook\n\nShort, runnable recipes for the tactics people actually reach for, with failure modes documented. Every entry is a single file you can open and step through.\n\nWhere a tactic commonly fails, the file includes the failing case and explains the error message rather than hiding it.",
      zh: "# 策略手册\n\n一份简短可运行的常用策略配方集，并记录了各自的失败模式。每个条目都是一个可以直接打开并逐步执行的文件。\n\n对于策略常见的失败场景，文件会保留失败用例并解释报错信息，而不是把它藏起来。",
    },
    repo_url: "https://github.com/formalia/tactic-cookbook",
    default_branch: "main",
    difficulty: "intro",
    tags: ["tactics", "teaching", "reference"],
    status: "published",
    managed_by_sync: false,
    created_at: "2025-12-05T15:00:00Z",
    updated_at: "2026-06-11T09:55:00Z",
  },
  {
    id: "p_measure",
    slug: "measure-theory-challenge",
    owner_id: "u_ortiz",
    type: "challenge",
    title: {
      en: "Measure Theory Warm-ups",
      zh: "测度论热身",
    },
    summary: {
      en: "Two short problems on sigma-algebras and monotone convergence, aimed at people new to comparator submissions.",
      zh: "两道关于 σ-代数与单调收敛的短题，面向初次使用 comparator 提交的人。",
    },
    content_path: "projects/measure-theory-challenge",
    content_locales: ["en", "zh"],
    body: {
      en: "# Measure Theory Warm ups\n\nTwo small problems aimed at people new to comparator submissions. The statements are small enough that the whole build finishes quickly, so you get feedback on your workflow before tackling anything hard.",
      zh: "# 测度论热身\n\n两道关于 sigma 代数与单调收敛的短题，面向初次使用 comparator 提交的人。命题足够小，整个构建很快就能跑完，你可以在挑战难题之前先跑通自己的工作流。",
    },
    repo_url: "https://github.com/formalia/measure-warmups",
    default_branch: "main",
    difficulty: "easy",
    tags: ["measure-theory", "challenge", "beginner"],
    status: "published",
    managed_by_sync: false,
    created_at: "2026-05-16T11:00:00Z",
    updated_at: "2026-07-19T10:05:00Z",
  },
  {
    id: "p_verify",
    slug: "comparator-playground",
    owner_id: "u_kovacs",
    type: "normal",
    title: {
      en: "Comparator Playground",
      zh: "Comparator 试验场",
    },
    summary: {
      en: "A minimal reference setup showing exactly what the verifier runs, including the config.json it generates.",
      zh: "一个最小参考配置，展示验证器到底跑了什么，包括它生成的 config.json。",
    },
    content_path: "projects/comparator-playground",
    content_locales: ["en", "zh"],
    body: {
      en: "# Comparator Playground\n\nA minimal reference setup showing exactly what the verifier runs. Useful if you want to reproduce a verdict locally before submitting. The repository contains a fake landrun shim for non Linux development and a script that mirrors the CI invocation exactly.",
      zh: "# Comparator 试验场\n\n一个最小参考配置，展示验证器到底跑了什么。如果你想在提交前本地复现判定结果，这个仓库很有用。它包含一个用于非 Linux 开发的 fake landrun 垫片，以及一个与 CI 调用完全一致的脚本。",
    },
    repo_url: "https://github.com/formalia/comparator-playground",
    default_branch: "main",
    difficulty: "intro",
    tags: ["tooling", "comparator", "reference"],
    status: "published",
    managed_by_sync: false,
    created_at: "2026-06-08T18:40:00Z",
    updated_at: "2026-07-29T21:15:00Z",
  },
  {
    id: "p_graph",
    slug: "graph-theory-basics",
    owner_id: "u_tanaka",
    type: "normal",
    title: {
      en: "Graph Theory Basics",
      zh: "图论基础",
    },
    summary: {
      en: "Simple graphs, connectivity, trees and Euler tours, kept deliberately independent of Mathlib's combinatorics API.",
      zh: "简单图、连通性、树与欧拉回路，刻意不依赖 Mathlib 的组合学 API。",
    },
    content_path: "projects/graph-theory-basics",
    content_locales: ["en", "zh"],
    body: {
      en: "# Graph Theory Basics\n\nA from scratch treatment of simple graphs, connectivity, trees and Euler tours, kept deliberately independent of Mathlib combinatorics API. Written as a teaching artifact with unusually explicit definitions.",
      zh: "# 图论基础\n\n简单图、连通性、树与欧拉回路，刻意不依赖 Mathlib 的组合学 API。作为教学材料编写，定义格外显式，证明也比必要的更长，这正是目的所在。",
    },
    repo_url: "https://github.com/formalia/graph-basics",
    default_branch: "main",
    difficulty: "easy",
    tags: ["combinatorics", "graphs", "teaching"],
    status: "published",
    managed_by_sync: false,
    created_at: "2026-05-02T08:20:00Z",
    updated_at: "2026-07-12T17:00:00Z",
  },
];

export { leanTree };
