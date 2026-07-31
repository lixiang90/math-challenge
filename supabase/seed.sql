-- =============================================================================
-- math-challenge — 演示数据 Seed (P2-5)
-- 将 P1 的 mock 项目/题目灌入真实 Supabase 表，使首页换真查询后有内容。
-- owner_id 自动绑定到 github_login = 'lixiang90' 的真实 profile。
-- 在 Supabase Dashboard → SQL Editor 执行（service_role 上下文，可绕过 RLS）。
-- 幂等：重复执行会因 unique(slug) / unique(project_id, slug) 跳过。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. projects
-- -----------------------------------------------------------------------------

insert into public.projects (
  id, slug, owner_id, type, title, summary, description, repo_url, default_branch,
  difficulty, tags, status, readme, file_tree, created_at, updated_at
) values (
  gen_random_uuid(),
  'elementary-real-analysis',
  (select id from public.profiles where github_login = 'lixiang90' limit 1),
  'normal',
  $j${"en": "Elementary Real Analysis in Lean 4", "zh": "Lean 4 中的初等实分析"}$j$::jsonb,
  $j${"en": "A self-contained formalization of limits, continuity and the Riemann integral, written to be readable rather than clever.", "zh": "极限、连续性与黎曼积分的自洽形式化，追求可读性而非技巧性。"}$j$::jsonb,
  $j${"en": "This project rebuilds a first-course real analysis syllabus from the ground up. Every definition mirrors the one you would meet in a textbook, and each proof is annotated so students can follow the formal argument alongside the informal one.\n\nThe library deliberately avoids heavy Mathlib automation in the core chapters, so readers can see the epsilon-delta reasoning explicitly.", "zh": "本项目从零重建一门实分析初级课程的大纲。每个定义都对应教科书中的写法，每个证明都附有注释，方便学生对照形式化论证与非形式化论证。\n\n核心章节刻意避免使用重度的 Mathlib 自动化，让读者能看清 ε-δ 推理的每一步。"}$j$::jsonb,
  'https://github.com/formalia/elementary-real-analysis',
  'main',
  'easy',
  array['analysis', 'teaching', 'mathlib']::text[],
  'published',
  $j${"en": "# Elementary Real Analysis\n\nA readable Lean 4 formalization of a first analysis course.\n\n## Contents\n\n| Chapter | File | Status |\n| --- | --- | --- |\n| Sequences and limits | `Analysis/Sequences.lean` | complete |\n| Continuity | `Analysis/Continuity.lean` | complete |\n| Differentiation | `Analysis/Deriv.lean` | in progress |\n| Riemann integral | `Analysis/Riemann.lean` | draft |\n\n## Design notes\n\nWe define convergence directly:\n\n$$\\lim_{n\\to\\infty} a_n = L \\iff \\forall \\varepsilon > 0,\\ \\exists N,\\ \\forall n \\ge N,\\ |a_n - L| < \\varepsilon$$\n\nrather than going through filters, so that the formal statement matches the textbook one character for character.\n\n## Building\n\n```bash\nlake exe cache get\nlake build\n```\n", "zh": "# 初等实分析\n\n一份可读的 Lean 4 实分析初级课程形式化。\n\n## 目录\n\n| 章节 | 文件 | 状态 |\n| --- | --- | --- |\n| 数列与极限 | `Analysis/Sequences.lean` | 已完成 |\n| 连续性 | `Analysis/Continuity.lean` | 已完成 |\n| 微分 | `Analysis/Deriv.lean` | 进行中 |\n| 黎曼积分 | `Analysis/Riemann.lean` | 草稿 |\n\n## 设计说明\n\n我们直接定义收敛：\n\n$$\\lim_{n\\to\\infty} a_n = L \\iff \\forall \\varepsilon > 0,\\ \\exists N,\\ \\forall n \\ge N,\\ |a_n - L| < \\varepsilon$$\n\n而不经由 filter，这样形式化命题能与教科书写法逐字对应。\n\n## 构建\n\n```bash\nlake exe cache get\nlake build\n```\n"}$j$::jsonb,
  '[{"name":"Formalia","type":"dir","children":[{"name":"Basic.lean","type":"file","size":4213},{"name":"Lemmas.lean","type":"file","size":11894},{"name":"Challenge.lean","type":"file","size":1620}]},{"name":"lakefile.lean","type":"file","size":412},{"name":"lean-toolchain","type":"file","size":19},{"name":"README.md","type":"file","size":3180},{"name":"LICENSE","type":"file","size":1071}]'::jsonb,
  '2026-02-14T09:00:00Z',
  '2026-07-21T11:30:00Z'
);

