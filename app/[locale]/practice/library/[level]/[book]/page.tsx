"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { isLocale, defaultLocale, Locale } from "@/lib/i18n";

 type ContentBlock =
  | { type: "h2"; text: string }
  | { type: "p"; text: string }
  | { type: "img"; src: string; alt?: string };

type Book = {
  id: string;
  title: string;
  level: string;
  chaptersCount: number;
  description?: string;
  content?: ContentBlock[];
  audio?: { src: string; duration: number };
};

export default function LibraryBookSimplePage() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const locale: Locale = isLocale(parts[0]) ? (parts[0] as Locale) : defaultLocale;
  const params = useParams();
  const level = String(params?.level || "A2");
  const bookId = String(params?.book || "");

  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selWord, setSelWord] = useState<string | null>(null);
  const [pop, setPop] = useState<{x:number;y:number}|null>(null);
  const [tr, setTr] = useState<{translated:string;definitions?:string[]}|null>(null);
  const [trLoading, setTrLoading] = useState(false);
  const popRef = useRef<HTMLDivElement|null>(null);

  const getPreferredLang = (fallback: Locale): string => {
    try {
      const cookies = typeof document !== "undefined" ? document.cookie : "";
      const get = (name: string) => cookies.split("; ").find(p => p.startsWith(name+"="))?.split("=")[1];
      return decodeURIComponent(get("PREF_TRANSLATE") || get("LOCALE") || fallback);
    } catch {
      return fallback;
    }
  };

  const refetchTranslate = async (word: string) => {
    try {
      setTrLoading(true);
      const to = getPreferredLang(locale);
      const data = await translate(word, "en", to);
      setTr({ translated: data.translated, definitions: data.definitions });
    } finally {
      setTrLoading(false);
    }
  };

  const onWordClick = async (word: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setSelWord(word);
    setPop({ x: rect.left, y: rect.bottom + 6 });
    setTr(null);
    await refetchTranslate(word);
  };

  const speak = (text: string) => {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {}
  };

  const addToProgress = async (word: string) => {
    try {
      await fetch("/api/progress/words", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ word, lang: "en" }) });
    } catch {}
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/practice/library/book?level=${encodeURIComponent(level)}&book=${encodeURIComponent(bookId)}`);
        const json = await res.json();
        if (!cancelled) setBook(json);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [level, bookId]);

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-4"><Link href={`/${locale}/practice/library/${level}`} className="text-sm text-neutral-600">← {level}</Link></div>
      {loading && <div>Завантаження…</div>}
      {error && <div className="text-red-600">Помилка: {error}</div>}
      {book && (
        <article className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-semibold mb-1">{book.title}</h1>
          <div className="text-sm text-neutral-600 mb-4">Level: {book.level} • {book.chaptersCount} Chapters</div>
          <div className="aspect-video rounded-lg bg-neutral-100 mb-4" />
          {book.audio?.src && (
            <div className="sticky top-16 z-10 rounded-xl border bg-white p-3 shadow-sm mb-6">
              <div className="text-sm font-medium mb-2">Audio</div>
              <audio controls className="w-full" src={book.audio.src} />
            </div>
          )}
          {book.description && <p className="text-neutral-800 leading-7 mb-4">{book.description}</p>}
          <div className="prose max-w-none">
            {(book.content || []).map((b, i) => {
              if (b.type === "h2") return <h2 key={i}>{b.text}</h2>;
              if (b.type === "p") return (
                <p key={i}>
                  {splitWords(b.text).map((chunk, idx) =>
                    isWord(chunk) ? (
                      <button
                        key={idx}
                        onClick={(e) => onWordClick(chunk, e)}
                        className="inline px-0.5 rounded hover:bg-yellow-100 focus:bg-yellow-100"
                      >
                        {chunk}
                      </button>
                    ) : (
                      <span key={idx}>{chunk}</span>
                    )
                  )}
                </p>
              );
              if (b.type === "img") return (
                <div key={i} className="my-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.src} alt={b.alt || ""} className="rounded-lg w-full" />
                </div>
              );
              return null;
            })}
          </div>
          {pop && selWord && (
            <div
              ref={popRef}
              style={{ position: "fixed", left: Math.max(8, Math.min(pop.x, window.innerWidth-260)), top: Math.max(8, pop.y) }}
              className="z-50 w-[250px] rounded-xl border bg-white shadow-lg p-3 animate-in fade-in zoom-in"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium">{selWord}</div>
                <button aria-label="close" onClick={() => { setPop(null); setSelWord(null); }} className="text-neutral-500 hover:text-black">✕</button>
              </div>
              <div className="text-sm min-h-6">
                {trLoading ? "Переклад…" : (tr?.translated || "—")}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button onClick={() => speak(selWord)} className="px-2 py-1 rounded border text-sm">🔊</button>
                <button onClick={() => addToProgress(selWord)} className="px-2 py-1 rounded border text-sm">＋ до прогресу</button>
                <button onClick={() => refetchTranslate(selWord)} className="px-2 py-1 rounded border text-sm">↻</button>
              </div>
            </div>
          )}
        </article>
      )}
    </main>
  );
}

function splitWords(text: string): string[] {
  return text.split(/(\b[\w'-]+\b)/g);
}
function isWord(s: string) {
  return /\b[\w'-]+\b/.test(s);
}

async function translate(word: string, from: string, to: string) {
  const res = await fetch(`/api/translate?text=${encodeURIComponent(word)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  if (!res.ok) throw new Error("translate failed");
  return res.json();
}

