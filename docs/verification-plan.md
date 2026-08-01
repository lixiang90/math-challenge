# Lean 证明自动验证 —— 实现计划（P3-1）

> 制定日期：2026-08-01
> 参考实现：`leanprover/lean-eval`（题库 + 沙箱 + CLI）、`leanprover/lean-eval-submissions`（提交流水线）
> 本文是 `PLAN.md` 中 P3-1 的详细设计，决策已与 owner 逐条确认。
>
> **2026-08-01 修订**：① 在线提交由单文件改为**多文件**（`Submission.lean` + `Submission/**/*.lean`）；
> ② 出题权限由「仅管理员」改为**「任何用户可建挑战题目 → 管理员审核后成为可验证题目」**。
> 新增第四节（多文件提交规范）与第五节（社区出题与审核流），后续章节顺延。

---

## 一、对官方机制的关键认知

调研 `lean-eval` / `lean-eval-submissions` 后，有四条结论直接决定了本方案的形态：

1. **官方入口是 Issue Form，不是 PR。** `submission.yml` 只监听 `issues: [labeled]`，且 Lean 代码不内联——用户提交的是指向外部仓库的 URL。「人工打 `submission` 标签」是唯一的信任闸门。
2. **官方没有任何正则黑名单。** 不扫 `sorry`、不扫 `native_decide`。安全建立在语义层：
   - `permitted_axioms = {propext, Quot.sound, Classical.choice}` 白名单（`sorryAx` 不在其中 ⇒ 拒绝 `sorry`；`Lean.ofReduceBool` 不在其中 ⇒ 拒绝 `native_decide`）
   - comparator 遍历常量图，要求 Challenge 与 Solution 间每个可达常量**逐字节一致**
   - nanoda 独立内核复核（`templates/WorkspaceTest.lean` 强制 `enable_nanoda := true`，覆盖 `config.json` 的设置）
   - landrun（Linux Landlock）沙箱：`--ro /`，仅 `.lake` 可写，exec 白名单只有 `lean` 和 `git`
3. **防篡改不靠哈希。** `Challenge.lean` / `Solution.lean` / `config.json` / `WorkspaceTest.lean` 每次从原始 checkout 取，用户只能覆盖 `Submission.lean` 与 `Submission/**/*.lean`。
4. **验证内核不需要我们自己实现。** 入口就一条命令：
   ```
   lake exe lean-eval run-eval --json --workspaces-root <tmp> --problem <id>
   ```
   landrun / comparator / nanoda / 常量图比对全在里面。我们要做的只是：装 4 个 pin 死 SHA 的二进制 + 准备工作区 + 覆盖 Submission 文件 + 跑这条命令。
5. **多文件提交是官方原生能力，不是我们的扩展。** 工作区 README 原文：「Multi-file submissions are allowed through `Submission.lean` and additional local modules under `Submission/`.」实测 `generated/` 下 **232/232** 个工作区都自带 `Submission.lean` + `Submission/Helpers.lean` 骨架，`lakefile.toml` 里有 `[[lean_lib]] name = "Submission"`。官方叠加实现见 `evaluate_submission.py:229-272`（`_overlay_submission_dir`）—— 我们对齐它即可，规范见第四节。

### 两个必须记住的安全铁律

- **`Challenge.lean` / `ChallengeDeps.lean` 是可信代码**，`check-problem-build` 和 `generate` 会在**沙箱外**编译它们。Lean 编译期可跑任意 IO（`#eval` / `run_cmd` / 自定义 elaborator）。因此**「出题」= 在 CI 里执行任意代码**，与「提交答案」是完全不同的信任级别。
- **绝不能在沙箱外 `lake build` 任何传递导入 `Submission` 的目标。** 官方在 `evaluate_submission.py:314-324` 有醒目警告，2026-04 的提交 `3474943` 违反过此规则并被 #92 回滚——预编译会让恶意 Submission 污染 Challenge，使 comparator 表面上通过、实际验证的是另一个定理。

---

## 二、已确认的决策

