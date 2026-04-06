"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isLocale, defaultLocale, Locale } from "@/lib/i18n";

type Category = { slug: string; title: string; books: number; level: string; premium?: boolean; image?: string };
type Demo = { id: string; title: string; level: string; cover?: string; premium?: boolean; chaptersCount?: number };

export default function ReadingPage() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const locale: Locale = isLocale(parts[0]) ? (parts[0] as Locale) : defaultLocale;

  const [cats, setCats] = useState<Category[]>([]);
  const [demo, setDemo] = useState<Demo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/practice/reading");
        const json = await res.json();
        if (!cancelled) {
          setCats(json.categories || []);
          setDemo(json.demo || []);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-4"><Link href={`/${locale}/practice`} className="text-sm text-neutral-600">← Назад</Link></div>
      <h1 className="text-2xl font-semibold mb-2">Reading</h1>
      {loading && <div>Завантаження…</div>}
      {error && <div className="text-red-600">Помилка: {error}</div>}

      {/* Demo readings */}
      <section className="mt-4">
        <h2 className="text-lg font-medium mb-2">Demo readings</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {demo.map((b) => (
            <Link key={b.id} href={`/${locale}/practice/reading/book/${b.id}`} className="rounded-xl border bg-white hover:shadow p-3">
              <div className="aspect-video rounded-lg bg-neutral-100 mb-2" />
              <div className="font-medium">{b.title}</div>
              <div className="text-xs text-neutral-500">{b.level}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="mt-6">
        <h2 className="text-lg font-medium mb-2">Categories</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cats.map((c) => (
            <Link key={c.slug} href={`/${locale}/practice/reading/category/${c.slug}`} className="rounded-xl border bg-white hover:shadow p-3">
              <div className="aspect-video rounded-lg bg-neutral-100 mb-2 relative">
                {c.premium && <span className="absolute top-2 right-2 text-xs bg-black/80 text-white px-2 py-0.5 rounded">🔒</span>}
              </div>
              <div className="font-medium">{c.title}</div>
              <div className="text-xs text-neutral-500">{c.books} books • {c.level}</div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
