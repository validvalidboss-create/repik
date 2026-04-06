"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { isLocale, defaultLocale, Locale } from "@/lib/i18n";

type VideoItem = { id: string; title: string; level: string; duration: number; poster: string; description: string; progress?: number };

export default function VideoListByLevelPage() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const locale: Locale = isLocale(parts[0]) ? (parts[0] as Locale) : defaultLocale;
  const params = useParams();
  const cefr = String(params?.cefr || "A1");

  const [items, setItems] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/practice/video", { signal: ctrl.signal });
        const json = await res.json();
        if (!cancelled) setItems(json.videos || []);
      } catch (e: any) {
        if (!cancelled && e.name !== "AbortError") setError(e?.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; ctrl.abort(); };
  }, [cefr]);

  const filtered = useMemo(() => items.filter(v => v.level === cefr), [items, cefr]);

  return (
    <main className="container mx-auto px-4 py-10">
      <div className="mb-4"><Link href={`/${locale}/practice/video`} className="text-sm text-neutral-600">← Рівні A1–C2</Link></div>
      <h1 className="text-2xl font-semibold mb-2">Відео — {cefr}</h1>
      <p className="text-sm text-neutral-600 mb-4">Оберіть ролик для перегляду.</p>
      {loading && <div>Завантаження…</div>}
      {error && <div className="text-red-600">Помилка: {error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(v => (
          <Link key={v.id} href={`/${locale}/practice/video/${cefr}/${v.id}`} className="rounded-2xl border bg-white overflow-hidden hover:shadow">
            <div className="aspect-video bg-neutral-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v.poster} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="p-3">
              <div className="font-medium">{v.title}</div>
              <div className="text-xs text-neutral-500">{v.level} • {v.duration}s • {Math.round(v.progress||0)}%</div>
              <div className="text-xs text-neutral-600 mt-1 line-clamp-2">{v.description}</div>
            </div>
          </Link>
        ))}
        {!loading && filtered.length === 0 && (
          <div className="text-sm text-neutral-600">Поки що немає відео для {cefr}.</div>
        )}
      </div>
    </main>
  );
}