insert into public.projects (
  id, slug, owner_id, type, title, summary, description, repo_url, default_branch,
  difficulty, tags, status, readme, file_tree, created_at, updated_at
) values (
  gen_random_uuid(),
  'imo-formalization-challenge',
  (select id from public.profiles where github_login = 'lixiang90' limit 1),
  'challenge',
  $j${"en": "IMO Formalization Challenge", "zh": "IMO 形式化挑战"}$j$::jsonb,
  $j${"en": "Olympiad problems restated as Lean theorems. Prove them, submit your repository, get a machine verdict.", "zh": "把奥数题重述为 Lean 定理。证明它，提交仓库，由机器给出判定。"}$j$::jsonb,
  $j${"en": "Each problem here is a faithful Lean 4 statement of an International Mathematical Olympiad problem. The statement is fixed and trusted; your job is to supply a proof term that the comparator accepts.\n\nSubmissions are checked in a landrun sandbox: your solution must prove exactly the stated theorem, using only the permitted axioms, and must be accepted by the Lean kernel.", "zh": "这里的每道题都是国际数学奥林匹克题目的忠实 Lean 4 陈述。命题是固定且受信的；你要做的是给出一个 comparator 能接受的证明项。\n\n提交会在 landrun 沙箱中检查：你的解答必须恰好证明所述定理，只能使用允许的公理，并且要被 Lean 内核接受。"}$j$::jsonb,
  'https://github.com/formalia/imo-challenge',
  'main',
  'hard',
  array['olympiad', 'challenge', 'number-theory', 'combinatorics']::text[],
  'published',
  $j${"en": "# IMO Formalization Challenge\n\nFormal statements of IMO problems, graded by [comparator](https://github.com/leanprover/comparator).\n\n## How to submit\n\n1. Fork the starter repository.\n2. Fill in `Solution.lean` — do **not** modify the theorem statement.\n3. Push, then submit the repository URL and the exact commit SHA on this site.\n\n## Rules\n\n- Only `propext`, `Quot.sound` and `Classical.choice` are permitted axioms unless a problem says otherwise.\n- `sorry` will be rejected at the axiom-check stage.\n- Your `lakefile.lean` may not add dependencies outside the allowlist.\n", "zh": "# IMO 形式化挑战\n\nIMO 题目的形式化陈述，由 [comparator](https://github.com/leanprover/comparator) 评判。\n\n## 如何提交\n\n1. Fork 起始仓库。\n2. 填写 `Solution.lean` —— **不要**修改定理陈述。\n3. 推送后，在本站提交仓库地址与确切的 commit SHA。\n\n## 规则\n\n- 除非题目另有说明，只允许 `propext`、`Quot.sound` 与 `Classical.choice` 三条公理。\n- `sorry` 会在公理检查阶段被拒。\n- 你的 `lakefile.lean` 不得引入白名单之外的依赖。\n"}$j$::jsonb,
  '[{"name":"Formalia","type":"dir","children":[{"name":"Basic.lean","type":"file","size":4213},{"name":"Lemmas.lean","type":"file","size":11894},{"name":"Challenge.lean","type":"file","size":1620}]},{"name":"lakefile.lean","type":"file","size":412},{"name":"lean-toolchain","type":"file","size":19},{"name":"README.md","type":"file","size":3180},{"name":"LICENSE","type":"file","size":1071}]'::jsonb,
  '2026-03-02T04:00:00Z',
  '2026-07-28T16:45:00Z'
);

