# Lean 在线提交与自动验证实施计划

> 修订日期：2026-08-01
>
> 目标：在 `math-challenge.org` 提交 `Submission.lean` / `Submission/**/*.lean`，由 Lean 官方 comparator 流水线验证，并把不可伪造的判定回写网站。
>
> 参考仓库：`leanprover/lean-eval`（题库、生成工作区、comparator 集成）与 `leanprover/lean-eval-submissions`（生产提交流水线）。

## 1. 审计结论

### 1.1 已核实的官方机制

- `Challenge.lean`、`Solution.lean`、`config.json`、`WorkspaceTest.lean` 和 Lake 配置必须来自 pristine `lean-eval` checkout；提交者只控制 `Submission.lean` 与 `Submission/**/*.lean`。
- 不用正则扫描 `sorry` / `native_decide`。comparator 通过公理白名单和常量图比较拒绝 `sorryAx`、`Lean.ofReduceBool` 及声明漂移。
- `WorkspaceTest.lean` 在调用点强制 `enable_nanoda := true`，不能信任或只读取 workspace 自带配置。
- 不可信 Lean 只能由 comparator 的 `safeLakeBuild Solution` 在 landrun 内 elaboration；沙箱外绝不能预编译任何传递导入 `Submission` 的目标。
- 多文件是官方原生能力。官方 `evaluate_submission.py` 会叠加根文件与 `Submission/` 下的 Lean 文件，并拒绝符号链接逃逸。
- 官方提交实现会把与 pristine 完全相同的 `Submission.lean` 视为“未尝试”。因此网站也必须要求根文件发生修改，不能只看整个文件集合的 digest。

### 1.2 对旧方案的关键修正

1. **Verifier 使用 `lean-eval-submissions` 代码库，部署到私有 `lixiang90/math-challenge-eval`，不新建 `lean-eval` fork。** 该代码库已经负责生产评测、pin 审计、安全探针和 `evaluate_submission.py`；新入口只需把网站载荷 materialize 成官方脚本认识的 workspace。
2. **源码不存 `submissions.solution_files`。** 源码只进入私有桶 `submission-payloads`，表中保存 `payload_path` 与 SHA-256；减少 Postgres、备份和 REST 暴露面。
3. **浏览器不能直接创建或更新 submission。** 所有创建经 Next.js Route Handler；用户无 `INSERT/UPDATE` RLS policy，不能自写 `passed`、`verdict` 或积分。
4. **公开榜单不能依靠 `submissions` 的“passed 行公开”策略。** 该策略会连同仓库地址、verdict、日志一起暴露。改为仅公开最小字段、由数据库触发器维护并启用 RLS 的 `solved_submissions` 表。这里不使用 owner view，因为它默认绕过底表 RLS；security-invoker view 又会迫使底表开放读取权限。
5. **回调 URL 不接受 workflow input。** 固定在 GitHub repository variable `MATH_CHALLENGE_CALLBACK_URL`，避免写权限 token 被滥用为任意 URL 请求器。
6. **首期只做在线多文件提交。** repo URL ingest、社区出题、积分和人工复核计分均在核心闭环稳定后接入；它们不应阻塞“提交→验证→判定”。
7. **不自研 comparator wrapper。** 网站 workflow 直接调用官方 `scripts/evaluate_submission.py`，后者再调用 `lake exe lean-eval run-eval --json`。

### 1.3 线上数据库审计（项目 `dzfiwclvxlswdtdhkzpe`）

- 项目健康，Postgres 17；当前有 231 道 `challenge_problems`，`submissions` 为 0 行。
- migration history 只记录 `0003`–`0006`，但 `0007` 对象已存在；说明曾有 DDL 绕过迁移历史。新迁移必须按线上实际 schema 幂等执行。
- 当前 `submissions_update_self` 允许用户更新自己的整行，是上线阻断级漏洞。
- Supabase advisor 还报告：两个可公开调用的 `SECURITY DEFINER` 函数、可变 search path、公开桶列表权限和若干缺失 FK 索引。
- 官方 Supabase MCP 文档建议生产数据使用只读/project scope 或数据库 branch。本次审计阶段先保持只读；代码和测试通过后才由 `apply_migration` 执行 DDL，实施结果见下节。

