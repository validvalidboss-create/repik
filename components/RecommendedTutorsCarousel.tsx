"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type RecommendedTutorItem = {
  id: string;
  name: string;
  image: string | null;
  rateCents: number;
  currency: string;
  rating: number;
  ratingCount: number;
  bio: string;
};

export default function RecommendedTutorsCarousel({
  locale,
  subjectLabel,
  subjectKey,
  items,
}: {
  locale: string;
  subjectLabel: string;
  subjectKey: string;
  items: RecommendedTutorItem[];
}) {
  const pages = useMemo(() => {
    const out: RecommendedTutorItem[][] = [];
    const perPage = 3;
    for (let i = 0; i < items.length; i += perPage) out.push(items.slice(i, i + perPage));
    return out;
  }, [items]);

  const [page, setPage] = useState(0);
  const maxPage = Math.max(0, pages.length - 1);

  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If list changes, keep page within bounds
    setPage((p) => Math.max(0, Math.min(maxPage, p)));
  }, [maxPage]);

  useEffect(() => {
    // Allow keyboard navigation when focused
    function onKey(e: KeyboardEvent) {
      const root = rootRef.current;
      if (!root) return;
      const active = document.activeElement;
      if (!active) return;
      if (!root.contains(active)) return;
      if (e.key === "ArrowRight") setPage((p) => Math.min(maxPage, p + 1));
      if (e.key === "ArrowLeft") setPage((p) => Math.max(0, p - 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [maxPage]);

  const canPrev = page > 0;
  const canNext = page < maxPage;

  return (
    <section className="mt-14">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Рекомендовані репетитори</h2>
          <div className="mt-1 text-sm text-neutral-500">{subjectLabel}</div>
        </div>
        <Link
          prefetch={false}
          href={`/${locale}/catalog?subject=${encodeURIComponent(subjectKey)}`}
          className="text-sm font-medium text-neutral-700 hover:text-neutral-900 hover:underline"
        >
          Дивитись усі
        </Link>
      </div>

      <div ref={rootRef} className="relative mt-5">
        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${page * 100}%)` }}
          >
            {pages.map((chunk, idx) => (
              <div key={idx} className="w-full shrink-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {chunk.map((rt) => {
                    const rid = String(rt.id || "");
                    const name = String(rt.name || "Репетитор");
                    const img = rt.image;
                    const rating = Number(rt.rating || 0) || 0;
                    const ratingCount = Number(rt.ratingCount || 0) || 0;
                    const rating5 = ratingCount > 0 ? Math.max(0, Math.min(5, rating)) : 5;
                    const priceUah = Math.max(0, Math.round(Number(rt.rateCents || 0) / 100));
                    const currency = String(rt.currency || "UAH");
                    const bioRaw = String(rt.bio || "").trim();
                    const bio = bioRaw.length > 84 ? `${bioRaw.slice(0, 84)}…` : bioRaw;
                    const profileHref = `/${locale}/tutors/${encodeURIComponent(rid)}?uid=${encodeURIComponent(rid)}`;
                    const vibeA = "#22c55e";
                    const vibeB = "#0ea5e9";
                    const vibeC = "#a78bfa";
                    const bg = `radial-gradient(1200px 500px at -10% -20%, ${vibeA}33 0%, transparent 55%), radial-gradient(900px 500px at 110% -10%, ${vibeC}33 0%, transparent 55%), linear-gradient(135deg, ${vibeB}22 0%, ${vibeC}22 50%, ${vibeA}22 100%)`;

                    return (
                      <Link
                        key={rid}
                        prefetch={false}
                        href={profileHref}
                        className="group rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all"
                      >
                        <div className="relative h-[132px]" style={{ backgroundImage: bg }}>
                          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-white/0" />
                          <div className="absolute -bottom-7 left-4">
                            <div className="h-14 w-14 rounded-2xl ring-2 ring-white overflow-hidden bg-white shadow">
                              {img ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={img} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-sm font-semibold text-neutral-700">
                                  {name.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="px-4 pt-10 pb-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-neutral-900">{name}</div>
                              <div className="mt-0.5 text-xs text-neutral-500">{subjectLabel}</div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="text-sm font-semibold text-neutral-900">
                                {priceUah} {currency}
                              </div>
                              <div className="text-[11px] text-neutral-500">за годину</div>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <div className="text-xs text-neutral-700">
                              <span className="font-semibold">{rating5.toFixed(1)}</span>
                              <span className="text-neutral-400">/5</span>
                              <span className="ml-1 text-neutral-400">({ratingCount})</span>
                            </div>
                            <div className="text-xs text-neutral-500">популярний</div>
                          </div>

                          {bio ? <div className="mt-3 text-sm text-neutral-800 leading-6">{bio}</div> : null}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {canPrev ? (
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="hidden lg:inline-flex absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-white/90 backdrop-blur border border-neutral-200 shadow hover:bg-white"
            aria-label="Назад"
          >
            <span className="text-lg leading-none">‹</span>
          </button>
        ) : null}

        {canNext ? (
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
            className="hidden lg:inline-flex absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-white/90 backdrop-blur border border-neutral-200 shadow hover:bg-white"
            aria-label="Вперед"
          >
            <span className="text-lg leading-none">›</span>
          </button>
        ) : null}

        <div className="mt-3 flex items-center justify-center gap-1.5 lg:hidden">
          {pages.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPage(i)}
              className={`h-1.5 rounded-full transition-all ${i === page ? "w-6 bg-neutral-900" : "w-2 bg-neutral-300"}`}
              aria-label={`Сторінка ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