insert into public.projects (
  id, slug, owner_id, type, title, summary, description, repo_url, default_branch,
  difficulty, tags, status, readme, file_tree, created_at, updated_at
) values (
  gen_random_uuid(),
  'topos-theory-notes',
  (select id from public.profiles where github_login = 'lixiang90' limit 1),
  'normal',
  $j${"en": "Topos Theory Working Notes", "zh": "拓扑斯理论工作笔记"}$j$::jsonb,
  $j${"en": "Ongoing formalization of elementary topoi, subobject classifiers and sheaf semantics.", "zh": "初等拓扑斯、子对象分类子与层语义的持续形式化。"}$j$::jsonb,
  $j${"en": "A working repository rather than a polished library. Expect churn: definitions get renamed, proofs get golfed, and whole files occasionally disappear.\n\nThe long-term goal is a usable internal-language interface for reasoning inside a topos.", "zh": "这是一个工作仓库，而非成品库。请预期频繁变动：定义会改名，证明会被压缩，整个文件偶尔会消失。\n\n长期目标是提供一套可用的内部语言接口，用于在拓扑斯内部进行推理。"}$j$::jsonb,
  'https://github.com/formalia/topos-notes',
  'main',
  'research',
  array['category-theory', 'topos', 'wip']::text[],
  'published',
  $j${"en": "# Topos Theory Working Notes\n\n> Warning: this repository is unstable by design.\n\nCurrent focus is the subobject classifier $\\Omega$ and the correspondence\n\n$$\\mathrm{Sub}(X) \\cong \\mathrm{Hom}(X, \\Omega)$$\n\n## Status\n\n- [x] Finite limits\n- [x] Exponentials\n- [x] Subobject classifier\n- [ ] Internal logic\n- [ ] Sheaf semantics\n"}$j$::jsonb,
  '[{"name":"Formalia","type":"dir","children":[{"name":"Basic.lean","type":"file","size":4213},{"name":"Lemmas.lean","type":"file","size":11894},{"name":"Challenge.lean","type":"file","size":1620}]},{"name":"lakefile.lean","type":"file","size":412},{"name":"lean-toolchain","type":"file","size":19},{"name":"README.md","type":"file","size":3180},{"name":"LICENSE","type":"file","size":1071}]'::jsonb,
  '2026-04-19T12:00:00Z',
  '2026-07-30T08:10:00Z'
);

insert into public.projects (
  id, slug, owner_id, type, title, summary, description, repo_url, default_branch,
  difficulty, tags, status, readme, file_tree, created_at, updated_at
) values (
  gen_random_uuid(),
  'prime-gaps-challenge',
  (select id from public.profiles where github_login = 'lixiang90' limit 1),
  'challenge',
  $j${"en": "Prime Gaps and Elementary Bounds", "zh": "素数间隙与初等界"}$j$::jsonb,
  $j${"en": "A graded ladder of number-theory problems, from Bertrand's postulate up to explicit Chebyshev bounds.", "zh": "一组由浅入深的数论题，从伯特兰假设到显式切比雪夫界。"}$j$::jsonb,
  $j${"en": "Problems are ordered so that each one reuses lemmas you proved in the previous step. You are encouraged to keep a single solution repository and extend it as you climb the ladder.\n\nOne problem in this set uses definition holes: the challenge file leaves a bound as `sorry` and you must supply both the value and the proof. Those submissions enter manual review.", "zh": "题目按顺序排列，每道题都会复用你在上一步证明的引理。建议维护一个解答仓库，随着进阶不断扩展它。\n\n本组中有一道题使用了定义空洞：挑战文件把一个界留作 `sorry`，你需要同时给出取值与证明。这类提交会进入人工复核。"}$j$::jsonb,
  'https://github.com/formalia/prime-gaps',
  'main',
  'medium',
  array['number-theory', 'challenge', 'primes']::text[],
  'published',
  $j${"en": "# Prime Gaps\n\nElementary prime-counting results, formalized as a graded challenge set.\n\nThe headline target is an explicit Chebyshev-type bound\n\n$$c_1 \\frac{x}{\\log x} \\le \\pi(x) \\le c_2 \\frac{x}{\\log x}$$\n\nwith concrete constants, proved without analytic machinery.\n", "zh": "# 素数间隙\n\n初等素数计数结果，组织为分级挑战题集。\n\n主要目标是一个显式的切比雪夫型界\n\n$$c_1 \\frac{x}{\\log x} \\le \\pi(x) \\le c_2 \\frac{x}{\\log x}$$\n\n带具体常数，且不使用解析工具证明。\n"}$j$::jsonb,
  '[{"name":"Formalia","type":"dir","children":[{"name":"Basic.lean","type":"file","size":4213},{"name":"Lemmas.lean","type":"file","size":11894},{"name":"Challenge.lean","type":"file","size":1620}]},{"name":"lakefile.lean","type":"file","size":412},{"name":"lean-toolchain","type":"file","size":19},{"name":"README.md","type":"file","size":3180},{"name":"LICENSE","type":"file","size":1071}]'::jsonb,
  '2026-01-28T07:30:00Z',
  '2026-07-25T13:20:00Z'
);