| # | 决策点 | 结论 | 理由 |
|---|---|---|---|
| 1 | 提交载荷 | **内联多文件为主 + 仓库 URL 为辅**，两条 ingest 汇入同一验证内核 | 在线编辑器直接产出 `Submission.lean` + `Submission/**/*.lean`，与官方工作区形态逐字对齐，复杂证明可拆模块；URL 留给已有 Lean 项目仓库的用户 |
| 2 | 题目范围 | **官方 231 题 + 站内自建题目** | 复用官方 `generate --problem <id>` CLI，无需重写 1900 行生成器 |
| 3 | 执行后端 | **GitHub Actions（自建公开 verifier 仓）** | 公开仓分钟数无限、零运维、官方 workflow 可直接改用；后期挂 self-hosted runner 即可提速 |
| 4 | 仓库形态 | **Fork `leanprover/lean-eval`** | `Main.lean:36-40` 写死只认仓库默认的 `manifests/problems/`，`RepoRoot.lean` 靠「`lakefile.toml` + `manifests/problems/`」定位根目录 —— 社区题必须放进 lean-eval 的仓库结构里 |
| 5 | 出题信任 | **任何登录用户可创建挑战题目（草稿）；只有 `site_admins` 审核通过后才升级为「可验证题目」** | 出题 = 在 CI 里编译 `Challenge.lean`，人工审核是唯一信任闸门（对应官方「人工打 label」）；作者本人无法自行触发编译，流程见第五节 |
| 6 | 滥用防护 | **冷却 + 日配额 + 全局并发上限** | 官方靠人工 label，网页提交没有该闸门 |
| 7 | 回写通道 | **Vercel `workflow_dispatch` 推 + HMAC 签名回调** | Supabase service_role 密钥不出 Vercel；Actions 只持有 HMAC 密钥，泄露上限是伪造 verdict 而非整库读写 |
| 8 | def 洞题 | **通过后进 `review` 队列，管理员确认再计分** | def 洞只比对类型签名，可填平凡但合法的定义 |
| 9 | 首期切片 | **先跑通 231 道官方题的端到端** | 社区出题、积分触发器、Realtime 全部后置 |

---

## 三、架构

```
[网页多文件编辑器]  [仓库 URL + commit]
 Submission.lean          |
 Submission/**/*.lean     |
        \                /
         v              v
   Next.js Route Handler (Vercel)
   · zod + 路径/模块名校验 · 限流 · 写 submissions(queued)
   · 载荷存私有桶 submission-payloads
   · 并发未满则 workflow_dispatch，否则留在队列
                 |
                 v
   Fork: <owner>/lean-eval-verifier  (GitHub Actions)
   ├─ job: evaluate   [无任何 secret, contents:read, 不给 actions:write]
   │    装工具链 → 安全探针 → 取 pristine generated/<id>
   │    → 覆盖 Submission → run-eval → 产出 artifact
   └─ job: record     [needs: evaluate, if: always()]
        读 artifact → HMAC-SHA256 签名 → POST 回调
                 |
                 v
   Next.js /api/verify/callback
   · 验签 · service_role 写 verdict/status/log
   · 日志存私有桶 submission-logs
   · 触发队列中下一条（自时钟队列）
                 |
                 v
   前端轮询（3s，终态停止）
```

> 状态推送首期用**轮询**：验证耗时以分钟计，3 秒轮询完全够用，且无需开启 Supabase Realtime replication。Realtime 留作 P5 优化。

---

## 四、多文件提交规范

### 4.1 官方工作区形态（我们必须严格对齐的目标）

```
generated/<problem_id>/
├── Challenge.lean        ← 可信，pristine，用户不可覆盖
├── ChallengeDeps.lean    ← 可信，pristine
├── Solution.lean         ← 可信，pristine（官方参考解）
├── WorkspaceTest.lean    ← 可信，pristine（强制 enable_nanoda := true）
├── config.json           ← 可信，pristine
├── Submission.lean       ← ★ 用户可覆盖（根模块，含待证 theorem 骨架）
└── Submission/           ← ★ 用户可覆盖（本地辅助模块，官方每题都预置 Helpers.lean）
    └── Helpers.lean
```

`lakefile.toml` 中：`defaultTargets = ["Challenge", "Solution", "Submission"]`，且有 `[[lean_lib]] name = "Submission"`。

### 4.2 三条必须在 UI 里明示的 Lean 约束

1. **模块名必须等于路径。** `Submission/Foo/Bar.lean` 对应 `import Submission.Foo.Bar`，文件内应 `namespace Submission.Foo.Bar`。路径每一段都必须是合法 Lean 标识符：`^[A-Za-z_][A-Za-z0-9_']*$`。
2. **未被根模块传递 import 的文件不会被编译。** `lean_lib Submission` 的默认 glob 只含根模块本身，`Submission/Helpers.lean` 是因为 `Submission.lean` 里写了 `import Submission.Helpers` 才进入构建图。孤立文件既不报错也不生效——这是最容易让用户困惑的点，必须在编辑器里标灰提示。（安全上这反而是好性质：够不到的代码不会被执行。）
3. **不能改动 `Submission.lean` 里的定理签名。** comparator 逐字节比对常量图，签名一动直接判 fail。编辑器把签名行渲染为只读区域，只让用户填证明体。

