"use client";

import * as React from "react";
import TutorCatalogCard from "@/components/TutorCatalogCard";

type Tutor = any;

export default function CatalogInfinite({
  locale,
  baseQuery,
  startPage,
  totalPages,
  canBook,
}: {
  locale: string;
  baseQuery: string; // URLSearchParams without page
  startPage: number;
  totalPages: number;
  canBook: boolean;
}) {
  const [page, setPage] = React.useState(startPage);
  const [items, setItems] = React.useState<Tutor[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(startPage > totalPages);

  const load = React.useCallback(async () => {
    if (loading || done) return;
    setLoading(true);
    try {
      const url = `/api/tutors?${baseQuery}&page=${page}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems((prev) => [...prev, ...data.items]);
      const next = page + 1;
      setPage(next);
      if (next > totalPages) setDone(true);
    } catch (e) {
      // swallow in MVP; could add toast
    } finally {
      setLoading(false);
    }
  }, [baseQuery, page, totalPages, loading, done]);

  // Auto-load on near bottom
  React.useEffect(() => {
    if (done) return;
    const onScroll = () => {
      if (loading || done) return;
      const near = window.innerHeight + window.scrollY >= document.body.offsetHeight - 400;
      if (near) load();
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [load, loading, done]);

  return (
    <>
      {items.length > 0 && (
        <div className="flex flex-col gap-4 mt-6 max-w-[980px]">
          {items.map((tutor: any) => {
            const hrefId = tutor.id || tutor.userId || tutor.user?.id || "";
            const tracks = Array.isArray(tutor.tracks) ? (tutor.tracks as string[]) : [];
            const status = tracks.find((x) => typeof x === "string" && x.startsWith("status:"))?.replace("status:", "") || "";
            const freeFirstEnabled = tracks.includes("freefirst:true");
            const name = tutor.user?.name ?? tutor.name ?? "Tutor";
            const headline = String(tutor.headline || "").trim();
            const about = String(tutor.bio || "").trim();
            const rating = Number((tutor.rating ?? 0) || 0);
            const ratingCount = Number((tutor.ratingCount ?? 0) || 0);
            const studentsCount = Number((tutor.studentsCount ?? 0) || 0);
            const lessonsCount = Number((tutor.lessonsCount ?? 0) || 0);
            const price = ((tutor.rateCents ?? 0) / 100).toFixed(0);
            const currency = tutor.currency || "UAH";
            const subjectsTxt = (Array.isArray(tutor.subjects) ? tutor.subjects : []).slice(0, 2).join(", ");
            const langsTxt = (Array.isArray(tutor.languages) ? tutor.languages : []).slice(0, 3).join(", ");
            const showText = headline || about || "—";
            const mediaArr: string[] = Array.isArray(tutor.media) ? (tutor.media as string[]) : [];
            const photoUrl: string | undefined = mediaArr[0] || tutor.user?.image || undefined;
            const countryCode: string | undefined = tutor.country || tutor.user?.country || undefined;
            return (
              <TutorCatalogCard
                key={hrefId + "-inf"}
                locale={locale}
                hrefId={String(hrefId)}
                tutorDbId={String(tutor.id || "")}
                name={String(name)}
                image={photoUrl}
                countryCode={countryCode}
                subjectsTxt={subjectsTxt}
                langsTxt={langsTxt}
                rating={rating}
                ratingCount={ratingCount}
                studentsCount={studentsCount}
                lessonsCount={lessonsCount}
                price={price}
                currency={currency}
                showText={showText}
                status={status}
                freeFirstEnabled={freeFirstEnabled}
                canBook={canBook}
              />
            );
          })}
        </div>
      )}
      {!done && (
        <div className="flex items-center justify-center mt-6">
          <button onClick={load} disabled={loading} className="px-4 py-2 rounded border">
            {loading ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </>
  );
}
