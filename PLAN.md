# 形式化数学项目社区 — 需求细化与实现计划

> 状态：P1 + P2（P2-1 ~ P2-7）已完成并通过 `next build`；前端代码待 `git push` 部署，域名/DNS 等用户侧配置待办。下一步 **P3 验证闭环**。
> 最后更新：2026-07-31

---

## 一、决策摘要

### 目标

一个**开放社区式**的形式化数学项目平台：任何 GitHub 用户都能发布项目；其中 Challenge 类项目携带 Lean 题目，用户提交解答仓库后由 comparator 自动判定，通过则获得积分。

### 关键决策

| 决策项 | 选定方案 | 理由 |
|---|---|---|
| 平台定位 | 开放社区平台 | 用户可自主创建项目与挑战题 |
| 技术栈 | Next.js 15 App Router + TS + Tailwind + shadcn/ui | Vercel 零配置，组件成熟 |
| 视觉风格 | 克制学术风：浅色底 + 衬线标题 + KaTeX | 契合数学社区调性 |
| 数据库 | Supabase（Postgres + Auth + RLS） | 与 GitHub OAuth 原生集成 |
| 认证 | GitHub OAuth（经 Supabase Auth） | 用户群天然有 GitHub 账号 |
| i18n | UI 文案走 next-intl；内容存 jsonb 多语字段 + 回退 | 兼顾开发成本与社区多语内容 |
| 语言范围 | 中文 + 英文（en 为回退语言） | 两语足以验证架构 |
| 验证执行环境 | **GitHub Actions**（非 Serverless 云函数） | 见下方"重大架构修正" |
| 提交形式 | Git 仓库 URL + commit SHA | 支持多文件、自定义依赖的复杂解答 |
| 奖励机制 | **仅积分，不做金钱** | 规避资金托管、KYC、退款争议 |

### 重大架构修正（相对原始需求）

原需求写的是"验证由 Serverless 云函数提供"。**这条不可行**，必须修正：

comparator 的真实执行链路是 `landrun 沙箱 → lake build Challenge → lean4export → 对 Solution 重复 → 声明比对 → 公理白名单校验 → Lean 内核 replay`。它要求：

- Linux + Landlock LSM（`landrun` 依赖）
- 完整 Lean toolchain + Mathlib 缓存，磁盘 GB 级
- 单次验证分钟级起步
- 非特权用户 + `systemd-run` 额外隔离

而 Vercel Functions 上限 10s/60s、只读文件系统、无 Landlock 权限；常规 FaaS（SCF / Lambda）15 分钟上限 + 冷启动拉几 G 镜像，同样不成立。

**修正方案**：Vercel 只负责 Web 与调度入口，验证走异步链路 —— 提交入队 → GitHub Actions `workflow_dispatch` 触发 ubuntu runner → runner 内执行 comparator → 回调写回 Supabase。

```
浏览器 → Vercel(Next.js) → Supabase(Postgres/Auth/RLS)
                                  ↓ 领取 pending
                          GitHub Actions ubuntu runner
                                  ↓
                          landrun 沙箱 + comparator
                                  ↑ 回写判定结果
```

---

## 二、需求细化

### 2.1 导航与全局

- 顶部导航：Logo / 浏览项目 / 排行榜 / 语言切换（中·英）/ 用户区（未登录=GitHub 登录按钮，已登录=头像下拉）
- 语言切换走路由前缀 `/[locale]/...`，`en` 为默认回退
- 响应式：桌面三列卡片、平板两列、移动单列

### 2.2 项目列表页

- 卡片网格，每张卡片：标题、一句话简介、类型徽章（Normal / Challenge）、难度徽章、题目数（Challenge 才有）、标签、仓库链接、详情链接
- 筛选：类型、难度、标签；排序：最新 / 最热 / 积分总额
- 搜索：标题 + 简介全文匹配

### 2.3 项目详情页

两种类型共用骨架，Challenge 多一段：

**共有**
- 介绍区（富文本 / Markdown，支持 KaTeX）
- 元数据侧栏：类型、难度、作者、创建时间、标签、Git 仓库链接
- 仓库信息区：README 渲染、文件树（P5 再做真实拉取）

**Challenge 额外**
- 题目列表：题名、难度、bonus points、通过人数、我的状态
- 点进单题 → 题目页

### 2.4 题目页

- 题面（多语，KaTeX）
- `Challenge.lean` 只读代码展示（语法高亮）
- comparator 配置摘要：`theorem_names`、`permitted_axioms`、是否有 definition holes、`enable_nanoda`
- 提交表单：Git 仓库 URL + commit SHA + Solution 文件路径
- 我的提交历史：状态、耗时、判定详情、日志链接
- 通过者名单

### 2.5 个人中心