### 4.3 校验规则（服务端入队时 + verifier 落盘前，双重执行）

| 规则 | 取值 | 依据 |
|---|---|---|
| 允许路径 | 仅 `Submission.lean` 或 `Submission/<Seg>/…/<Name>.lean` | 官方 overlay 只处理这两处 |
| 路径段格式 | `^[A-Za-z_][A-Za-z0-9_']*$`，目录深度 ≤ 4 | Lean 模块名规则 |
| 文件数上限 | ≤ 32（含根文件） | 官方无此限制，我们为内联模式自设 |
| 单文件上限 | ≤ 256 KiB | — |
| 总量上限 | ≤ 1 MiB | 官方审计归档上限是 10 MiB 压缩，内联收紧 |
| 必须存在 | `Submission.lean` 且非空 | `evaluate_submission.py:444-457` |
| 一律拒绝 | `..`、绝对路径、`.` 开头、非 `.lean` 后缀、空文件、大小写规范化后重复的路径、含控制字符或 Windows 保留名 | `_overlay_submission_dir` 的 traversal 检查 |
| 未改动即拒 | 全部文件与 pristine 模板逐字节相同 → 直接退回，不消耗配额 | 对齐官方 `Submission.lean unchanged from pristine; nothing to score` |

> 内联模式天然没有符号链接问题（载荷是 JSON），但 **repo 模式仍必须保留官方的 symlink 逃逸检查**。

### 4.4 repo 模式的语义修正

`submissions.solution_path` 的含义从「单个 `.lean` 文件路径」改为「**工作区目录路径**」——即同时含有 `lakefile.toml` 与 `Submission.lean` 的那个目录，与官方 `_find_candidates`（`evaluate_submission.py:145-183`）定位方式一致。这样 repo 模式天然支持多文件，无需额外设计。

### 4.5 前端编辑器

- **多标签编辑器**，进入时按 `submission_templates` 预填两个 tab（`Submission.lean` + `Submission/Helpers.lean`）。
- 支持新建 / 重命名 / 删除文件，路径输入框即时跑 4.3 的校验并给出中文错误。
- 用正则 `^import\s+Submission\.` 做一次简易 import 图分析，把**未被根模块可达**的文件标灰并提示「该文件不会参与编译」。
- 草稿存 localStorage（按 `problem_id` 分键），防误刷丢失。
- 提交前本地先跑一遍 4.3 全部规则，减少无效请求。

---

## 五、社区出题与审核流

### 5.1 状态机

```
        作者                        管理员
draft ──提交审核──> pending_review ──批准──> approved
  ^                      │                    │
  │                      ├─打回──> changes_requested ──┐
  └──────────────────────┘                             │
                         └─拒绝──> rejected             │
                                                        v
                                      generate 成功 → published
                                      (submission_enabled = true)
```

- `draft` / `changes_requested`：作者可读写。
- `pending_review` / `approved` / `published`：对作者**只读**（防审核期偷换源码，见 5.3）。
- 只有 `published` 的题目对公众可见、可被提交答案。
- 现有 231 道官方题与站内已有项目在 `0009` 里回填 `published`，列默认值也设 `published`，不破坏现状。

### 5.2 权限与闸门

| 动作 | 谁能做 |
|---|---|
| 创建 / 编辑草稿、提交审核 | 任何登录用户 |
| 查看审核队列、批准 / 打回 / 拒绝 | `is_site_admin()` |
| 触发 `generate`（= CI 内编译 `Challenge.lean`） | **仅由「批准」动作触发，作者无任何路径可自行触发** |
| 编辑已发布题目 | `is_site_admin()`（作者只能提「修订草稿」） |

管理员审核界面必须强制勾选确认框：
> ☐ 我已阅读 `Challenge.lean` 与 `ChallengeDeps.lean`，理解其内容将在 CI 中被编译执行。

### 5.3 审核期防偷换（TOCTOU）

**这是本流程最关键的安全点。** 如果作者能在「管理员点批准」和「CI 拉取源码」之间修改内容，人工审核就完全失效。

做法：提交审核时计算 `source_digest = sha256(canonical_json(source_files))` 并写库，记录随后不可编辑；管理员批准时把 digest 一并写入 `problem_reviews.reviewed_digest` 并作为 `workflow_dispatch` 的 input；CI 拉到源码后**先重算 digest 比对**，不一致立即中止。

