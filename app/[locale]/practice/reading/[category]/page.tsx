"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { isLocale, defaultLocale, Locale } from "@/lib/i18n";

type Book = { id: string; title: string; premium?: boolean };
	export default function ReadingCategoryPage() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const locale: Locale = isLocale(parts[0]) ? (parts[0] as Locale) : defaultLocale;
  const params = useParams();
  const category = String(params?.category || "");

  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/practice/reading");
        const json = await res.json();
        const list: Book[] = json.categoryBooks?.[category] || [];
        if (!cancelled) setBooks(list);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [category]);

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-4"><Link href={`/${locale}/practice/reading`} className="text-sm text-neutral-600">← Назад</Link></div>
      <h1 className="text-2xl font-semibold mb-2">{category.replaceAll("-"," ")}</h1>
      {loading && <div>Завантаження…</div>}
      {error && <div className="text-red-600">Помилка: {error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {books.map((b) => (
          <Link key={b.id} href={`/${locale}/practice/reading/${b.id}`} className="rounded-xl border bg-white hover:shadow p-3">
            <div className="aspect-video rounded-lg bg-neutral-100 mb-2 relative">
              {b.premium && <span className="absolute top-2 right-2 text-xs bg-black/80 text-white px-2 py-0.5 rounded">🔒</span>}
            </div>
            <div className="font-medium">{b.title}</div>
            <div className="text-xs text-neutral-500">0 / 40 chapters</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