insert into public.projects (
  id, slug, owner_id, type, title, summary, description, repo_url, default_branch,
  difficulty, tags, status, readme, file_tree, created_at, updated_at
) values (
  gen_random_uuid(),
  'tactic-cookbook',
  (select id from public.profiles where github_login = 'lixiang90' limit 1),
  'normal',
  $j${"en": "Lean 4 Tactic Cookbook", "zh": "Lean 4 策略手册"}$j$::jsonb,
  $j${"en": "Short, runnable recipes for the tactics people actually reach for, with failure modes documented.", "zh": "一份简短可运行的常用策略配方集，并记录了各自的失败模式。"}$j$::jsonb,
  $j${"en": "Every entry is a single file you can open and step through. Where a tactic commonly fails, the file includes the failing case and explains the error message rather than hiding it.", "zh": "每个条目都是一个可以直接打开并逐步执行的文件。对于策略常见的失败场景，文件会保留失败用例并解释报错信息，而不是把它藏起来。"}$j$::jsonb,
  'https://github.com/formalia/tactic-cookbook',
  'main',
  'intro',
  array['tactics', 'teaching', 'reference']::text[],
  'published',
  $j${"en": "# Tactic Cookbook\n\n```lean\nexample (a b : Nat) : a + b = b + a := by\n  omega\n```\n\nEach recipe answers three questions: what it does, when it fails, and what to try instead.\n", "zh": "# 策略手册\n\n```lean\nexample (a b : Nat) : a + b = b + a := by\n  omega\n```\n\n每个配方回答三个问题：它做什么、什么时候会失败、失败了该换用什么。\n"}$j$::jsonb,
  '[{"name":"Formalia","type":"dir","children":[{"name":"Basic.lean","type":"file","size":4213},{"name":"Lemmas.lean","type":"file","size":11894},{"name":"Challenge.lean","type":"file","size":1620}]},{"name":"lakefile.lean","type":"file","size":412},{"name":"lean-toolchain","type":"file","size":19},{"name":"README.md","type":"file","size":3180},{"name":"LICENSE","type":"file","size":1071}]'::jsonb,
  '2025-12-05T15:00:00Z',
  '2026-06-11T09:55:00Z'
);

insert into public.projects (
  id, slug, owner_id, type, title, summary, description, repo_url, default_branch,
  difficulty, tags, status, readme, file_tree, created_at, updated_at
) values (
  gen_random_uuid(),
  'measure-theory-challenge',
  (select id from public.profiles where github_login = 'lixiang90' limit 1),
  'challenge',
  $j${"en": "Measure Theory Warm-ups", "zh": "测度论热身"}$j$::jsonb,
  $j${"en": "Two short problems on sigma-algebras and monotone convergence, aimed at people new to comparator submissions.", "zh": "两道关于 σ-代数与单调收敛的短题，面向初次使用 comparator 提交的人。"}$j$::jsonb,
  $j${"en": "If you have never submitted to a comparator-graded problem before, start here. The statements are small enough that the whole build finishes quickly, so you get feedback on your workflow before tackling anything hard.", "zh": "如果你从未提交过 comparator 评测的题目，就从这里开始。命题足够小，整个构建很快就能跑完，你可以在挑战难题之前先跑通自己的工作流。"}$j$::jsonb,
  'https://github.com/formalia/measure-warmups',
  'main',
  'easy',
  array['measure-theory', 'challenge', 'beginner']::text[],
  'published',
  $j${"en": "# Measure Theory Warm-ups\n\nTwo small problems. Total build time is under two minutes with a warm Mathlib cache.\n", "zh": "# 测度论热身\n\n两道小题。在 Mathlib 缓存命中的情况下，总构建时间不到两分钟。\n"}$j$::jsonb,
  '[{"name":"Formalia","type":"dir","children":[{"name":"Basic.lean","type":"file","size":4213},{"name":"Lemmas.lean","type":"file","size":11894},{"name":"Challenge.lean","type":"file","size":1620}]},{"name":"lakefile.lean","type":"file","size":412},{"name":"lean-toolchain","type":"file","size":19},{"name":"README.md","type":"file","size":3180},{"name":"LICENSE","type":"file","size":1071}]'::jsonb,
  '2026-05-16T11:00:00Z',
  '2026-07-19T10:05:00Z'
);