- 我的提交（按状态筛选）
- 我的积分明细与总分
- 我发布的项目
- 排行榜页（全站积分 Top N）

---

## 三、数据模型（Supabase / Postgres）

```sql
-- 多语字段统一用 jsonb: {"en": "...", "zh": "..."}

profiles(
  id uuid pk → auth.users,
  github_login text unique, display_name text, avatar_url text,
  bio jsonb, total_points int default 0, created_at timestamptz
)

projects(
  id uuid pk, slug text unique, owner_id uuid → profiles,
  type text check in ('normal','challenge'),
  title jsonb, summary jsonb, description jsonb,
  repo_url text, default_branch text default 'main',
  difficulty text check in ('intro','easy','medium','hard','research'),
  tags text[], status text check in ('draft','published','archived'),
  created_at, updated_at
)

challenge_problems(
  id uuid pk, project_id uuid → projects, slug text,
  order_index int, title jsonb, statement jsonb,
  challenge_lean_path text,          -- 仓库内 Challenge.lean 路径
  solution_module text,              -- comparator config.solution_module
  theorem_names text[],
  permitted_axioms text[] default '{propext,Quot.sound,Classical.choice}',
  definition_names text[],
  enable_nanoda bool default false,
  bonus_points int default 0,
  deadline timestamptz, status text,
  unique(project_id, slug)
)

submissions(
  id uuid pk, problem_id uuid → challenge_problems, user_id uuid → profiles,
  repo_url text, commit_sha text, solution_path text,
  status text check in ('queued','running','passed','failed','error','timeout'),
  verdict jsonb,                     -- comparator 输出摘要
  log_url text, runner_run_id text,
  points_awarded int default 0,
  created_at, started_at, finished_at
)

points_ledger(
  id uuid pk, user_id uuid, problem_id uuid, submission_id uuid,
  delta int, reason text, created_at,
  unique(user_id, problem_id)        -- 同题只首次通过计分
)
```

**RLS 要点**：`projects` 公开读、仅 owner 写；`submissions` 本人可读全部字段，他人只可读通过记录的公开子集；`points_ledger` 仅服务端写入。

---

## 四、分期实现计划

### P1 — 前端骨架 + 假数据 ✅ 已完成

- [x] Next.js 15 App Router 项目初始化，TS 严格模式，Tailwind + shadcn/ui
- [x] next-intl 接入，`/[locale]` 路由，中英两套文案
- [x] 设计 token：浅色学术风配色、衬线标题字体、KaTeX 样式 + 暗色主题
- [x] 顶部导航（语言切换、用户区、发布项目入口）
- [x] 首页 + 项目卡片网格（筛选 / 搜索 / 排序，前端内存实现）
- [x] 项目详情页 × 2 类型（Normal 走 README 展示，Challenge 多题目列表）
- [x] 题目页 + 提交表单（仓库 URL / commit / 路径校验，状态流转）
- [x] 个人中心 + 排行榜（假数据）
- [x] mock 数据层封装（与 Supabase 查询同形接口，便于 P2 替换）
- [x] 部署到 Vercel（站点 `math-challenge-gamma.vercel.app`）

### P2 — 真数据与认证 ✅ 已完成（P2-1 ~ P2-7）

- [x] **P2-1 基础设施**：Supabase 客户端层 + 中间件会话刷新（`@supabase/ssr`）
- [x] **P2-2 客户端层**：`createClient` / `createServerClient` 封装，cookie 安全
- [x] **P2-3 GitHub OAuth**：`signInWithOAuth({ provider: 'github' })`，profiles 自动建档（DB 触发器）
- [x] **P2-4 Schema + RLS**：迁移 `0001_init_schema.sql`（profiles / projects / challenge_problems / submissions / points_ledger + RLS 策略）
- [x] **P2-5 真实数据层**：mock 替换为真实 Supabase 查询；dispatcher 模式（真库 + 占位符时 mock 回退）；seed 数据；`/me` 服务端改用真实登录用户修复 `Application error`
- [x] **P2-6 项目表单**：创建 / 编辑表单（社区投稿，server action + `useActionState`）；Normal 整仓；Challenge 额外 commit(默认最新)/branch(默认主分支)/path(默认根目录)；智能解析仓库 URL 中的 `/tree/{branch|commit}/{path}`，下方字段优先
- [x] **P2-7 项目 claim + 多维护者**：迁移 `0003_project_members.sql`（project_members 表 + RLS 扩展：编辑权开放给 owner 或 maintainer）；GitHub 登录名 == 仓库 owner 可认领获编辑权；表单提交的项目自动归属提交者；详情页展示维护者列表 + 认领/编辑按钮

> 迁移清单：`0001_init_schema.sql`（P2-4）、`0002_project_sync_config.sql`（P2-6 sync_commit/branch/path）、`0003_project_members.sql`（P2-7）。**三者均已经 Supabase MCP `apply_migration` 直接跑入真库并回查验证。**