### 5.4 generate / publish 双 job 拆分

与提交验证同构——跑过不可信代码的 job 绝不持有写权限：

- **job `generate`**：`permissions: { contents: read }`，无任何 secret，`rm -rf .git` 后执行
  `validate-manifest` → `check-problem-build` → `generate --problem <id>`，产出 artifact。
- **job `publish`**：`needs: generate`，`permissions: { contents: write }`，**只从 artifact 里挑白名单路径**
  （`LeanEval/Community/**`、`manifests/problems/<id>.toml`、`generated/<id>/**`）commit 回仓库，
  其余一律丢弃 —— 因为 artifact 是不可信代码产出的。
- publish 完成后 HMAC 回调回填 `challenge_problems`：`submission_templates`、`verifier_problem_id`、
  `theorem_names` / `permitted_axioms` / `definition_names`、`authoring_status = 'published'`、`submission_enabled = true`。

### 5.5 可选硬化（需要一次 spike，非首期必做）

官方是在**沙箱外**跑 `check-problem-build` / `generate` 的。如果我们能把 `generate` 也塞进 landrun（`--ro /` + 仅工作区可写，Mathlib 缓存提前在沙箱外拉好以保证离线），那么「出题」的信任级别就能降到和「提交答案」一样，人工审核从**唯一防线**变成**纵深防御的一层**。

风险：这是官方未做过的用法，`generate` 需要写 `generated/` 并调用 lake，未必跑得通。
结论：**先按 5.4 落地（批准后才编译），把 landrun 化的 generate 作为 M4 之后的加固项**，spike 失败就维持人工闸门。

### 5.6 反刷

- 每人每日「提交审核」次数上限（默认 3），避免刷爆管理员队列。
- 被 `rejected` 的题目需管理员解锁才能重新提交。
- 草稿数量上限（默认 10 / 人）。

### 5.7 DDL（属于 `0009` 的第二部分）

```sql
alter table challenge_problems
  add column author_id uuid references profiles(id),
  add column authoring_status text not null default 'published'
    check (authoring_status in
      ('draft','pending_review','changes_requested','rejected','approved','published')),
  add column source_files jsonb,              -- Challenge.lean / ChallengeDeps.lean / manifest 字段
  add column source_digest text,              -- sha256(canonical(source_files))，锁定审核内容
  add column submitted_for_review_at timestamptz,
  add column published_at timestamptz;

create table problem_reviews (
  id              uuid primary key default gen_random_uuid(),
  problem_id      uuid not null references challenge_problems(id) on delete cascade,
  reviewer_id     uuid not null references profiles(id),
  action          text not null check (action in ('approve','request_changes','reject')),
  note            text,
  reviewed_digest text not null,              -- 审核当时看到的内容哈希，事后可追溯
  created_at      timestamptz not null default now()
);

create index challenge_problems_review_queue_idx
  on challenge_problems(authoring_status, submitted_for_review_at)
  where authoring_status = 'pending_review';
```

RLS 要点：
- 作者：`select/insert/update` 自己的记录，但 `update` 仅当 `authoring_status in ('draft','changes_requested')`。
- 公开读：仅 `authoring_status = 'published'`（**否则未审核题目会漏进列表页**）。
- `is_site_admin()`：全读 + 可改 `authoring_status`；`problem_reviews` 仅管理员可写、题目作者可读。

---

## 六、数据层改造（migration `0009_submission_pipeline.sql`）

> 本节只覆盖**提交侧**；出题/审核侧的 DDL 见 5.7，两部分同属 `0009` 这一个迁移文件。

现有 `submissions` 表已有 `repo_url` / `commit_sha` / `solution_path` / `status`（含 `review`）/ `verdict jsonb` / `log_url` / `runner_run_id` / `points_awarded`，RLS 也已写好。需要补：

### submissions

