import type { AppLocale, ProjectContent } from "@/lib/types";

/**
 * 项目正文的读取层。
 *
 * 正文不再存在 Postgres 行里，而是按语种放在公开桶 `project-content`：
 *
 *     projects/<slug>/en.md
 *     projects/<slug>/zh.md
 *
 * 公开桶意味着可以直接走 CDN 边缘的 `/storage/v1/object/public/...`，
 * 不需要带任何密钥，也不消耗 PostgREST 连接。列表页完全不碰这里——
 * 卡片只用表内的 title / summary，正文仅在详情页按需拉一次。
 */

const BUCKET = "project-content";
const TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  expires: number;
  content: ProjectContent;
}
const cache = new Map<string, CacheEntry>();

function publicUrl(path: string): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || base.toLowerCase().includes("your-project-ref")) return null;
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/${path}`;
}

/**
 * 取项目正文，按 `locale → en` 回退。
 *
 * `content_locales` 已经告诉我们有哪些语种，所以这里最多发一次请求，
 * 不需要先试目标语种再试英文。
 */
export async function getProjectContent(
  contentPath: string | null | undefined,
  contentLocales: AppLocale[] | null | undefined,
  locale: AppLocale
): Promise<ProjectContent> {
  if (!contentPath) return { value: "", isFallback: false };

  const available = contentLocales?.length ? contentLocales : (["en"] as AppLocale[]);
  const hit = available.includes(locale) ? locale : "en";
  const isFallback = hit !== locale;

  const key = `${contentPath}#${hit}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.content;

  const url = publicUrl(`${contentPath}/${hit}.md`);
  if (!url) return { value: "", isFallback: false };

  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return { value: "", isFallback };
    const content: ProjectContent = { value: await res.text(), isFallback };
    cache.set(key, { expires: Date.now() + TTL_MS, content });
    return content;
  } catch {
    return { value: "", isFallback };
  }
}

/** 写入侧：把某个语种的正文推进桶里。需要 service role（绕过 RLS）。 */
export async function putProjectContent(
  contentPath: string,
  locale: AppLocale,
  markdown: string
): Promise<void> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key || key.toLowerCase().includes("your-ser")) {
    throw new Error("putProjectContent 需要配置 SUPABASE_SERVICE_ROLE_KEY");
  }
  const res = await fetch(
    `${base.replace(/\/$/, "")}/storage/v1/object/${BUCKET}/${contentPath}/${locale}.md`,
    {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "text/markdown; charset=utf-8",
        "x-upsert": "true",
      },
      body: markdown,
    }
  );
  if (!res.ok) {
    throw new Error(`正文写入失败 (${res.status}): ${await res.text()}`);
  }
  cache.delete(`${contentPath}#${locale}`);
}

/** 项目 slug → Storage 前缀。集中一处，避免各调用点各拼各的。 */
export function contentPathFor(slug: string): string {
  return `projects/${slug}`;
}
