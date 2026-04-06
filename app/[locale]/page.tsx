import { getMessages } from "@/lib/messages";
import { isLocale, Locale, defaultLocale } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { redirect } from "next/navigation";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? (rawLocale as Locale) : defaultLocale;
  const t = getMessages(locale) as Record<string, string>;
  // Focus mode: redirect home to practice (lighter, no DB)
  redirect(`/${locale}/practice`);

  return (
    <main className="container mx-auto px-4 py-16">
      <div className="flex items-center justify-between mb-16">
        <nav className="flex gap-6">
          <a href={`/${locale}/catalog`} className="font-medium">{t["nav.catalog"]}</a>
        </nav>
        <LanguageSwitcher current={locale} />
      </div>

      <section className="text-center">
        <h1 className="text-4xl md:text-6xl font-semibold tracking-tight mb-6">
          {t["hero.title"]}
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          {t["hero.subtitle"]}
        </p>
        <div className="mt-10">
          <a
            href={`/${locale}/catalog`}
            className="inline-block bg-black text-white px-6 py-3 rounded-md hover:bg-neutral-800 transition-colors"
          >
            {t["nav.catalog"]}
          </a>
        </div>
      </section>
    </main>
  );
}
