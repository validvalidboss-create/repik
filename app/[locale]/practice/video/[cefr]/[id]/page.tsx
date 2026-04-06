"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { isLocale, defaultLocale, Locale } from "@/lib/i18n";

type Subtitle = { timeStart: number; timeEnd: number; text: string };
type Exercise =
  | { type: "multiple_choice"; question: string; options: string[]; answer: string }
  | { type: "translate"; text: string; answer: string };
type VideoData = {
  id: string;
  title: string;
  level: string;
  duration: number;
  poster?: string;
  src: string;
  description?: string;
  subtitles: Subtitle[];
  exercises?: Exercise[];
};

export default function VideoViewerPageByCefr() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const locale: Locale = isLocale(parts[0]) ? (parts[0] as Locale) : defaultLocale;
  const params = useParams();
  const id = String(params?.id || "");
  const cefr = String(params?.cefr || "A1");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [data, setData] = useState<VideoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showSubs, setShowSubs] = useState(true);
  const [rate, setRate] = useState(1);

  const [selWord, setSelWord] = useState<string | null>(null);
  const [pop, setPop] = useState<{ x: number; y: number } | null>(null);
  const [tr, setTr] = useState<string | null>(null);
  const [trLoading, setTrLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/practice/video/${encodeURIComponent(id)}`);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }, [rate]);

  const onWordClick = async (word: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setSelWord(word);
    setPop({ x: rect.left, y: rect.bottom + 6 });
    setTr(null);
    try {
      setTrLoading(true);
      const cookies = typeof document !== "undefined" ? document.cookie : "";
      const get = (name: string) => cookies.split("; ").find(p => p.startsWith(name+"="))?.split("=")[1];
      const to = decodeURIComponent(get("PREF_TRANSLATE") || get("LOCALE") || locale);
      const r = await fetch(`/api/translate?text=${encodeURIComponent(word)}&from=en&to=${encodeURIComponent(to)}`);
      const j = await r.json();
      setTr(j.translated || "—");
    } finally {
      setTrLoading(false);
    }
  };

  const speak = (text: string) => {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {}
  };

  const addWord = async (word: string) => {
    try {
      await fetch("/api/progress/words", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ word, lang: "en" }) });
    } catch {}
  };

  const [watched, setWatched] = useState(false);
  const onEnded = async () => {
    setWatched(true);
    try {
      await fetch("/api/practice/video/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ videoId: id, progress: { watched: true, cefr } }) });
    } catch {}
  };

  const currentTime = () => videoRef.current?.currentTime || 0;

  const currentSubIndex = useMemo(() => {
    if (!showSubs || !data?.subtitles) return -1;
    const t = currentTime();
    return data.subtitles.findIndex(s => t >= s.timeStart && t <= s.timeEnd);
  }, [showSubs, data]);

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-4"><Link href={`/${locale}/practice/video/${cefr}`} className="text-sm text-neutral-600">← Відео — {cefr}</Link></div>
      {loading && <div>Завантаження…</div>}
      {error && <div className="text-red-600">Помилка: {error}</div>}
      {data && (
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-semibold mb-2">{data.title}</h1>
          <div className="text-sm text-neutral-600 mb-3">{data.level} • {data.duration}s</div>
          <div className="rounded-xl border bg-black overflow-hidden mb-3">
            <video ref={videoRef} className="w-full" controls poster={data.poster} onEnded={onEnded}>
              <source src={data.src} />
            </video>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => setShowSubs(v=>!v)} className="px-3 py-1 rounded border text-sm">{showSubs?"Сховати субтитри":"Показати субтитри"}</button>
            <div className="text-sm">Швидкість:</div>
            {[0.75,1,1.25].map(r => (
              <button key={r} onClick={() => setRate(r)} className={`px-2 py-1 rounded border text-sm ${rate===r?"bg-neutral-900 text-white":""}`}>{r}x</button>
            ))}
          </div>

          {showSubs && (
            <div className="rounded-xl border bg-white p-3 space-y-2">
              {(data.subtitles||[]).map((s, i) => (
                <div key={i} className={`cursor-pointer ${i===currentSubIndex?"bg-yellow-50":""}`} onClick={() => { if(videoRef.current){ videoRef.current.currentTime = s.timeStart + 0.01; videoRef.current.play(); } }}>
                  {splitWords(s.text).map((chunk, idx) => isWord(chunk) ? (
                    <button key={idx} className="inline px-0.5 rounded hover:bg-yellow-100 focus:bg-yellow-100" onClick={(e)=>onWordClick(chunk,e)}>{chunk}</button>
                  ) : (
                    <span key={idx}>{chunk}</span>
                  ))}
                </div>
              ))}
            </div>
          )}

          {watched && (
            <div className="mt-6 rounded-xl border bg-white p-4">
              <div className="font-medium mb-3">Вправи</div>
              {(data.exercises||[]).map((ex, i) => (
                <ExerciseItem key={i} ex={ex} />
              ))}
            </div>
          )}

          {pop && selWord && (
            <div style={{ position: "fixed", left: Math.max(8, Math.min(pop.x, window.innerWidth-260)), top: Math.max(8, pop.y) }} className="z-50 w-[250px] rounded-xl border bg-white shadow-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium">{selWord}</div>
                <button onClick={()=>{setPop(null); setSelWord(null);}} className="text-neutral-500">✕</button>
              </div>
              <div className="text-sm min-h-6">{trLoading?"Переклад…":(tr||"—")}</div>
              <div className="mt-3 flex items-center gap-2">
                <button onClick={()=>speak(selWord)} className="px-2 py-1 rounded border text-sm">🔊</button>
                <button onClick={()=>addWord(selWord)} className="px-2 py-1 rounded border text-sm">＋ в словарь</button>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function splitWords(text: string): string[] { return text.split(/(\b[\w'-]+\b)/g); }
function isWord(s: string) { return /\b[\w'-]+\b/.test(s); }

function ExerciseItem({ ex }: { ex: Exercise }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [correct, setCorrect] = useState<boolean | null>(null);
  if (ex.type === "multiple_choice") {
    return (
      <div className="mb-3">
        <div className="mb-2">{ex.question}</div>
        <div className="flex flex-wrap gap-2">
          {ex.options.map(opt => (
            <button key={opt} onClick={()=>{ setSelected(opt); const ok = opt===ex.answer; setCorrect(ok); setDone(true); }} className={`px-3 py-1 rounded border ${selected===opt?"bg-neutral-900 text-white":""}`}>{opt}</button>
          ))}
        </div>
        {done && <div className={`mt-2 text-sm ${correct?"text-emerald-600":"text-red-600"}`}>{correct?"Вірно":"Невірно"}</div>}
      </div>
    );
  }
  if (ex.type === "translate") {
    return (
      <div className="mb-3">
        <div className="mb-2">Переведи слово: <b>{ex.text}</b></div>
        <div className="text-sm text-neutral-600">Ответ: {ex.answer}</div>
      </div>
    );
  }
  return null;
}