### 1.4 当前实施状态（2026-08-01）

- `0009_submission_pipeline` 已通过 Supabase MCP 应用到生产库；触发器插入/清理烟测通过。
- 生产库现有 231 道 lean-eval 题均已回填 `verifier_problem_id` 与 pristine 多文件模板，抽样 Unicode Lean 源码无损；`submission_enabled` 仍为 0。
- 网站 Route Handler、编辑器、轮询和 verifier workflow 已在本地实现；GitHub/Vercel secret、workflow 推送和真实端到端灰度尚未执行。
- 生产构建、TypeScript、verifier 定向测试和 Actions SHA pin audit 已通过。Comparator README 新增的 `systemd-run` 防护仍是灰度前阻断项，见第 11 节。

## 2. 首期边界

### 包含

- 登录用户在题目页编辑、增删 `Submission` 模块并提交。
- 私有保存不可变 payload，按用户/题目限流。
- GitHub Actions 在无 secret job 中运行官方 comparator + landrun + nanoda。
- 独立 record job 对原始回调 body 做 HMAC-SHA256 签名。
- Next.js 验签、抗重放、状态机条件更新；前端每 3 秒轮询终态。
- definition hole 验证通过后进入 `review`，不直接算作最终通过。

### 延后

- 外部 repo / private repo ingest。
- 社区出题与题目发布 CI。
- 自动积分、排行榜计分与 definition-hole 管理后台。
- 完整日志写入 `submission-logs`（首期保留 GitHub run URL 和有界 summary）。
- Realtime（轮询足够，且不需要开放 replication）。

## 3. 架构与信任边界

```text
Browser (Supabase GitHub session)
  POST /api/submissions  { problem_id, files }
        │
        ├─ auth.getUser + Origin 检查
        ├─ 路径/数量/字节/模板/配额校验
        ├─ private Storage: submission-payloads/<user>/<submission>.json
        ├─ service_role INSERT submissions(queued)
        └─ GitHub workflow_dispatch（1 小时 signed read URL）
                         │
                         ▼
lean-eval-submissions / evaluate job（无 secrets、contents:read）
  下载并二次校验 payload → materialize workspace
  checkout pristine lean-eval → 安装全部固定 SHA 工具
  删除 .git → 运行 sandbox/env probes
  官方 evaluate_submission.py → run-eval → comparator/landrun/nanoda
                         │
              仅上传 results 与静态错误类别（不上传源码或编译 stderr）
                         ▼
record job（新 runner，仅此 job 有 HMAC secret）
  固定 callback URL → timestamp.body HMAC → 3 次重试 POST
                         │
                         ▼
POST /api/verify/callback
  常量时间验签 + 5 分钟窗口 + attempt/problem 匹配
  queued/running → passed|failed|error|timeout|review
                         │
                         ▼
Browser GET /api/submissions/:id（仅提交者）每 3 秒轮询
```

评测 job 不能拥有 GitHub App、Supabase service role、callback secret 或 `actions:write`。任何需要 secret 的操作都必须在新的 runner/job 中完成。

## 4. 提交载荷规范

载荷 schema v1：

```json
{
  "schema_version": 1,
  "submission_id": "uuid",
  "problem_id": "two_plus_two",
  "solution_digest": "sha256(canonical(files))",
  "files": {
    "Submission.lean": "...",
    "Submission/Helpers.lean": "..."
  }
}
```

服务端与 verifier 必须各执行一次相同约束：

| 约束 | 值 |
|---|---|
| 路径 | 仅 `Submission.lean` 或 `Submission/<Lean 标识符路径>.lean` |
| 深度 | `Submission/` 下最多 4 段 |
| 文件数 | 1–32，必须有非空根文件 |
| 单文件 | ≤ 256 KiB UTF-8 |
| 总源码 | ≤ 1 MiB UTF-8 |
| 拒绝 | 绝对/隐藏/`..`/反斜杠/控制字符/Windows 保留名/大小写重复 |
| 未修改 | `Submission.lean` 与 pristine 根模板逐字节相同时拒绝 |
| 完整性 | 对按路径排序、无多余空白的 JSON 做 SHA-256，verifier 重算 |

