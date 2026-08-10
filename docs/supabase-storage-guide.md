# Supabase Storage 权限说明（给操作存储桶的 agent）

> 适用项目：`math-challenge`
> 用途：解决「操作 Supabase 存储桶时频繁遇到 403 / 401 / RLS 报错」的问题。
> 先读 TL;DR，再对照「故障排查表」。仓库里已有可用范式：`supabase/migrations/0005_content_storage.sql`。

---

## 0. TL;DR（三句话建立心智模型）

1. **Supabase 有 3 把钥匙，权限天差地别**：`anon`（浏览器公开，受 RLS 限制）、`authenticated`（登录用户，受 RLS 限制）、`service_role`（服务端密钥，**绕过 RLS**，绝不可进浏览器）。
2. **桶的 public 标志 ≠ 权限策略**。私有桶即使存在也默认「谁都读不了、谁都写不了」，除非有签名 URL 或显式策略；公开桶可直接用 URL 直链。
3. **权限写在哪**：存储权限就是 `storage.objects` 这张 Postgres 表的 **RLS 策略**。桶不存在就建桶（`storage.buckets`），对象能不能读写由 `storage.objects` 上的策略决定。`service_role` 不受这些策略约束。

---

## 1. 三把钥匙（最关键，先搞清你用的是哪把）

| 钥匙 | 来源 | 受 RLS 约束 | 能用在哪里 |
|---|---|---|---|
| `anon` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY`（前端可见） | **是** | 浏览器 / 客户端；只能做策略允许的操作 |
| `authenticated` | 登录后的会话（仍用 anon key + JWT） | **是** | 已登录用户；权限由策略按 `auth.uid()` 控制 |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY`（**仅服务端**） | **否（完全绕过）** | Vercel 函数、同步脚本、CI 回写等后端 |

**最常见的权限 bug**：拿 `anon` key 去做上传/建桶，结果 401/403。上传、建桶、回写库这类**写操作一律用 `service_role`**，且只在服务端代码里。前端只能做「策略允许」的读，或拿着服务端下发的**签名 URL**去读私有对象。

> ⚠️ `service_role` 绕过 RLS 是设计行为，不是 bug。给它套 RLS 策略**不会生效**。因此「限制 service_role 只能写某个桶」做不到，只能靠代码纪律（只调该调的桶）。

---

## 2. 公开桶 vs 私有桶

- **公开桶（`public = true`）**：对象可通过固定 URL 免鉴权直链（如 `project-content`）。但仍建议像 `0005` 那样显式建一条 `SELECT` 策略，语义清晰。
- **私有桶（`public = false`）**：对象**不能**用 URL 直链。读取只有两条路：
  1. **签名 URL**（`createSignedUrl`，由 `service_role` 生成，带过期时间，单次有效）—— 适合「把私有对象临时交给外部系统（如 GitHub Actions）」；
  2. **SELECT 策略**允许某个角色读 —— 适合「登录用户读自己的东西」。

本项目两个新桶都是**私有桶**：
- `submission-payloads`：载荷。服务端用 `service_role` 写，验证时给 verifier 一个**签名 URL**下载。→ 这个桶**不需要任何策略**（默认拒绝 anon/authenticated 即可，service_role 本就绕过）。
- `submission-logs`：日志。提交者本人 + 站点管理员读。→ 需要一条 **SELECT 策略**（见第 4 节）。

---

## 3. 策略写在 `storage.objects` 上

策略用 `bucket_id`（桶名）、`name`（对象路径，如 `submissions/abc.json`）、`owner`（上传者 uuid）以及两个 helper 函数：

- `storage.foldername(name)` → 路径各段组成的 `text[]`（不含文件名）。`"a/b/c.txt"` 得到 `['a','b']`。
- `storage.filename(name)` → 最后一段 `'c.txt'`。

**要点**：
- 策略要 `on storage.objects`，且 `bucket_id = 'xxx'` 必须**精确匹配**桶名，否则不生效。
- 没给某操作建策略 = 该操作对 anon/authenticated **默认拒绝**（service_role 仍可读写）。

---

## 4. 本项目两个新桶的推荐建法（可直接落迁移）

> 路径约定：`submission-logs/<user_id>/<submission_id>.log`（把 user_id 放路径前缀，便于用 `storage.foldername(name)[1]` 做策略，而非依赖可能为 null 的 `owner`）。

