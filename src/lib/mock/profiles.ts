import type { Profile } from "@/lib/types";

export const profiles: Profile[] = [
  {
    id: "u_ai",
    github_login: "xiao-ai",
    display_name: "小艾",
    avatar_url: null,
    bio: { en: "Formalizing analysis, one lemma at a time.", zh: "一次一条引理地形式化分析学。" },
    total_points: 260,
    created_at: "2026-01-12T08:00:00Z",
  },
  {
    id: "u_kovacs",
    github_login: "akovacs",
    display_name: "András Kovács",
    avatar_url: null,
    bio: { en: "Type theory, elaboration, Lean internals." },
    total_points: 720,
    created_at: "2025-09-03T10:20:00Z",
  },
  {
    id: "u_mei",
    github_login: "meiling",
    display_name: "Mei Ling",
    avatar_url: null,
    bio: { en: "Number theory enthusiast.", zh: "数论爱好者。" },
    total_points: 505,
    created_at: "2025-11-18T02:40:00Z",
  },
  {
    id: "u_dubois",
    github_login: "cdubois",
    display_name: "Camille Dubois",
    avatar_url: null,
    bio: { en: "Category theory and formal topology." },
    total_points: 340,
    created_at: "2026-02-01T14:05:00Z",
  },
  {
    id: "u_tanaka",
    github_login: "rtanaka",
    display_name: "Ryo Tanaka",
    avatar_url: null,
    bio: { en: "Combinatorics, olympiad formalization." },
    total_points: 185,
    created_at: "2026-03-22T06:15:00Z",
  },
  {
    id: "u_ortiz",
    github_login: "dortiz",
    display_name: "Diego Ortiz",
    avatar_url: null,
    bio: { en: "Measure theory, probability." },
    total_points: 95,
    created_at: "2026-04-30T19:00:00Z",
  },
];

/** The demo session used by the phase-1 fake auth toggle. */
export const DEMO_USER_ID = "u_ai";

export function profileById(id: string): Profile {
  const found = profiles.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown profile: ${id}`);
  return found;
}
