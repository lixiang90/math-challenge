import type { AppLocale, I18nText } from "./types";

export interface ResolvedText {
  value: string;
  /** True when the requested locale was missing and we fell back to `en`. */
  isFallback: boolean;
}

/**
 * Resolve a jsonb multi-language column for the active locale.
 * Community authors usually write in one language only, so a fallback
 * chain plus an explicit flag lets the UI say "no translation yet".
 */
export function resolveText(
  text: I18nText | null | undefined,
  locale: AppLocale
): ResolvedText {
  if (!text) return { value: "", isFallback: false };
  const direct = text[locale];
  if (direct && direct.trim().length > 0) {
    return { value: direct, isFallback: false };
  }
  return { value: text.en ?? "", isFallback: true };
}

/** Convenience helper when the fallback flag is not needed. */
export function t(
  text: I18nText | null | undefined,
  locale: AppLocale
): string {
  return resolveText(text, locale).value;
}