insert into public.projects (
  id, slug, owner_id, type, title, summary, description, repo_url, default_branch,
  difficulty, tags, status, readme, file_tree, created_at, updated_at
) values (
  gen_random_uuid(),
  'comparator-playground',
  (select id from public.profiles where github_login = 'lixiang90' limit 1),
  'normal',
  $j${"en": "Comparator Playground", "zh": "Comparator 试验场"}$j$::jsonb,
  $j${"en": "A minimal reference setup showing exactly what the verifier runs, including the config.json it generates.", "zh": "一个最小参考配置，展示验证器到底跑了什么，包括它生成的 config.json。"}$j$::jsonb,
  $j${"en": "Useful if you want to reproduce a verdict locally before submitting. The repository contains a fake-landrun shim for non-Linux development and a script that mirrors the CI invocation exactly.", "zh": "如果你想在提交前本地复现判定结果，这个仓库很有用。它包含一个用于非 Linux 开发的 fake-landrun 垫片，以及一个与 CI 调用完全一致的脚本。"}$j$::jsonb,
  'https://github.com/formalia/comparator-playground',
  'main',
  'intro',
  array['tooling', 'comparator', 'reference']::text[],
  'published',
  $j${"en": "# Comparator Playground\n\nThe config the grader generates looks like this:\n\n```json\n{\n  \"challenge_module\": \"Challenge\",\n  \"solution_module\": \"Solution\",\n  \"theorem_names\": [\"imo_2019_p1\"],\n  \"permitted_axioms\": [\"propext\", \"Quot.sound\", \"Classical.choice\"],\n  \"enable_nanoda\": false\n}\n```\n\nRun it locally:\n\n```bash\nCOMPARATOR_LANDRUN=$(realpath scripts/fake-landrun.sh) \\\n  lake env ./.lake/build/bin/comparator config.json\n```\n"}$j$::jsonb,
  '[{"name":"Formalia","type":"dir","children":[{"name":"Basic.lean","type":"file","size":4213},{"name":"Lemmas.lean","type":"file","size":11894},{"name":"Challenge.lean","type":"file","size":1620}]},{"name":"lakefile.lean","type":"file","size":412},{"name":"lean-toolchain","type":"file","size":19},{"name":"README.md","type":"file","size":3180},{"name":"LICENSE","type":"file","size":1071}]'::jsonb,
  '2026-06-08T18:40:00Z',
  '2026-07-29T21:15:00Z'
);

insert into public.projects (
  id, slug, owner_id, type, title, summary, description, repo_url, default_branch,
  difficulty, tags, status, readme, file_tree, created_at, updated_at
) values (
  gen_random_uuid(),
  'graph-theory-basics',
  (select id from public.profiles where github_login = 'lixiang90' limit 1),
  'normal',
  $j${"en": "Graph Theory Basics", "zh": "图论基础"}$j$::jsonb,
  $j${"en": "Simple graphs, connectivity, trees and Euler tours, kept deliberately independent of Mathlib's combinatorics API.", "zh": "简单图、连通性、树与欧拉回路，刻意不依赖 Mathlib 的组合学 API。"}$j$::jsonb,
  $j${"en": "Written as a teaching artifact. Because it does not build on Mathlib's `SimpleGraph`, the definitions are unusually explicit and the proofs are longer than they need to be — that is the point.", "zh": "作为教学材料编写。由于没有基于 Mathlib 的 `SimpleGraph`，这里的定义格外显式，证明也比必要的更长 —— 这正是目的所在。"}$j$::jsonb,
  'https://github.com/formalia/graph-basics',
  'main',
  'easy',
  array['combinatorics', 'graphs', 'teaching']::text[],
  'published',
  $j${"en": "# Graph Theory Basics\n\nA from-scratch treatment. Handshake lemma:\n\n$$\\sum_{v \\in V} \\deg(v) = 2|E|$$\n", "zh": "# 图论基础\n\n从零开始的处理。握手引理：\n\n$$\\sum_{v \\in V} \\deg(v) = 2|E|$$\n"}$j$::jsonb,
  '[{"name":"Formalia","type":"dir","children":[{"name":"Basic.lean","type":"file","size":4213},{"name":"Lemmas.lean","type":"file","size":11894},{"name":"Challenge.lean","type":"file","size":1620}]},{"name":"lakefile.lean","type":"file","size":412},{"name":"lean-toolchain","type":"file","size":19},{"name":"README.md","type":"file","size":3180},{"name":"LICENSE","type":"file","size":1071}]'::jsonb,
  '2026-05-02T08:20:00Z',
  '2026-07-12T17:00:00Z'
);