```sql
alter table submissions
  add column source_kind text not null default 'repo'
    check (source_kind in ('inline','repo')),
  add column solution_files jsonb,          -- 多文件映射，键为工作区相对路径：
                                            -- {"Submission.lean": "...",
                                            --  "Submission/Helpers.lean": "...",
                                            --  "Submission/Analysis/Lemmas.lean": "..."}
  add column solution_digest text,          -- sha256(canonical(solution_files))，用于"与模板相同即拒"和去重
  add column queued_at timestamptz default now(),
  add column error_message text,
  add column reviewed_by uuid references profiles(id),
  add column reviewed_at timestamptz;

-- inline / repo 两种载荷的完整性约束
alter table submissions
  add constraint submissions_payload_shape check (
    (source_kind = 'inline' and solution_files is not null)
    or (source_kind = 'repo' and repo_url is not null
        and commit_sha is not null and solution_path is not null)
  );

-- repo 三列改为可空（inline 提交不需要）
alter table submissions
  alter column repo_url drop not null,
  alter column commit_sha drop not null,
  alter column solution_path drop not null;

-- 多文件载荷的体积与数量上限（详细路径规则在应用层，见 4.3）
-- 注意：CHECK 里不允许出现子查询，键数统计必须包成 IMMUTABLE 函数
create or replace function jsonb_key_count(j jsonb) returns int
  language sql immutable strict parallel safe
  as $$ select count(*)::int from jsonb_object_keys(j) $$;

alter table submissions
  add constraint submissions_inline_size
    check (solution_files is null or octet_length(solution_files::text) <= 1048576),
  add constraint submissions_inline_file_count
    check (solution_files is null
           or (jsonb_typeof(solution_files) = 'object'
               and jsonb_key_count(solution_files) between 1 and 32)),
  add constraint submissions_inline_has_root
    check (solution_files is null or solution_files ? 'Submission.lean');

-- 原子级防刷：同一用户同一题最多一条未完成提交
create unique index submissions_one_active_per_user_problem
  on submissions(user_id, problem_id)
  where status in ('queued','running');

-- 日配额与队列调度用
create index submissions_user_created_idx on submissions(user_id, created_at desc);
create index submissions_status_queued_idx on submissions(status, queued_at)
  where status = 'queued';
```

### challenge_problems

```sql
alter table challenge_problems
  add column verifier_problem_id text,      -- lean-eval 的 problem id（官方题 = slug）
  add column submission_templates jsonb,    -- ★ 多文件模板：pristine 的 Submission.lean + Submission/**/*.lean
                                            --   {"Submission.lean": "...", "Submission/Helpers.lean": "..."}
  add column submission_enabled boolean not null default false;
```

- **模板必须是 jsonb 而不是单个 text**：实测 232/232 个官方工作区都同时含 `Submission.lean` 与 `Submission/Helpers.lean`，只存根文件会让编辑器少一个 tab，用户写了 `import Submission.Helpers` 却没有该文件，编译直接失败。
- 模板同时是「未改动即拒」判定的基准（见 4.3 最后一行）。
- `submission_enabled` 首期由同步脚本对 231 道官方题置 `true`；社区题在 `publish` job 回填后才置 `true`，且必须 `authoring_status = 'published'`。
- `requires_manual_review` 继续按 `definition_names.length > 0` 派生（`src/lib/mock/db.ts:174`），不新增列。

### Storage

两个**私有**桶：

| 桶 | 用途 | 读权限 |
|---|---|---|
| `submission-payloads` | 待验证载荷（JSON），Actions 用短时效签名 URL 拉取 | 仅 service_role |
| `submission-logs` | 完整验证日志 | 提交者本人 + `is_site_admin()` |

### 同步脚本

`scripts/sync-lean-eval.mjs` 增补：递归读取 `generated/<id>/Submission.lean` **与 `generated/<id>/Submission/**/*.lean`**，以「路径 → 内容」写入 `submission_templates`；同时置 `verifier_problem_id = <folder name>`、`submission_enabled = true`、`authoring_status = 'published'`。

---

## 七、Verifier 仓库

**形态**：fork `leanprover/lean-eval` → `<owner>/lean-eval-verifier`（公开仓，Actions 分钟数免费）。
社区题放 `LeanEval/Community/<Slug>.lean` + `manifests/problems/<id>.toml`；生成的工作区 commit 回仓库持久化（照搬官方 `regenerate-main.yml` 的模式）。
定期 `git merge upstream/main` 同步官方新题。

### `.github/workflows/verify-submission.yml`

```yaml
on:
  workflow_dispatch:
    inputs:
      submission_id: { required: true, type: string }
      problem_id:    { required: true, type: string }
      payload_url:   { required: true, type: string }   # 短时效签名 URL，非明文代码
      callback_url:  { required: true, type: string }
```

> 载荷**不走 workflow_dispatch inputs**：inputs 总长受限且会出现在日志里。走私有桶签名 URL。

**job `evaluate`** — `permissions: { contents: read }`，**不给 `actions: write`**（跑过不可信代码的 runner 绝不写共享缓存），`timeout-minutes: 90`：

