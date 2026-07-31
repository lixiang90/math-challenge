import type { AppLocale } from "@/lib/types";

/**
 * lean-eval 挑战的数学分类标签 → 中英文显示名。
 *
 * 标签值（slug）源自 lean-eval `manifests/problems/<id>.toml` 的
 * `module = "LeanEval.<分类>.<Name>"` 第二段，slug 化后写入项目的 `tags`。
 * 这里只负责把 slug 渲染成人类可读的名字，不参与存储。
 */
export const CATEGORY_LABELS: Record<string, { en: string; zh: string }> = {
  algebra: { en: "Algebra", zh: "代数" },
  "algebraic-geometry": { en: "Algebraic Geometry", zh: "代数几何" },
  analysis: { en: "Analysis", zh: "分析" },
  "category-theory": { en: "Category Theory", zh: "范畴论" },
  combinatorics: { en: "Combinatorics", zh: "组合数学" },
  "complex-analysis": { en: "Complex Analysis", zh: "复分析" },
  "condensed-mathematics": { en: "Condensed Mathematics", zh: "凝聚数学" },
  "convex-geometry": { en: "Convex Geometry", zh: "凸几何" },
  dynamics: { en: "Dynamics", zh: "动力系统" },
  "game-theory": { en: "Game Theory", zh: "博弈论" },
  geometry: { en: "Geometry", zh: "几何" },
  "group-theory": { en: "Group Theory", zh: "群论" },
  "knot-theory": { en: "Knot Theory", zh: "纽结理论" },
  "linear-algebra": { en: "Linear Algebra", zh: "线性代数" },
  "model-theory": { en: "Model Theory", zh: "模型论" },
  "number-theory": { en: "Number Theory", zh: "数论" },
  physics: { en: "Physics", zh: "物理" },
  "program-verification": { en: "Program Verification", zh: "程序验证" },
  "representation-theory": { en: "Representation Theory", zh: "表示论" },
  sandbox: { en: "Sandbox", zh: "沙盒" },
  "easy-problems": { en: "Easy Problems", zh: "入门题" },
  topology: { en: "Topology", zh: "拓扑" },
};

/** 平台/元数据标签（非数学分类），在筛选与卡片上应与分类区分展示。 */
export const PLATFORM_TAGS = new Set([
  "lean-eval",
  "comparator",
  "lean4",
  "test-problem",
]);

/** 判断一个 tag 是否为数学分类标签。 */
export function isSubjectTag(tag: string): boolean {
  return tag in CATEGORY_LABELS;
}

/** 取分类标签的显示名；非分类标签原样返回。 */
export function categoryLabel(tag: string, locale: AppLocale): string {
  const entry = CATEGORY_LABELS[tag];
  if (!entry) return tag;
  return locale === "zh" ? entry.zh : entry.en;
}
