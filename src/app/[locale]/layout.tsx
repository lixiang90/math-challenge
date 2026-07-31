import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { SiteHeader } from "@/components/site-header";
import { SessionProvider } from "@/components/session-provider";
import "../globals.css";
import "katex/dist/katex.min.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });
  return {
    title: { default: t("appName"), template: `%s · ${t("appName")}` },
    description: t("tagline"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "footer" });
  const tc = await getTranslations({ locale, namespace: "common" });

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Set the theme class before first paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <NextIntlClientProvider>
          <SessionProvider>
            <div className="flex min-h-screen flex-col">
              <div className="bg-accent-soft px-4 py-1.5 text-center text-[12px] text-accent">
                {tc("mockBanner")}
              </div>
              <SiteHeader />
              <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
                {children}
              </main>
              <footer className="border-t border-rule px-4 py-6 sm:px-6">
                <div className="mx-auto flex max-w-6xl flex-col gap-1 text-[12px] text-ink-faint sm:flex-row sm:justify-between">
                  <span>{t("builtWith")}</span>
                  <span>{t("phase")}</span>
                </div>
              </footer>
            </div>
          </SessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