-- -----------------------------------------------------------------------------
-- 2. challenge_problems
-- -----------------------------------------------------------------------------

insert into public.challenge_problems (
  id, project_id, slug, order_index, title, statement,
  challenge_lean_path, challenge_lean_source, solution_module, theorem_names,
  permitted_axioms, definition_names, enable_nanoda, bonus_points, deadline, status
) values (
  gen_random_uuid(),
  (select id from public.projects where slug = 'imo-formalization-challenge' limit 1),
  'imo-2019-p1',
  1,
  $j${"en": "IMO 2019 Problem 1 — Cauchy-like functional equation", "zh": "IMO 2019 第 1 题 —— 类柯西函数方程"}$j$::jsonb,
  $j${"en": "Let $f : \\mathbb{Z} \\to \\mathbb{Z}$ satisfy\n\n$$f(2a) + 2f(b) = f(f(a+b))$$\n\nfor all integers $a, b$. Show that $f$ is either identically zero, or of the form $f(x) = 2x + c$ for some constant $c$.\n\nThe Lean statement fixes the conclusion as a disjunction; you must prove that disjunction, not merely one branch.", "zh": "设 $f : \\mathbb{Z} \\to \\mathbb{Z}$ 对所有整数 $a, b$ 满足\n\n$$f(2a) + 2f(b) = f(f(a+b))$$\n\n证明 $f$ 要么恒为零，要么形如 $f(x) = 2x + c$（$c$ 为常数）。\n\nLean 陈述把结论固定为一个析取式；你需要证明整个析取式，而不只是其中一支。"}$j$::jsonb,
  'Challenge/Imo2019P1.lean',
  $t$import Mathlib.Tactic

/-- IMO 2019 Problem 1. Do not modify this statement. -/
theorem imo_2019_p1 (f : Int → Int)
    (hf : ∀ a b : Int, f (2 * a) + 2 * f b = f (f (a + b))) :
    (∀ z : Int, f z = 0) ∨ ∃ c : Int, ∀ z : Int, f z = 2 * z + c := by
  sorry
$t$::text,
  'Solution',
  array['imo_2019_p1']::text[],
  array['propext', 'Quot.sound', 'Classical.choice']::text[],
  array[]::text[],
  true,
  120,
  null,
  'open'
);

insert into public.challenge_problems (
  id, project_id, slug, order_index, title, statement,
  challenge_lean_path, challenge_lean_source, solution_module, theorem_names,
  permitted_axioms, definition_names, enable_nanoda, bonus_points, deadline, status
) values (
  gen_random_uuid(),
  (select id from public.projects where slug = 'imo-formalization-challenge' limit 1),
  'imo-2021-p2',
  2,
  $j${"en": "IMO 2021 Problem 2 — Square root inequality", "zh": "IMO 2021 第 2 题 —— 平方根不等式"}$j$::jsonb,
  $j${"en": "Show that for all real numbers $x_1, \\dots, x_n$,\n\n$$\\sum_{i=1}^{n}\\sum_{j=1}^{n} \\sqrt{|x_i - x_j|} \\le \\sum_{i=1}^{n}\\sum_{j=1}^{n} \\sqrt{|x_i + x_j|}.$$\n\nThis one is genuinely hard to formalize; the real-analysis lemmas you need are all present in Mathlib, but assembling them is the work.", "zh": "证明对任意实数 $x_1, \\dots, x_n$ 有\n\n$$\\sum_{i=1}^{n}\\sum_{j=1}^{n} \\sqrt{|x_i - x_j|} \\le \\sum_{i=1}^{n}\\sum_{j=1}^{n} \\sqrt{|x_i + x_j|}.$$\n\n这道题的形式化确实很难；所需的实分析引理 Mathlib 里都有，难点在于把它们组装起来。"}$j$::jsonb,
  'Challenge/Imo2021P2.lean',
  $t$import Mathlib.Tactic
import Mathlib.Analysis.SpecialFunctions.Sqrt

/-- IMO 2021 Problem 2. Do not modify this statement. -/
theorem imo_2021_p2 (n : Nat) (x : Fin n → Real) :
    ∑ i, ∑ j, Real.sqrt |x i - x j| ≤ ∑ i, ∑ j, Real.sqrt |x i + x j| := by
  sorry
$t$::text,
  'Solution',
  array['imo_2021_p2']::text[],
  array['propext', 'Quot.sound', 'Classical.choice']::text[],
  array[]::text[],
  true,
  200,
  '2026-12-31T23:59:00Z',
  'open'
);