1. `actions/checkout`，`persist-credentials: false`
2. 下载 payload；**完整重跑 4.3 的全部校验**（服务端已校验过，这里不信任上游，再验一次）
3. 装 elan + `lake exe cache get`（Mathlib ≈ 2–3 GB，先跑 `free-disk-space`），多工作区用 `cp -al` 硬链复用
4. 装 4 个 pin 到 40 位 SHA 的二进制：`landrun`(Go) / `lean4export` / `comparator` / `nanoda`(Rust)
5. **`rm -rf .git`**（跑不可信 Lean 前剥离全部 git 凭据）
6. 安全探针，失败即中止：
   ```
   python scripts/sandbox_engaged_probe.py --require-tools
   python scripts/security_probes/env_dump_probe.py --require-tools
   ```
7. `lake exe lean-eval generate --problem <id> --check`（确认 `generated/` 与源码一致，未被篡改）
8. 拷贝 pristine `generated/<id>/` 到临时目录，**只覆盖** `Submission.lean` 与 `Submission/**/*.lean`
   —— 采用官方的**叠加**语义（`_overlay_submission_dir`）：不删除 pristine 的 `Submission/Helpers.lean`。
   若用户重命名了辅助文件，残留的模板文件因不被根模块 import 而不参与编译，无副作用。
   verdict 里回显 `overlaid_files` 实际落盘清单，便于用户排查「我的文件为什么没生效」。
9. `lake exe lean-eval run-eval --json --workspaces-root <tmp> --problem <id>`
10. 结果 JSON + 完整日志写入 artifact

**job `record`** — `needs: evaluate`, `if: always()`，读 artifact，用 `VERIFIER_CALLBACK_SECRET` 对原始 body 做 HMAC-SHA256，POST 到 `callback_url`。失败重试 3 次指数退避。

### `.github/workflows/publish-problem.yml`（M4，取代原 `regenerate-community.yml`）

**不再由 push 触发**——只接受管理员「批准」动作发出的 `workflow_dispatch`，避免任何人通过改仓库文件绕过审核：

```yaml
on:
  workflow_dispatch:
    inputs:
      problem_id:      { required: true, type: string }
      source_url:      { required: true, type: string }   # 私有桶签名 URL，含 Challenge/Deps/manifest
      source_digest:   { required: true, type: string }   # 管理员审核当时看到的内容哈希
      callback_url:    { required: true, type: string }
```

**job `generate`** — `permissions: { contents: read }`，无 secret，`rm -rf .git`：

1. 下载 source，**重算 sha256 与 `source_digest` 比对，不一致立即中止**（5.3 的 TOCTOU 防线）
2. 写入 `LeanEval/Community/<Slug>.lean` + `manifests/problems/<id>.toml`
3. `validate-manifest` → `check-problem-build` → `generate --problem <id>`
4. 产出 artifact（含 `generated/<id>/**`）

**job `publish`** — `needs: generate`，`permissions: { contents: write }`：

- 从 artifact 里**只取白名单路径**：`LeanEval/Community/<Slug>.lean`、`manifests/problems/<id>.toml`、`generated/<id>/**`；其余一律丢弃（artifact 是不可信代码的产物）
- commit 回仓库，再 HMAC 回调把 `submission_templates`（多文件）、`config.json` 的 `theorem_names` / `permitted_axioms` / `definition_names`、`holes.json` 同步进 `challenge_problems`，并置 `authoring_status='published'`、`submission_enabled=true`

---

## 八、Next.js 侧

### 提交侧

| 文件 | 职责 |
|---|---|
| `src/app/api/submissions/route.ts` | POST 创建提交。zod + 4.3 路径校验 → 限流 → 写 `submissions(queued)` → 多文件载荷传私有桶 → 并发未满则 `workflow_dispatch` |
| `src/app/api/verify/callback/route.ts` | HMAC 验签（constant-time 比较）→ service_role 写 `status`/`verdict`/`log_url`/`finished_at` → def 洞题置 `review` → 触发队列下一条 |
| `src/app/api/submissions/[id]/route.ts` | GET 单条状态，供前端轮询 |
| `src/lib/verifier.ts` | 封装 `workflow_dispatch` 调用、HMAC 签名/验签、队列调度（`dispatchNextQueued()`） |
| `src/lib/rate-limit.ts` | 冷却（同题 N 分钟）+ 日配额 + 全局并发上限判定 |
| `src/components/submission-panel.tsx` | **重写**：删掉 `setTimeout` 模拟与「commit SHA 末位奇偶定成败」逻辑，改真实 POST + 3s 轮询 |
| `src/components/submission-editor.tsx` | **新增**：多文件标签编辑器（4.5），按 `submission_templates` 预填、增删改文件、路径即时校验、孤立文件标灰、localStorage 草稿 |
| `src/lib/lean-paths.ts` | **新增**：路径与模块名校验、canonical JSON、digest 计算、简易 import 图分析。**前后端与校验脚本共用同一份规则**，避免三处实现漂移 |
| `src/app/[locale]/projects/[slug]/problems/[problemSlug]/page.tsx` | 替换 `DEMO_USER_ID` 兜底，改用真实 session |
| `src/lib/types.ts` | 补 `source_kind` / `solution_files` / `solution_digest` / `reviewed_by` / `reviewed_at` / `error_message` |

