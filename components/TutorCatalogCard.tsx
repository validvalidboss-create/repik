"use client";

import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import ChatStartButton from "@/components/ChatStartButton";

function formatDisplayName(fullName: string) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length <= 1) return parts[0] || "Tutor";
  const first = parts[0];
  const last = parts[1];
  const initial = last ? `${last.slice(0, 1).toUpperCase()}.` : "";
  return `${first} ${initial}`.trim();
}

function countryToFlagEmoji(code?: string | null) {
  const cc = String(code || "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "";
  const A = 0x1f1e6;
  const base = "A".charCodeAt(0);
  return String.fromCodePoint(A + (cc.charCodeAt(0) - base), A + (cc.charCodeAt(1) - base));
}

function countryToFlagUrl(code?: string | null) {
  const cc = String(code || "")
    .trim()
    .toLowerCase();
  if (!/^[a-z]{2}$/.test(cc)) return "";
  return `https://flagcdn.com/w40/${cc}.png`;
}

function IconHeart({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M12 21s-7.2-4.6-9.6-8.7C.6 9.1 2 5.6 5.5 4.6c2-.6 4 .1 5.3 1.6C12.1 4.7 14.1 4 16.1 4.6c3.5 1 4.9 4.5 3.1 7.7C19.2 16.4 12 21 12 21Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBook({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M4.75 5.25c0-1.105.895-2 2-2H19.25v16.5H6.75c-1.105 0-2 .895-2 2V5.25Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M19.25 19.75H6.75c-1.105 0-2 .895-2 2" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function IconGlobe({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M3 12h18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="M12 3c2.6 2.4 4 5.6 4 9s-1.4 6.6-4 9c-2.6-2.4-4-5.6-4-9s1.4-6.6 4-9Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function TutorCatalogCard({
  locale,
  hrefId,
  tutorDbId,
  name,
  image,
  countryCode,
  subjectsTxt,
  langsTxt,
  rating,
  ratingCount,
  studentsCount,
  lessonsCount,
  price,
  currency,
  showText,
  status,
  freeFirstEnabled,
  alreadyBookedAny,
  initialLiked,
  alreadyBookedUpcoming,
  alreadyBookedTrial,
  canBook = true,
}: {
  locale: string;
  hrefId: string;
  tutorDbId?: string;
  name: string;
  image?: string | null;
  countryCode?: string | null;
  subjectsTxt?: string;
  langsTxt?: string;
  rating: number;
  ratingCount: number;
  studentsCount?: number;
  lessonsCount?: number;
  price: string;
  currency: string;
  showText: string;
  status?: string;
  freeFirstEnabled?: boolean;
  alreadyBookedAny?: boolean;
  initialLiked?: boolean;
  alreadyBookedUpcoming?: boolean;
  alreadyBookedTrial?: boolean;
  canBook?: boolean;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const transferFrom = String(sp?.get("transferFrom") || "").trim();
  const transferMode = !!transferFrom;
  const [liked, setLiked] = React.useState(!!initialLiked);
  const [pendingLike, setPendingLike] = React.useState(false);
  const [burst, setBurst] = React.useState(0);
  const [alreadyBookedOpen, setAlreadyBookedOpen] = React.useState(false);
  const [studentOnlyOpen, setStudentOnlyOpen] = React.useState(false);
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [hasBalance, setHasBalance] = React.useState<boolean>(false);
  const [balanceLoaded, setBalanceLoaded] = React.useState<boolean>(false);
  const profileHref = `/${locale}/tutors/${encodeURIComponent(hrefId)}?uid=${encodeURIComponent(hrefId)}`;
  const bookHrefBase = tutorDbId ? `/${locale}/book/${encodeURIComponent(String(tutorDbId))}` : profileHref;
  const canUseFreeFirst = !!freeFirstEnabled && !alreadyBookedTrial && !alreadyBookedAny;
  const bookHref = canUseFreeFirst ? `${bookHrefBase}?durationMin=30&freeFirst=1` : bookHrefBase;
  const canStartChat = !transferMode && !!String(tutorDbId || "").trim();
  const bookCtaLabel = canUseFreeFirst ? "Перший урок безкоштовно" : "Забронювати";
  const displayName = formatDisplayName(name);
  const flag = countryToFlagEmoji(countryCode);
  const flagUrl = countryToFlagUrl(countryCode);
  const bio = String(showText || "").trim();
  const rating10 = (Number.isFinite(ratingCount) ? ratingCount : 0) > 0
    ? Math.max(0, Math.min(10, (Number.isFinite(rating) ? rating : 0) * 2))
    : 10;

  React.useEffect(() => {
    setLiked(!!initialLiked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLiked, tutorDbId]);

  React.useEffect(() => {
    if (transferMode) return;
    if (!canBook) return;
    if (balanceLoaded) return;
    let mounted = true;
    (async () => {
      try {
        const cached = typeof window !== "undefined" ? window.sessionStorage?.getItem("hasLessonBalance") : null;
        if (cached === "1" || cached === "0") {
          if (mounted) {
            setHasBalance(cached === "1");
            setBalanceLoaded(true);
          }
          return;
        }
        const res = await fetch("/api/lesson-balance", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        const list = Array.isArray(json?.byTutor) ? json.byTutor : [];
        const any = list.some((x: any) => Math.max(0, Math.floor(Number(x?.credits ?? 0) || 0)) > 0);
        try {
          if (typeof window !== "undefined") window.sessionStorage?.setItem("hasLessonBalance", any ? "1" : "0");
        } catch {
          // ignore
        }
        if (mounted) {
          setHasBalance(any);
          setBalanceLoaded(true);
        }
      } catch {
        if (mounted) {
          setHasBalance(false);
          setBalanceLoaded(true);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [transferMode, canBook, balanceLoaded]);

  React.useEffect(() => {
    if (!scheduleOpen) return;
    const y = window.scrollY || 0;
    const prev = {
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overflowY: document.body.style.overflowY,
    };
    document.body.style.position = "fixed";
    document.body.style.top = `-${y}px`;
    document.body.style.width = "100%";
    document.body.style.overflowY = "scroll";
    return () => {
      const top = document.body.style.top;
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.width = prev.width;
      document.body.style.overflowY = prev.overflowY;
      const restoreY = Math.abs(parseInt(top || "0", 10)) || y;
      window.scrollTo(0, restoreY);
    };
  }, [scheduleOpen]);

  async function toggleFavorite(e: React.MouseEvent) {
    e.stopPropagation();
    if (pendingLike) return;
    const tid = String(tutorDbId || "").trim();
    if (!tid) return;

    const next = !liked;
    setPendingLike(true);
    try {
      const res = await fetch(`/api/favorites/${encodeURIComponent(tid)}`, {
        method: next ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return;
      const serverLiked = typeof data?.liked === "boolean" ? !!data.liked : next;
      setLiked(serverLiked);
      if (serverLiked) setBurst((v) => v + 1);
      const onlyFav = sp?.get("fav") === "1";
      if (onlyFav && !serverLiked) router.refresh();

      try {
        if (typeof window !== "undefined") {
          window.sessionStorage?.setItem("favoritesDirty", "1");
          window.dispatchEvent(new Event("favorites-changed"));
        }
      } catch {
        // ignore
      }
    } finally {
      setPendingLike(false);
    }
  }

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => {
        if (transferMode) return;
        router.push(profileHref);
      }}
      onKeyDown={(e) => {
        if (transferMode) return;
        if (e.key === "Enter" || e.key === " ") router.push(profileHref);
      }}
      className="relative rounded-xl border border-neutral-200 bg-white px-6 py-8 sm:px-7 sm:py-9 cursor-pointer hover:shadow-sm transition-shadow"
    >
      <div
        className="absolute right-4 top-4 z-20 flex items-center gap-2"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <button
          aria-label="favorite"
          onClick={toggleFavorite}
          disabled={pendingLike || !String(tutorDbId || "").trim()}
          className={`rounded-full border bg-white p-2 shadow-sm transition-colors ${liked ? "border-rose-200 bg-rose-50" : "border-neutral-200 hover:bg-neutral-50"} ${pendingLike ? "opacity-60" : ""}`}
        >
          <IconHeart className={liked ? "w-5 h-5 text-red-500" : "w-5 h-5 text-neutral-700"} filled={liked} />
        </button>

        {burst ? (
          <div key={burst} className="pointer-events-none absolute right-0 top-0">
            {Array.from({ length: 7 }).map((_, idx) => (
              <span
                key={idx}
                className="cat-fav-burst"
                style={{
                  ['--dx' as any]: `${Math.cos((Math.PI * 2 * idx) / 7) * 34}px`,
                  ['--dy' as any]: `${Math.sin((Math.PI * 2 * idx) / 7) * 34}px`,
                  animationDelay: `${idx * 0.02}s`,
                }}
              />
            ))}
          </div>
        ) : null}
      </div>

      {studentOnlyOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setStudentOnlyOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-lg font-semibold text-neutral-900">Бронювання недоступне</div>
            <div className="mt-2 text-sm text-neutral-700">Щоб забронювати урок, увійдіть як учень.</div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStudentOnlyOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
              >
                Закрити
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .cat-fav-burst {
          position: absolute;
          left: 18px;
          top: 18px;
          width: 5px;
          height: 5px;
          border-radius: 999px;
          background: rgba(244, 63, 94, 0.9);
          animation: cat-pop 520ms ease-out forwards;
        }
        @keyframes cat-pop {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.6);
          }
          10% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) translate(var(--dx), var(--dy)) scale(1);
          }
        }
      `}</style>

      <div className="flex flex-col sm:flex-row gap-8 sm:gap-10">
        <div className="flex items-start gap-4 min-w-0 flex-1">
          <div className="relative w-28 h-28 rounded-xl bg-neutral-100 flex-none overflow-hidden border">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt={name} className="w-full h-full object-cover object-center" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl font-semibold text-neutral-500">
                {(name || "T").slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-start gap-3">
              <div className="min-w-0">
                <div className="text-[18px] sm:text-xl font-semibold truncate flex items-center gap-2">
                  <span className="truncate">{displayName}</span>
                  {flagUrl ? (
                    <span
                      className="inline-flex items-center justify-center border border-neutral-200 bg-white rounded-md w-5 h-5 overflow-hidden"
                      aria-label={String(countryCode || "")}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={flagUrl} alt={String(countryCode || "")} className="w-full h-full object-cover" loading="lazy" />
                    </span>
                  ) : flag ? (
                    <span
                      className="inline-flex items-center justify-center border border-neutral-200 bg-white rounded-md w-5 h-5 overflow-hidden text-[14px] leading-none"
                      aria-label={String(countryCode || "")}
                    >
                      {flag}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-sm text-neutral-600">
                  {subjectsTxt ? (
                    <div className="truncate flex items-center gap-2">
                      <IconBook className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                      <span className="truncate">{subjectsTxt}</span>
                    </div>
                  ) : null}
                  {langsTxt ? (
                    <div className="truncate flex items-center gap-2">
                      <IconGlobe className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                      <span className="font-medium">Мови:</span>
                      <span className="truncate">{langsTxt}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-3 text-[15px] leading-6 text-neutral-700 line-clamp-3">{bio || "—"}</div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                router.push(profileHref);
              }}
              className="mt-2 text-sm font-semibold underline underline-offset-4 text-neutral-900 hover:text-neutral-700"
            >
              Узнать больше
            </button>
          </div>
        </div>

        <div className="sm:w-[320px] flex-shrink-0 self-stretch sm:pl-8 sm:border-l sm:border-neutral-200">
          <div className="h-full flex flex-col items-stretch justify-between gap-4">
            <div className="text-center">
              <div className="text-3xl font-semibold leading-none">
                {price} {currency}
              </div>
              <div className="text-xs text-neutral-500">60-хв урок</div>

              <div className="mt-4 flex items-start justify-center gap-8 text-center">
                <div className="min-w-[52px]">
                  <div className="text-sm font-semibold leading-none">{rating10.toFixed(1)} ★</div>
                  <div className="text-[11px] text-neutral-500 mt-1">рейтинг</div>
                </div>
                <div className="min-w-[52px]">
                  <div className="text-sm font-semibold leading-none">{Number.isFinite(ratingCount) ? ratingCount : 0}</div>
                  <div className="text-[11px] text-neutral-500 mt-1">отзывов</div>
                </div>
                <div className="min-w-[52px]">
                  <div className="text-sm font-semibold leading-none">{Number.isFinite(Number(lessonsCount || 0)) ? Number(lessonsCount || 0) : 0}</div>
                  <div className="text-[11px] text-neutral-500 mt-1">уроков</div>
                </div>
              </div>
            </div>

            <div className="w-full flex flex-col gap-2">
              {transferMode ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const toId = String(tutorDbId || "").trim();
                    if (!toId) return;
                    if (toId === transferFrom) return;
                    router.push(
                      `/${locale}/dashboard?tab=lessons&transferFrom=${encodeURIComponent(transferFrom)}&transferTo=${encodeURIComponent(toId)}#schedule`
                    );
                  }}
                  disabled={!String(tutorDbId || "").trim() || String(tutorDbId || "").trim() === transferFrom}
                  className={
                    String(tutorDbId || "").trim() && String(tutorDbId || "").trim() !== transferFrom
                      ? "inline-flex items-center justify-center rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white w-full hover:bg-neutral-800"
                      : "inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-500 w-full cursor-not-allowed"
                  }
                >
                  {String(tutorDbId || "").trim() === transferFrom ? "Поточний викладач" : "Обрати для переказу"}
                </button>
              ) : alreadyBookedTrial ? (
                <button
                  type="button"
                  disabled
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-500 w-full cursor-not-allowed"
                >
                  Вже заброньовано пробний урок
                </button>
              ) : alreadyBookedUpcoming ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setAlreadyBookedOpen(true);
                  }}
                  className="inline-flex items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 w-full"
                >
                  <span className="inline-flex items-center gap-2">
                    <span>Забронювати</span>
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                      Вже заброньовано
                    </span>
                  </span>
                </button>
              ) : !canBook ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setStudentOnlyOpen(true);
                  }}
                  className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-500 w-full cursor-not-allowed"
                  aria-disabled="true"
                >
                  Забронювати
                </button>
              ) : (
                <a
                  href={bookHref}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof window !== "undefined") window.location.href = bookHref;
                  }}
                  className="inline-flex items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 w-full"
                >
                  <span className="inline-flex items-center gap-2">
                    <span>{bookCtaLabel}</span>
                  </span>
                </a>
              )}
              {!transferMode ? (
                canStartChat ? (
                  <ChatStartButton
                    tutorId={String(tutorDbId || "")}
                    locale={String(locale)}
                    label="Написати"
                    wrapperClassName="block"
                    className="w-full inline-flex items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                  />
                ) : (
                  <button
                    type="button"
                    disabled
                    className="w-full inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-500 cursor-not-allowed"
                  >
                    Написати
                  </button>
                )
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {alreadyBookedOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setAlreadyBookedOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-lg"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <div className="text-base font-semibold text-neutral-900">У вас вже є заброньований урок</div>
            <div className="mt-2 text-sm text-neutral-600">
              Ви вже маєте майбутній урок з цим викладачем. Дочекайтесь уроку або змініть/скасуйте його у дашборді.
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 h-10 rounded-xl bg-black px-4 text-sm font-semibold text-white"
                onClick={() => {
                  setAlreadyBookedOpen(false);
                  router.push(`/${locale}/dashboard`);
                }}
              >
                Перейти в дашборд
              </button>
              <button
                type="button"
                className="h-10 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-900"
                onClick={() => setAlreadyBookedOpen(false)}
              >
                Закрити
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {scheduleOpen ? (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setScheduleOpen(false);
          }}
        >
          <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl border border-neutral-200 overflow-hidden">
            <div className="relative flex items-center justify-end px-4 py-3 border-b border-neutral-200">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-neutral-100 text-neutral-800"
                onClick={() => setScheduleOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="h-[78vh] bg-white">
              <iframe
                title="booking"
                src={`/${locale}/book/${encodeURIComponent(String(tutorDbId || ""))}?embed=1`}
                className="h-full w-full"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