前端 import 图分析仅用于提示孤立辅助文件；它不是安全判定，也不能代替 Lean 构建图。

## 5. 数据库与 Storage（migration `0009_submission_pipeline.sql`）

### `challenge_problems`

- `verifier_problem_id text`：官方 generated workspace id。
- `submission_templates jsonb`：pristine 多文件模板。
- `submission_enabled boolean default false`：只有模板同步完且 verifier 已就绪时开启。

### `submissions`

- `source_kind`、`payload_path`、`solution_digest`。
- `verifier_problem_id` 快照与 `benchmark_commit`，保证历史可解释。
- `dispatch_attempt`、`queued_at`、`callback_received_at`、`error_message`。
- repo 三列改为 nullable，为后续 adapter 保留。
- partial unique index：同用户同题最多一条 `queued/running`。
- 用户只可 SELECT 自己的记录；创建、状态和 verdict 更新只走 service role。

### Storage

- `submission-payloads`：private，1.5 MiB object cap，只有 service role；Actions 使用一次短时签名 URL。
- `submission-logs`：private，预留后续有界完整日志。
- signed URL 是 bearer capability，workflow 第一步立即 `add-mask`，不在日志回显。

### 公开聚合

`solved_submissions` 只公开 `id/problem_id/user_id/status/timestamps`。项目 solver count、题目 solver list、排行榜改查该 RLS 表；不再公开 submission 全行。表只能由 `submissions` 上的数据库触发器同步，`anon/authenticated` 仅有 `SELECT` 权限。

## 6. API 状态机

```text
queued → running → passed
                 → failed
                 → error
                 → timeout
                 → review   (comparator passed + definition_names 非空)
```

- POST 创建时先校验 auth、题目 open/published/enabled、模板、冷却和日配额。
- payload 上传成功后才 INSERT；任一步失败都清理已创建对象/行。
- `workflow_dispatch` 204 后将状态推进为 `running`。
- callback 只能更新 attempt 相同且仍处于 `queued/running` 的行；终态重复回调幂等返回。
- 回调签名输入为 `timestamp + "." + rawBody`；timestamp 与服务器相差不得超过 5 分钟。
- 第一阶段的 quota 查询是应用层防刷，partial unique index是并发最后防线。大流量前应把配额和 claim-next-queued 下沉为原子 SQL function。

## 7. Verifier workflow

`verify-website-submission.yml`：

### evaluate job

1. checkout `lean-eval-submissions` 与 pristine `leanprover/lean-eval`，均 `persist-credentials:false`。
2. 记录 benchmark commit，立即下载 signed payload 并二次校验。
3. 使用与官方 production workflow 相同的 SHA pin 安装 landrun、lean4export、comparator、nanoda。
4. 删除所有 `.git`，执行 `sandbox_engaged_probe.py` 和 `env_dump_probe.py`。
5. 调用官方 `evaluate_submission.py`，将 stdout/stderr 留在 runner 临时盘且不写 Actions 日志；只上传 `results.json` 或不含源码的静态错误类别。`summary.json` 可能含诊断文本，首期不跨 job 传递。

### record job

- `needs:evaluate` + `if:always()`，独立 runner。
- callback URL 取 repository variable；HMAC secret 取 Actions secret。
- 生成 schema v1 callback，签名后指数退避重试 3 次。

所有 `uses:`、Go 安装和 Git checkout 均固定 40 位 SHA，并由现有 `action_pin_audit.py` 审计。

## 8. 配置

### Vercel