```sql
-- ===== 桶创建（幂等）=====
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('submission-payloads', 'submission-payloads', false, 1048576),   -- 1 MiB
  ('submission-logs',     'submission-logs',     false, 10485760)   -- 10 MiB
on conflict (id) do update set public = false;

-- ===== submission-payloads：不建任何策略 =====
-- 服务端用 service_role 写；外部 verifier 用 service_role 生成的「签名 URL」读。
-- 默认拒绝 anon/authenticated 正是我们想要的效果，无需额外策略。

-- ===== submission-logs：提交者本人或管理员可读 =====
drop policy if exists "submission_logs_read" on storage.objects;
create policy "submission_logs_read"
  on storage.objects for select
  using (
    bucket_id = 'submission-logs'
    and (
      storage.foldername(name)[1] = auth.uid()::text
      or exists (
        select 1 from site_admins
        where user_id = auth.uid() and revoked_at is null
      )
    )
  );
-- 写入由 service_role 完成，不需要 INSERT 策略（默认拒绝 anon/auth 即可）。
```

**服务端生成签名 URL（给 verifier 拉载荷）示例**：
```js
// SERVER ONLY —— 用 service_role
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY   // 绕过 RLS
);
const { data } = await supabase.storage
  .from('submission-payloads')
  .createSignedUrl(`submissions/${id}.json`, 60 * 30);  // 30 分钟有效
// data.signedUrl → 通过 workflow_dispatch 的 payload_url 传给 GitHub Actions
```
verifier 侧只需 `curl "$SIGNED_URL"`，**不需要任何 Supabase 客户端或密钥**。

**服务端写入日志（service_role）示例**：
```js
await supabase.storage
  .from('submission-logs')
  .upload(`${userId}/${submissionId}.log`, logText, {
    contentType: 'text/plain',
    upsert: true,
  });
```

---

## 5. 故障排查表（对着现象找原因）

| 现象 | 根因 | 修复 |
|---|---|---|
| 上传 401 Unauthorized | 用了 `anon` key，且无 INSERT 策略 | 服务端改用 `service_role`；或建 INSERT 策略 |
| 上传 403 Forbidden | 路径/桶名不匹配策略，或被 RLS 默认拒绝 | 核对 `bucket_id` 精确匹配；建对应策略 |
| 私有桶对象用 URL 直链 403 / 404 | 私有桶不能直链 | 用 `createSignedUrl`（service_role）或建 SELECT 策略 |
| `createSignedUrl` 报错 / 返回 null | 用 `anon` key 调用（无权限）或路径不存在 | 必须用 `service_role` 生成；确认对象已存在 |
| 上传成功但提交者读不到日志 | `service_role` 上传时 `owner` 为 null，`owner = auth.uid()` 策略匹配不上 | 改用「路径前缀 = user_id」的策略（见第 4 节），别依赖 `owner` |
| 策略建了却不生效 | `bucket_id` 写错 / 没用 `storage.foldername` / RLS 其实已生效只是条件不满足 | 用 `select bucket_id, name from storage.objects` 核对实际值 |
| MCP 能建桶，但 API 上传 403 | MCP 用管理员角色跑 DDL；API 用 `anon` → 缺策略 | API 侧用 `service_role`，或补策略 |
| `new row violates row-level security policy` | 对 `storage.objects` 的 INSERT 被 RLS 拦截 | 服务端走 `service_role`，或建 INSERT 策略 |
| 浏览器里 `service_role` 报错/被警告 | 把服务端密钥暴露到了前端 | 立刻换掉该密钥，前端只用 `anon` + 策略/签名 URL |

---

## 6. 上线前自检清单

- [ ] 桶已存在且 `public` 标志正确（payloads/logs 都应是 `false`）。
- [ ] **所有写操作**（建桶走 SQL 除外）都在服务端用 `service_role`，密钥不进前端。
- [ ] 前端读私有对象：要么走服务端下发的**签名 URL**，要么有对应的 **SELECT 策略**（公开桶才可直链）。
- [ ] 策略 `on storage.objects`，`bucket_id` 精确匹配，路径判断用 `storage.foldername/filename`。
- [ ] 不要试图给 `service_role` 套 RLS（无效）。
- [ ] 路径约定统一（日志用 `<user_id>/<id>` 前缀），便于策略按前缀授权。
- [ ] 改动后实测：用 `service_role` 上传一个对象 → 用 `anon` 直链读应**失败**（确认不是公开桶）→ 用签名 URL 读应**成功** → 用提交者会话读自己的日志应**成功**、读别人的应**失败**。

---

## 7. 对照本项目已验证范式

`supabase/migrations/0005_content_storage.sql` 是仓库里**唯一已跑通**的存储迁移，模式如下，新桶照它写最稳：

1. `insert into storage.buckets (...) on conflict (id) do update ...` 幂等建桶；
2. 公开桶显式建一条 `for select` 策略 `using (bucket_id = '...')`；
3. 写操作一律不依赖策略（由 `service_role` 在服务端完成）。

新桶与之唯一区别：`submission-payloads` / `submission-logs` 是**私有桶**，payloads 连 SELECT 策略都不需要（签名 URL 即可），logs 仅需一条「本人或管理员」的 SELECT 策略。
