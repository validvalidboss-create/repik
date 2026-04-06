"use client";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useParams, usePathname } from "next/navigation";

const LEVELS = (count: number) => Array.from({ length: count }).map((_, i) => ({ id: `L${i + 1}`, title: `Рівень ${i + 1}` }));
const LEVELS_BY_CEFR: Record<string, number> = { A1: 6, A2: 8, B1: 10, B2: 12, C1: 10, C2: 8 };
const STORAGE_PREFIX = "daily_cefr_level_progress_v1_"; // + `${cefr}_${level}`

export default function DailyLevelsForCefr() {
  const params = useParams();
  const cefr = String(params?.cefr || "A1");
  const count = LEVELS_BY_CEFR[cefr] || 8;
  const levels = LEVELS(count);

  const [completed, setCompleted] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const acc: Record<string, boolean> = {};
    for (const lv of levels) {
      try {
        const raw = localStorage.getItem(STORAGE_PREFIX + `${cefr}_${lv.id}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          const dayState = parsed?.days ? parsed.days[Object.keys(parsed.days).pop() as string] : null;
          const done = Array.isArray(dayState?.completed) ? dayState.completed.length : 0;
          acc[lv.id] = done >= 8;
        }
      } catch {}
    }
    setCompleted(acc);
  }, [cefr, count]);

  const unlocked = useMemo(() => {
    const firstNot = levels.find((l) => !completed[l.id]);
    const allowed = new Set<string>();
    for (const l of levels) {
      allowed.add(l.id);
      if (l.id === firstNot?.id) break;
    }
    return allowed;
  }, [completed, count]);

  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const locale = parts[0] || "uk";

  return (
    <main className="container mx-auto px-4 py-10">
      <div className="mb-4"><Link href={`/${locale}/practice/daily`} className="text-sm text-neutral-600">← Рівні A1–C2</Link></div>
      <h1 className="text-2xl font-semibold mb-4">Щоденні завдання — {cefr}</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {levels.map((lv) => {
          const isDone = completed[lv.id];
          const isUnlocked = unlocked.has(lv.id);
          return (
            <Link
              key={lv.id}
              href={isUnlocked ? `/${locale}/practice/daily/${cefr}/${lv.id}` : "#"}
              className={`rounded-2xl border p-4 bg-white flex flex-col items-center justify-center gap-2 ${isUnlocked ? "hover:shadow" : "opacity-50 cursor-not-allowed"}`}
            >
              <div className="text-3xl" aria-hidden>{isDone ? "✅" : isUnlocked ? "🟢" : "🔒"}</div>
              <div className="font-medium text-center">{lv.title}</div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
