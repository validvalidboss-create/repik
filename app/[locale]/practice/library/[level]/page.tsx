"use client";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { isLocale, defaultLocale, Locale } from "@/lib/i18n";
import { useEffect, useState } from "react";

type Book = { id: string; title: string; chaptersCount: number };

export default function LibraryLevelPage() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const locale: Locale = isLocale(parts[0]) ? (parts[0] as Locale) : defaultLocale;
  const params = useParams();
  const level = String(params?.level || "A1");

  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/practice/library");
        const json = await res.json();
        const byCat = json.booksByLevelCategory?.[level] || {};
        const flat = (Object.values(byCat).flat() as unknown[]) as Book[];
        if (!cancelled) setBooks(flat);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [level]);

  return (
    <main className="container mx-auto px-4 py-10">
      <div className="mb-4"><Link href={`/${locale}/practice/library`} className="text-sm text-neutral-600">← {level}</Link></div>
      <h1 className="text-2xl font-semibold mb-2">{level}</h1>
      {loading && <div>Завантаження…</div>}
      {error && <div className="text-red-600">Помилка: {error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {books.map((b) => (
          <Link key={b.id} href={`/${locale}/practice/library/${level}/${b.id}`} className="rounded-2xl border bg-white hover:shadow overflow-hidden">
            <div className="aspect-video bg-neutral-100" />
            <div className="p-3">
              <div className="font-medium">{b.title}</div>
              <div className="text-xs text-neutral-500">{b.chaptersCount} chapters</div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