### 出题与审核侧（M4）

| 文件 | 职责 |
|---|---|
| `src/app/api/problems/route.ts` | 作者创建/更新草稿（仅 `draft` / `changes_requested` 可写）、提交审核（算 `source_digest`、锁记录、扣日配额） |
| `src/app/api/admin/problems/[id]/review/route.ts` | 管理员批准/打回/拒绝。批准时写 `problem_reviews` 并 `workflow_dispatch` 触发 `publish-problem.yml` |
| `src/app/api/verify/problem-callback/route.ts` | HMAC 验签 → 回填 `submission_templates` / config 元数据 → 置 `published` + `submission_enabled` |
| `src/components/problem-authoring-form.tsx` | 作者端：`Challenge.lean` / `ChallengeDeps.lean` 编辑 + manifest 元数据表单 |
| `src/components/problem-review-queue.tsx` | 管理员端：待审列表、源码全文查看、强制确认框（5.2）、批准/打回/拒绝 |

### 环境变量

| 变量 | 位置 | 说明 |
|---|---|---|
| `VERIFIER_REPO` | Vercel | `<owner>/lean-eval-verifier` |
| `VERIFIER_GITHUB_TOKEN` | Vercel | fine-grained PAT 或 GitHub App，权限仅 `actions: write` |
| `VERIFIER_CALLBACK_SECRET` | Vercel + GitHub Secrets | HMAC 共享密钥 |
| `VERIFIER_MAX_CONCURRENCY` | Vercel | 全局同时运行上限，默认 3 |
| `VERIFIER_COOLDOWN_SECONDS` | Vercel | 同题冷却，默认 600 |
| `VERIFIER_DAILY_QUOTA` | Vercel | 每人每日提交上限，默认 20 |
| `SUBMISSION_MAX_FILES` | Vercel | 内联多文件数量上限，默认 32 |
| `AUTHORING_REVIEW_DAILY_QUOTA` | Vercel | 每人每日提交审核次数上限，默认 3 |
| `AUTHORING_DRAFT_LIMIT` | Vercel | 每人草稿题目数量上限，默认 10 |

---

## 九、安全清单（不可违反）

1. `evaluate` job 不持有任何 secret；权限仅 `contents: read`；**不给 `actions: write`**。
2. 跑不可信 Lean 前 `rm -rf .git`。
3. **绝不在沙箱外 `lake build` 任何传递导入 `Submission` 的目标。**
4. 只覆盖 `Submission.lean` 与 `Submission/**/*.lean`，按 4.3 全表校验；**服务端与 verifier 各校验一次**，verifier 不信任上游。
5. `Challenge.lean` / `Solution.lean` / `config.json` / `WorkspaceTest.lean` 一律取自 pristine checkout。
6. 用 `permitted_axioms` 白名单，**不做正则黑名单**。
7. 不改 `templates/WorkspaceTest.lean` 的 `enable_nanoda := true` 强制覆盖。
8. 每次运行前跑两个安全探针，失败即中止。
9. 所有 GitHub Action 引用 pin 到 40 位 SHA（可复用官方 `scripts/action_pin_audit.py` 做 CI 检查）。
10. 用户自由文本（提交备注、模型名等）渲染前必须转义——官方 `SECURITY.md:168-178` 自承此处未做防护。
11. 出题源码进入 CI 编译，**只能由 `site_admins` 的「批准」动作触发**；作者无任何自助路径。`publish-problem.yml` 不接受 push 触发。
12. 审核期用 `source_digest` 锁定内容，CI 拉取后重算比对，不一致中止（5.3）。管理员审核界面必须有「我已阅读源码」强制确认框。
13. `generate` job 无 secret、`contents: read`；`publish` job 只从 artifact 取白名单路径 commit —— artifact 是不可信代码的产物。
14. 未发布题目不得出现在任何公开列表：RLS 限定 `authoring_status = 'published'`，数据访问层再加一道过滤（双保险）。