insert into public.challenge_problems (
  id, project_id, slug, order_index, title, statement,
  challenge_lean_path, challenge_lean_source, solution_module, theorem_names,
  permitted_axioms, definition_names, enable_nanoda, bonus_points, deadline, status
) values (
  gen_random_uuid(),
  (select id from public.projects where slug = 'prime-gaps-challenge' limit 1),
  'bertrand-postulate',
  1,
  $j${"en": "Bertrand's postulate", "zh": "伯特兰假设"}$j$::jsonb,
  $j${"en": "For every natural number $n \\ge 1$ there exists a prime $p$ with $n < p \\le 2n$.\n\nMathlib already contains `Nat.exists_prime_lt_and_le_two_mul`, but the permitted axiom list is unchanged, so a one-line `exact` is a perfectly valid solution. Consider it a smoke test of your submission pipeline.", "zh": "对每个自然数 $n \\ge 1$，存在素数 $p$ 使得 $n < p \\le 2n$。\n\nMathlib 里已有 `Nat.exists_prime_lt_and_le_two_mul`，而允许公理列表未作限制，因此一行 `exact` 就是完全合法的解答。把它当作提交流程的冒烟测试。"}$j$::jsonb,
  'Challenge/Bertrand.lean',
  $t$import Mathlib.NumberTheory.Bertrand

/-- Bertrand's postulate. Do not modify this statement. -/
theorem bertrand_postulate (n : Nat) (hn : 1 ≤ n) :
    ∃ p : Nat, p.Prime ∧ n < p ∧ p ≤ 2 * n := by
  sorry
$t$::text,
  'Solution',
  array['bertrand_postulate']::text[],
  array['propext', 'Quot.sound', 'Classical.choice']::text[],
  array[]::text[],
  false,
  20,
  null,
  'open'
);

insert into public.challenge_problems (
  id, project_id, slug, order_index, title, statement,
  challenge_lean_path, challenge_lean_source, solution_module, theorem_names,
  permitted_axioms, definition_names, enable_nanoda, bonus_points, deadline, status
) values (
  gen_random_uuid(),
  (select id from public.projects where slug = 'prime-gaps-challenge' limit 1),
  'chebyshev-lower-bound',
  2,
  $j${"en": "Explicit Chebyshev lower bound", "zh": "显式切比雪夫下界"}$j$::jsonb,
  $j${"en": "Supply an explicit constant $c > 0$ and prove\n\n$$\\pi(x) \\ge c \\cdot \\frac{x}{\\log x} \\quad \\text{for all } x \\ge 2.$$\n\nThe challenge file leaves the constant as a **definition hole**: you provide both the value and the proof. Because comparator cannot rule out a degenerate choice on its own, passing submissions enter manual review before scoring.", "zh": "给出一个显式常数 $c > 0$ 并证明\n\n$$\\pi(x) \\ge c \\cdot \\frac{x}{\\log x} \\quad \\text{对所有 } x \\ge 2.$$\n\n挑战文件把该常数留作**定义空洞**：取值与证明都由你提供。由于 comparator 本身无法排除退化取值，通过的提交会先进入人工复核再计分。"}$j$::jsonb,
  'Challenge/Chebyshev.lean',
  $t$import Mathlib.NumberTheory.PrimeCounting

/-- Definition hole: the solver supplies the constant. -/
def chebyshevConst : Real := sorry

/-- Explicit Chebyshev lower bound. Do not modify this statement. -/
theorem chebyshev_lower (x : Real) (hx : 2 ≤ x) :
    chebyshevConst > 0 ∧
    (Nat.primeCounting ⌊x⌋₊ : Real) ≥ chebyshevConst * x / Real.log x := by
  sorry
$t$::text,
  'Solution',
  array['chebyshev_lower']::text[],
  array['propext', 'Quot.sound', 'Classical.choice']::text[],
  array['chebyshevConst']::text[],
  true,
  150,
  null,
  'open'
);