- `VERIFIER_REPO` 必须指向私有仓库；workflow input 含一小时 signed payload URL，公开 verifier 仓库不可上线。
- `VERIFIER_REPO=lixiang90/math-challenge-eval`
- `VERIFIER_GITHUB_TOKEN=<只对该仓库 actions:write 的 fine-grained PAT>`
- `VERIFIER_REF=main`
- `VERIFIER_WORKFLOW=verify-website-submission.yml`
- `VERIFIER_CALLBACK_SECRET=<至少 32 随机字节>`
- `VERIFIER_COOLDOWN_SECONDS=600`
- `VERIFIER_DAILY_QUOTA=20`
- 已有 `SUPABASE_SERVICE_ROLE_KEY` 继续仅服务端使用。

### GitHub verifier repo

- repository variable `MATH_CHALLENGE_CALLBACK_URL=https://math-challenge.org/api/verify/callback`
- Actions secret `VERIFIER_CALLBACK_SECRET`，与 Vercel 完全相同。
- workflow 默认权限保持只读；不启用 fork PR secrets。

## 9. 交付顺序与上线闸门

| 阶段 | 内容 | 闸门 |
|---|---|---|
| A | migration、RLS、私有桶 | advisor 无新增高危项；用户不可 insert/update submissions |
| B | sync 脚本回填模板 | 上游全部题目都有根模板，抽样多文件路径正确；尚不启用前端提交 |
| C | API、编辑器、轮询 | TypeScript 与 production build 通过；非法路径/配额/鉴权测试通过 |
| D | verifier workflow | 正确单文件、多文件 pass；`sorry`、声明漂移、非法 payload fail |
| E | 配 secret/variable 并开启 `submission_enabled` | 在生产只开放 `two_plus_two` 灰度，通过后再全量 |
| F | 运行 Supabase security/performance advisor | 提交策略、函数 ACL、索引符合预期 |

数据库迁移可先上线，因为新列默认 `submission_enabled=false`；workflow、Vercel secret 和真实 E2E 未就绪前不得批量开启。
`sync-lean-eval.mjs` 默认也始终写入 `submission_enabled=false`；只有显式传入 `--enable-submissions` 才会批量开启。生产灰度应直接只更新选定题目的这一列，不使用该批量开关。

## 10. 验收用例

- 未登录、跨 Origin、错误 UUID、题目 closed/disabled 均拒绝。
- 缺根文件、空文件、超大小、大小写冲突、路径穿越、Windows 保留名均在 API 与 verifier 双重拒绝。
- 用户无法通过 Supabase anon/authenticated client 创建或修改 submission verdict。
- 正确 `two_plus_two` 单文件通过；`sorry` 失败。
- 把引理放进 `Submission/Helpers.lean` 并由根文件 import 的多文件解通过。
- 只改 helper、根文件保持 pristine 时明确拒绝。
- callback 错 secret、过期 timestamp、错误 attempt/problem 均拒绝；同一终态 callback 幂等。
- definition-hole 正确解进入 `review` 而非 `passed`。
- workflow setup/超时也能回写 `error/timeout`，不留下永久 running。

## 11. 剩余风险与后续

- **Comparator 上游运行包装变化。** 当前 comparator README 新增了用 `systemd-run` 限制 AF_UNIX 的建议，而本地官方 `lean-eval-submissions` pin/workflow 尚未采用。生产灰度前必须在目标 runner 上核对该 pin 的适用性；若适用，应先在官方安全探针下验证 wrapper，不能凭猜测改调用链。
- **GitHub hosted runner 冷启动慢。** 首期接受分钟级延迟；量上来后使用经过同样探针的 self-hosted runner 和只读依赖缓存。
- **signed URL 在 workflow input 中是短时 capability。** 首期强制 verifier 仓库私有、时效一小时并在下载前 mask；公开仓库或更严格威胁模型必须改用 verifier GitHub App/Edge Function 单次 claim token。
- **队列没有独立调度器。** 首期每个通过 API 的提交立即 dispatch；大流量前增加原子 DB queue claim + cron reconciler。
- **源码保留策略。** 上线前应明确 payload 保留期限和用户告知；若要像官方一样永久审计，应引入 age 加密归档，而不是长期保留明文 object。
- **社区出题是另一信任级别。** `Challenge.lean` 可在编译期执行 IO，必须独立设计管理员审核、digest 锁定、无 secret generate job 与白名单 publish job，不能混进提交 MVP。
