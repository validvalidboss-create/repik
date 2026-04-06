"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { isLocale, defaultLocale, Locale } from "@/lib/i18n";

type Sub = { tag: string; text: string };

type Chapter = {
  id: string;
  title: string;
  sub: Sub[];
  audio?: { src: string; duration: number };
};

export default function ReadingChapterPage() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const locale: Locale = isLocale(parts[0]) ? (parts[0] as Locale) : defaultLocale;
  const params = useParams();
  const book = String(params?.book || "");
  const id = String(params?.id || "1");

  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/practice/reading/chapter?bookId=${book}&id=${id}`);
        const json = await res.json();
        if (!cancelled) setChapter(json);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [book, id]);

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-4 flex items-center gap-3">
        <Link href={`/${locale}/practice/reading/book/${book}`} className="text-sm text-neutral-600">← {book.replaceAll("-"," ")}</Link>
      </div>
      {loading && <div>Завантаження…</div>}
      {error && <div className="text-red-600">Помилка: {error}</div>}
      {chapter && (
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold">{chapter.title}</h1>
          <div className="space-y-3">
            {chapter.sub.map((s) => (
              <section key={s.tag}>
                <div className="text-xs font-semibold text-neutral-500 mb-1">{s.tag}</div>
                <p className="text-neutral-800 leading-7">{s.text}</p>
              </section>
            ))}
          </div>
          {chapter.audio?.src && (
            <div className="sticky bottom-3 mt-6 rounded-xl border bg-white p-3 shadow-sm">
              <div className="text-sm font-medium mb-2">Audio</div>
              <audio controls src={chapter.audio.src} className="w-full" />
              <div className="flex items-center justify-between text-xs text-neutral-500 mt-1">
                <span>00:00</span>
                <span>Speed 1.0x</span>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