insert into public.challenge_problems (
  id, project_id, slug, order_index, title, statement,
  challenge_lean_path, challenge_lean_source, solution_module, theorem_names,
  permitted_axioms, definition_names, enable_nanoda, bonus_points, deadline, status
) values (
  gen_random_uuid(),
  (select id from public.projects where slug = 'measure-theory-challenge' limit 1),
  'sigma-algebra-closure',
  1,
  $j${"en": "Sigma-algebras are closed under countable intersection", "zh": "σ-代数对可数交封闭"}$j$::jsonb,
  $j${"en": "Given a sigma-algebra $\\mathcal{A}$ on a set $X$ and a countable family $(A_n)_{n \\in \\mathbb{N}}$ of members of $\\mathcal{A}$, show that $\\bigcap_n A_n \\in \\mathcal{A}$.\n\nA short warm-up. Expect the whole verification to finish in under a minute.", "zh": "给定集合 $X$ 上的 σ-代数 $\\mathcal{A}$ 与一族可数的成员 $(A_n)_{n \\in \\mathbb{N}}$，证明 $\\bigcap_n A_n \\in \\mathcal{A}$。\n\n一道短热身题。整个验证预计一分钟内完成。"}$j$::jsonb,
  'Challenge/SigmaAlgebra.lean',
  $t$import Mathlib.MeasureTheory.MeasurableSpace.Basic

/-- Countable intersections stay measurable. Do not modify this statement. -/
theorem measurable_iInter {X : Type*} [MeasurableSpace X]
    (A : Nat → Set X) (hA : ∀ n, MeasurableSet (A n)) :
    MeasurableSet (⋂ n, A n) := by
  sorry
$t$::text,
  'Solution',
  array['measurable_iInter']::text[],
  array['propext', 'Quot.sound', 'Classical.choice']::text[],
  array[]::text[],
  false,
  15,
  null,
  'open'
);

insert into public.challenge_problems (
  id, project_id, slug, order_index, title, statement,
  challenge_lean_path, challenge_lean_source, solution_module, theorem_names,
  permitted_axioms, definition_names, enable_nanoda, bonus_points, deadline, status
) values (
  gen_random_uuid(),
  (select id from public.projects where slug = 'measure-theory-challenge' limit 1),
  'monotone-convergence',
  2,
  $j${"en": "Monotone convergence for indicator sums", "zh": "指示函数和的单调收敛"}$j$::jsonb,
  $j${"en": "Let $(A_n)$ be an increasing sequence of measurable sets. Show that\n\n$$\\mu\\Big(\\bigcup_n A_n\\Big) = \\lim_{n \\to \\infty} \\mu(A_n).$$\n\nSlightly longer than the first warm-up, but still a single-file solution.", "zh": "设 $(A_n)$ 是一列递增的可测集。证明\n\n$$\\mu\\Big(\\bigcup_n A_n\\Big) = \\lim_{n \\to \\infty} \\mu(A_n).$$\n\n比第一道热身题稍长，但仍是单文件解答。"}$j$::jsonb,
  'Challenge/MonotoneConv.lean',
  $t$import Mathlib.MeasureTheory.Measure.MeasureSpace

open MeasureTheory

/-- Continuity from below. Do not modify this statement. -/
theorem measure_iUnion_monotone {X : Type*} [MeasurableSpace X]
    (mu : Measure X) (A : Nat → Set X)
    (hA : ∀ n, MeasurableSet (A n)) (hmono : Monotone A) :
    mu (⋃ n, A n) = ⨆ n, mu (A n) := by
  sorry
$t$::text,
  'Solution',
  array['measure_iUnion_monotone']::text[],
  array['propext', 'Quot.sound', 'Classical.choice']::text[],
  array[]::text[],
  false,
  25,
  null,
  'open'
);