---

## 十、分步交付

| 里程碑 | 内容 | 完成判据 |
|---|---|---|
| **M0 verifier 仓奠基** | fork lean-eval、装 4 个二进制、CI 自检跑通、手工验证一道题（`two_plus_two`） | `run-eval` 对正确解 pass、对 `sorry` fail；**且一份「把引理拆进 `Submission/Helpers.lean` 再 import」的多文件解同样 pass** |
| **M1 数据层** | migration `0009`（提交侧 + 出题侧两部分）、两个私有桶、类型补齐、`sync-lean-eval.mjs` **递归**采集模板 | 231 题的 `submission_templates` 都含 2 个文件；存量项目全部回填 `authoring_status='published'` |
| **M2 提交入口** | 提交 API + 限流 + `lean-paths.ts` + **多文件编辑器**（真实落库，暂不触发验证） | 能增删改文件、非法路径被拦、孤立文件标灰；提交后库里出现 `queued`，重复提交被唯一索引挡住 |
| **M3 验证闭环** | `verify-submission.yml` + `record` job + HMAC 回调 + 轮询 + 队列调度 | 网页提交一道**多文件**真题，几分钟后前端自动显示 passed/failed、日志与 `overlaid_files` |
| **M4 出题与审核（不接 CI）** | 作者草稿 / 提交审核 + `source_digest` 锁定 + 管理员审核队列与强制确认框 | 普通用户提题 → 管理员看到完整源码 → 批准/打回/拒绝全流程可用；未发布题目不出现在公开列表 |
| **M5 出题发布流水线** | `publish-problem.yml`（generate + publish 双 job）+ digest 比对 + 元数据回调 | 管理员批准一道社区题后自动编译发布，**他人能对这道新题提交答案并跑通验证** |
| **M6 积分与复核** | `points_ledger` 触发器、`review` 队列后台、排行榜接真数据 | 首次通过自动计分；def 洞题进复核队列，管理员确认后发分 |

> M4 与 M5 之间可以安全地停留一段时间：M4 完成后社区题目已能沉淀，只是暂不可自动验证；管理员批准后先手工跑一次流水线即可过渡。

---

## 十一、遗留风险

| 风险 | 缓解 |
|---|---|
| Mathlib 冷构建耗时（官方上限 360 分钟，出现过 OOM） | 首期 `timeout-minutes: 90`；超时置 `timeout` 状态并提示重试；量大后挂 self-hosted runner 让缓存常驻 |
| 公开 verifier 仓日志公开可见 | 提交内容本身不敏感；不在日志打印任何 URL 签名参数与密钥 |
| GitHub Actions 免费并发 20 | `VERIFIER_MAX_CONCURRENCY` 默认 3，远低于上限；队列自时钟推进 |
| 自时钟队列可能因回调丢失而停摆 | 加一条兜底：`queued_at` 超过 N 分钟仍未 dispatch 的记录由下次任意 API 调用顺带重扫 |
| def 洞题的钻解 | 强制进 `review`，管理员确认后计分 |
| fork 与 upstream 分叉 | 社区题只落 `LeanEval/Community/` 与 `manifests/problems/`，与 upstream 目录无重叠，merge 冲突面极小 |
| **出题 = CI 内 RCE**（现在任何用户都能提题） | 三重防线：① 编译只由管理员「批准」触发，作者无自助路径；② `source_digest` 锁定审核内容，CI 内重算比对；③ `generate` job 无 secret + `publish` 只 commit 白名单路径。加固项见 5.5（landrun 化 generate） |
| **管理员审核疲劳 / 被诱导批准恶意题** | 强制确认框 + `problem_reviews.reviewed_digest` 全程留痕可追溯；长期看只有 5.5 的沙箱化能根治，人工闸门不应是唯一防线 |
| 孤立辅助文件不参与编译，用户困惑「代码为什么没生效」 | 编辑器做 import 图分析标灰；verdict 回显 `overlaid_files` 与实际编译的模块列表 |
| 多文件放大编译耗时与 OOM 面 | 文件数 ≤ 32、总量 ≤ 1 MiB；`timeout-minutes: 90` 对整个工作区生效 |
| 三处路径校验规则漂移（前端 / API / verifier） | 规则集中在 `src/lib/lean-paths.ts`，verifier 侧脚本从同一份 JSON 常量生成，加一条 CI 断言 |
