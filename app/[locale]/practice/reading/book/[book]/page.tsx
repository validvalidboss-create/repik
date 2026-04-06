"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { isLocale, defaultLocale, Locale } from "@/lib/i18n";

type Chapter = { id: string; title: string; duration: number };

type Book = {
  id: string;
  title: string;
  level: string;
  cover?: string;
  chaptersCount: number;
  description?: string;
  chapters: Chapter[];
  audio?: { src: string; duration: number };
};

export default function ReadingBookPage() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const locale: Locale = isLocale(parts[0]) ? (parts[0] as Locale) : defaultLocale;
  const params = useParams();
  const bookId = String(params?.book || "");

  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/practice/reading/book?bookId=${bookId}`);
        const json = await res.json();
        if (!cancelled) setBook(json);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [bookId]);

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-4"><Link href={`/${locale}/practice/reading`} className="text-sm text-neutral-600">← Reading</Link></div>
      {loading && <div>Завантаження…</div>}
      {error && <div className="text-red-600">Помилка: {error}</div>}
      {book && (
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold">{book.title}</h1>
          <div className="text-sm text-neutral-600">{book.level} • {book.chaptersCount} Chapters</div>
          <div className="aspect-video rounded-lg bg-neutral-100" />
          {book.description && <p className="text-neutral-700">{book.description}</p>}
          <div className="mt-4">
            <h2 className="font-medium mb-2">Chapters</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {book.chapters.map((ch) => (
                <Link key={ch.id} href={`/${locale}/practice/reading/book/${book.id}/chapter/${ch.id}`} className="rounded-lg border p-3 bg-white hover:shadow">
                  <div className="font-medium">{ch.title}</div>
                  <div className="text-xs text-neutral-500">~{Math.round((ch.duration||0)/60)} min</div>
                </Link>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <Link href={`/${locale}/practice/reading/book/${book.id}/chapter/${book.chapters[0]?.id || "1"}`} className="inline-flex items-center px-4 py-2 rounded bg-black text-white">Continue reading</Link>
          </div>
        </div>
      )}
    </main>
  );
}