### 运维说明（P2 期间沉淀）

- **Supabase MCP**：已在本机配置 `https://mcp.supabase.com/mcp?project_ref=dzfiwclvxlswdtdhkzpe`（OAuth 登录，不落盘令牌）；支持只读查询、诊断、`apply_migration`。匿名上下文 `auth.uid()`=null，故 owner 级 DELETE 仍需到 Dashboard 执行。
- **数据自愈**：因 P2-6 旧代码 `redirect()` 被 try/catch 吞掉，曾误建 4 个重复项目 `zhang-bounded-prime-gaps` 及 `-1/-2/-3`。清理 SQL（Dashboard 执行）：
  `delete from public.projects where slug in ('zhang-bounded-prime-gaps-1','zhang-bounded-prime-gaps-2','zhang-bounded-prime-gaps-3');`
- **域名切换（待用户执行）**：GoDaddy `math-challenge.org` → Vercel（`A 76.76.21.21` / `CNAME cname.vercel-dns.com`）；Supabase Redirect URLs 加 `https://math-challenge.org/**`；Vercel 环境变量 `NEXT_PUBLIC_SITE_URL` 改 `https://math-challenge.org` 后 Redeploy。
- **部署**：当前本地分支领先 `origin/main` 多个 commit，需 `git push` 触发 Vercel 部署后方可线上验证 P2-7 等前端能力。

### P3 — 验证闭环

- [ ] 独立 verifier 仓库：Dockerfile（Lean + Mathlib 缓存 + landrun + lean4export）
- [ ] GitHub Actions workflow：接收 `workflow_dispatch`，克隆解答仓库到指定 commit，生成 `config.json`，跑 comparator
- [ ] Next.js Route Handler：提交入队 + 触发 workflow
- [ ] 回调 endpoint（HMAC 签名校验）写回 `submissions.status` / `verdict` / `log_url`
- [ ] 前端提交状态轮询或 Supabase Realtime 订阅
- [ ] 打通一道真题端到端

### P4 — 积分与激励

- [ ] `points_ledger` 触发器：首次通过自动记分并更新 `profiles.total_points`
- [ ] 排行榜真实数据、通过者名单
- [ ] 提交结果通知（站内 + 可选邮件）

### P5 — 打磨

- [ ] 真实拉取仓库 README 与文件树（GitHub API + 缓存）
- [ ] 全文搜索（Postgres tsvector 或 Supabase FTS）
- [ ] SEO / OG 图 / sitemap
- [ ] 无障碍审查、暗色模式
- [ ] 速率限制、滥用防护

---

## 五、遗留风险

| 风险 | 说明 | 缓解 |
|---|---|---|
| **外部仓库拉取的安全面** | 提交形式是 Git URL，runner 要克隆任意用户仓库。恶意 `lakefile.lean` 可在 build 期执行任意代码 | 全程在一次性 runner + landrun 沙箱内；禁网或白名单出网；限制 lake 依赖来源；克隆深度限 1 |
| **Mathlib 构建耗时** | 冷启动可能十几分钟，用户体验差 | 预构建 Docker 镜像 + `lake exe cache get`；runner 并发上限与队列排队提示 |
| **GitHub Actions 配额** | 私有仓库分钟数有限，公开仓库免费但有并发上限 | P3 先跑通，量大后再切自建 VPS worker（verifier 接口保持抽象，可替换） |
| **Definition holes 防作弊** | comparator 文档明确指出：含 definition holes 的题目仍需人工复核 | 此类题目标记为"需人工复核"，通过后进审核队列而非直接计分 |
| **开放投稿的内容治理** | 任何人可发项目，可能出现垃圾/违规内容 | P2 加举报入口，P4 前补管理员下架能力 |
| **金钱奖励已移除** | 原始需求中的 monetary rewards 本期不做 | 数据模型预留 `bonus_points`，未来若加金钱可扩展 `rewards` 表 |
| **i18n 内容缺失回退** | 社区作者大概率只写一种语言 | 统一回退到 `en`，UI 明确标注"该内容暂无中文版本" |

---

## 六、下一步

**P1 + P2 已收尾**，等待 `git push` 部署与域名切换完成后线上验证。随后启动 **P3 验证闭环**：

- 独立 verifier 仓库（Dockerfile：Lean + Mathlib 缓存 + landrun + lean4export）
- GitHub Actions `workflow_dispatch` 触发 ubuntu runner 跑 comparator
- Next.js Route Handler 提交入队 + 触发 workflow；回调 endpoint（HMAC 校验）写回 `submissions`
- 前端提交状态轮询 / Supabase Realtime 订阅
- 打通一道真题端到端（替换题目页当前 DEMO_USER_ID 兜底查提交）
