"use client";
import { useEffect, useState } from "react";

type Word = { word: string; translation: string; status: "new" | "learning" | "learned" };
type Block = { id: string; words: Word[] };
type Category = { category: string; level: string; blocks: Block[] };

export default function VocabularyPage() {
  const [data, setData] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/practice/vocabulary");
        const json = await res.json();
        if (!cancelled) setData(json.categories || []);
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
    <main className="container mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold mb-2">Вивчати нові слова</h1>
      <p className="text-sm text-neutral-600 mb-4">Категорії → блоки по 8 слів → статуси.</p>
      {loading && <div>Завантаження…</div>}
      {error && <div className="text-red-600">Помилка: {error}</div>}
      <div className="space-y-6">
        {data.map((cat) => (
          <section key={cat.category} className="border rounded-lg p-4 bg-white">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium">{cat.category} <span className="text-xs text-neutral-500 align-middle">{cat.level}</span></h2>
              <span className="text-xs text-neutral-500">{cat.blocks.length} блок(и)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cat.blocks.map((b) => (
                <div key={b.id} className="border rounded-md p-3">
                  <div className="text-sm font-medium mb-2">Блок {b.id}</div>
                  <ul className="text-sm space-y-1">
                    {b.words.map((w, i) => (
                      <li key={w.word + i} className="flex items-center justify-between">
                        <span>{w.word} — {w.translation}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-neutral-100 text-neutral-600">{w.status}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
