import Link from "next/link";
import React from "react";
import { isLocale, Locale, defaultLocale } from "@/lib/i18n";
import { getMessages } from "@/lib/messages";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import CatalogFilters from "@/components/CatalogFilters";
import TutorCatalogCard from "@/components/TutorCatalogCard";
import { MOCK_TUTORS } from "@/mocks/tutors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale: rawLocale } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const locale: Locale = isLocale(rawLocale) ? (rawLocale as Locale) : defaultLocale;
  const t = getMessages(locale) as Record<string, string>;

  const session = await auth();
  const viewer = session?.user as any;
  const viewerRole = String((viewer?.role || "") as any).toUpperCase();
  const canBook = viewerRole !== "TUTOR";
  const adminEmail = (process.env.ADMIN_EMAIL || "").trim();
  const isAdmin =
    !!adminEmail && !!viewer?.email && String(viewer.email).toLowerCase() === String(adminEmail).toLowerCase();

  const resolvedViewerId = await (async () => {
    const direct = viewer?.id ? String(viewer.id) : "";
    if (direct) return direct;
    const email = viewer?.email ? String(viewer.email).trim().toLowerCase() : "";
    if (!email) return "";
    try {
      const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      return u?.id ? String(u.id) : "";
    } catch {
      return "";
    }
  })();

  const subject = (sp?.subject as string) || "";
  const subjectsCsv = (sp?.subjects as string) || "";
  const subjects = subjectsCsv
    ? subjectsCsv.split(",").map((s) => s.trim()).filter(Boolean)
    : (subject ? [subject] : []);
  const language = (sp?.language as string) || "";
  const min = Number(sp?.min ?? "");
  const max = Number(sp?.max ?? "");
  const minUsd = Number(sp?.minUsd ?? "");
  const maxUsd = Number(sp?.maxUsd ?? "");
  const ratingMin = Number(sp?.ratingMin ?? "");
  const reviewsMin = Number(sp?.reviewsMin ?? "");
  const hasVideo = sp?.hasVideo === "1";
  const hasMedia = sp?.hasMedia === "1";
  const native = sp?.native === "1"; // UI-only for now
  const onlyFavorites = sp?.fav === "1";
  const freeFirst = sp?.freeFirst === "1";
  const dirCsv = typeof sp?.dir === "string" ? (sp?.dir as string) : "";
  const dirs = String(dirCsv || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const daysParam = (sp?.days as string) || "";
  const slot = (sp?.slot as string) || ""; // morn|day|eve|night
  const page = Math.max(1, Number(sp?.page ?? 1));
  const sort = (sp?.sort as string) || "relevance";
  const pageSize = 10;

  const paginationBaseQuery = (() => {
    const params = new URLSearchParams();
    const obj = sp || {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === "page") continue;
      if (typeof v === "undefined") continue;
      if (Array.isArray(v)) {
        for (const vv of v) {
          if (typeof vv === "string" && vv !== "") params.append(k, vv);
        }
      } else if (typeof v === "string" && v !== "") {
        params.set(k, v);
      }
    }
    return params.toString();
  })();

  let favoriteTutorIds: string[] = [];
  if (onlyFavorites) {
    const viewerId = resolvedViewerId;
    if (!viewerId) {
      favoriteTutorIds = ["__none__"];
    } else {
      try {
        const favs = await prisma.favorite.findMany({ where: { userId: viewerId }, select: { tutorId: true } });
        favoriteTutorIds = (favs || []).map((f: { tutorId: string }) => String(f.tutorId || "")).filter(Boolean);
        if (favoriteTutorIds.length === 0) favoriteTutorIds = ["__none__"];
      } catch {
        favoriteTutorIds = ["__none__"];
      }
    }
  }

  const where: any = {};
  if (onlyFavorites) where.id = { in: favoriteTutorIds };
  if (subjects.length === 1) where.subjects = { has: subjects[0] };
  else if (subjects.length > 1) where.subjects = { hasSome: subjects };
  if (language) where.languages = { has: language };
  // Price filter in UAH (min/max) and optional USD slider (minUsd/maxUsd)
  if (!Number.isNaN(min) && min > 0) where.rateCents = { ...(where.rateCents || {}), gte: Math.floor(min * 100) };
  if (!Number.isNaN(max) && max > 0) where.rateCents = { ...(where.rateCents || {}), lte: Math.floor(max * 100) };
  const usdRate = Number(process.env.USD_UAH_RATE || 40);
  if (!Number.isNaN(minUsd) && minUsd > 0) where.rateCents = { ...(where.rateCents || {}), gte: Math.floor(minUsd * usdRate * 100) };
  if (!Number.isNaN(maxUsd) && maxUsd > 0) where.rateCents = { ...(where.rateCents || {}), lte: Math.floor(maxUsd * usdRate * 100) };
  if (!Number.isNaN(ratingMin) && ratingMin > 0) where.rating = { ...(where.rating || {}), gte: ratingMin };
  if (!Number.isNaN(reviewsMin) && reviewsMin > 0) where.ratingCount = { ...(where.ratingCount || {}), gte: reviewsMin };
  if (hasVideo) where.videoUrl = { not: null };
  if (hasMedia) where.media = { isEmpty: false };
  const requiredTrackTokens: string[] = [];
  // Показуємо в пошуку лише активні анкети
  requiredTrackTokens.push("status:active");
  if (freeFirst) requiredTrackTokens.push("freefirst:true");
  const allTrackTokens = [...requiredTrackTokens, ...dirs];
  if (allTrackTokens.length) where.tracks = { hasEvery: allTrackTokens };
  // Availability filter
  if (daysParam || slot) {
    const daysNums = daysParam
      .split(",")
      .map((d) => d.trim())
      .filter((d) => d !== "")
      .map((d) => Number(d))
      .filter((n) => !Number.isNaN(n) && n >= 0 && n <= 6);
    let timeCond: any = undefined;
    if (slot) {
      const ranges: Array<{ start: number; end: number }> = [];
      const add = (startH: number, endH: number) => ranges.push({ start: startH * 60, end: endH * 60 });
      if (slot === "morn") add(6, 12);
      else if (slot === "day") add(12, 17);
      else if (slot === "eve") add(17, 22);
      else if (slot === "night") {
        add(22, 24);
        add(0, 6);
      } else {
        const m = String(slot).match(/^(\d{1,2})-(\d{1,2})$/);
        if (m) {
          const sH = Number(m[1]);
          const eH = Number(m[2]);
          if (!Number.isNaN(sH) && !Number.isNaN(eH)) {
            if (eH > sH) add(sH, eH);
            else if (eH < sH) {
              // wrap across midnight
              add(sH, 24);
              add(0, eH);
            }
          }
        }
      }
      if (ranges.length) {
        timeCond = {
          OR: ranges.map((r) => ({ AND: [{ startMin: { lt: r.end } }, { endMin: { gt: r.start } }] })),
        };
      }
    }
    const availCond: any = {};
    if (daysNums.length) availCond.weekday = { in: daysNums };
    if (timeCond) Object.assign(availCond, timeCond);
    if (Object.keys(availCond).length) {
      where.availability = { some: availCond };
    }
  }

  let orderBy: any = [{ createdAt: "desc" }];
  if (sort === "price_asc") orderBy = [{ rateCents: "asc" }];
  else if (sort === "price_desc") orderBy = [{ rateCents: "desc" }];
  else if (sort === "rating_desc") orderBy = [{ rating: "desc" }, { ratingCount: "desc" }];
  else orderBy = [{ rating: "desc" }, { createdAt: "desc" }];

  let dbError: string | null = null;
  let total = 0;
  let tutors: any[] = [];
  try {
    const out = await Promise.all([
      prisma.tutor.count({ where }),
      prisma.tutor.findMany({
        where,
        include: { user: true },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    total = out[0] as any;
    tutors = out[1] as any;
  } catch (e: any) {
    dbError = e?.message ? String(e.message) : "Database is unavailable";

    const applyMockFilters = () => {
      const subj = subjects.length === 1 ? subjects[0] : "";
      const lang = String(language || "").trim().toLowerCase();
      const mx = !Number.isNaN(max) && max > 0 ? Math.floor(max * 100) : null;
      const mn = !Number.isNaN(min) && min > 0 ? Math.floor(min * 100) : null;
      const hasDirs = dirs.length > 0;
      const list = (MOCK_TUTORS || [])
        .filter((t) => {
          if (subj && !(t.subjects || []).includes(subj)) return false;
          if (lang && !(t.languages || []).includes(lang)) return false;
          if (mn !== null && (t.rateCents || 0) < mn) return false;
          if (mx !== null && (t.rateCents || 0) > mx) return false;
          if (freeFirst) return false;
          if (hasDirs) return false;
          return true;
        })
        .map((mt) => ({
          id: `mock-${mt.slug}`,
          userId: `mock-${mt.slug}`,
          subjects: mt.subjects,
          languages: mt.languages,
          rateCents: mt.rateCents,
          currency: mt.currency,
          rating: mt.rating,
          ratingCount: mt.ratingCount,
          bio: mt.bio,
          headline: "",
          tracks: ["status:active"],
          user: { name: mt.name },
          media: [],
        }));
      return list;
    };

    tutors = applyMockFilters();
    total = tutors.length;
  }

  const tutorIds = (Array.isArray(tutors) ? tutors : []).map((t: any) => String(t?.id || "")).filter(Boolean);
  let bookingRows: any[] = [];
  let alreadyBookedTutorIds = new Set<string>();
  let alreadyBookedTrialTutorIds = new Set<string>();
  let alreadyBookedAnyTutorIds = new Set<string>();
  let favoriteTutorIdsOnPage = new Set<string>();
  const lessonsCountByTutor = new Map<string, number>();
  const studentsByTutor = new Map<string, Set<string>>();

  if (!dbError) {
    try {
      bookingRows = tutorIds.length
        ? await prisma.booking.findMany({
            where: { tutorId: { in: tutorIds }, status: { in: ["CONFIRMED", "COMPLETED"] as any } },
            select: { tutorId: true, studentId: true, durationMinutes: true },
          })
        : [];
    } catch {
      bookingRows = [];
    }

    for (const b of bookingRows as any[]) {
      const tid = String(b?.tutorId || "");
      const sid = String(b?.studentId || "");
      if (!tid) continue;
      lessonsCountByTutor.set(tid, (lessonsCountByTutor.get(tid) || 0) + 1);
      if (sid) {
        const set = studentsByTutor.get(tid) || new Set<string>();
        set.add(sid);
        studentsByTutor.set(tid, set);
      }
    }

    if (resolvedViewerId) {
      try {
        const anyBooked = await prisma.booking.findMany({
          where: {
            studentId: resolvedViewerId,
            tutorId: { in: tutorIds },
            status: { notIn: ["CANCELED", "REFUNDED"] as any },
          },
          select: { tutorId: true },
        });
        alreadyBookedAnyTutorIds = new Set((anyBooked || []).map((b: any) => String(b?.tutorId || "")).filter(Boolean));
      } catch {
        alreadyBookedAnyTutorIds = new Set<string>();
      }

      try {
        const upcoming = await prisma.booking.findMany({
          where: {
            studentId: resolvedViewerId,
            tutorId: { in: tutorIds },
            status: { in: ["CONFIRMED"] as any },
          },
          select: { tutorId: true },
        });
        alreadyBookedTutorIds = new Set((upcoming || []).map((b: any) => String(b?.tutorId || "")).filter(Boolean));
      } catch {
        alreadyBookedTutorIds = new Set<string>();
      }

      try {
        const bookedTrial = await prisma.booking.findMany({
          where: {
            studentId: resolvedViewerId,
            tutorId: { in: tutorIds },
            durationMinutes: 30,
            status: { in: ["CONFIRMED", "COMPLETED", "MISSED_TRIAL"] as any },
          },
          select: { tutorId: true },
        });
        alreadyBookedTrialTutorIds = new Set((bookedTrial || []).map((b: any) => String(b?.tutorId || "")).filter(Boolean));
      } catch {
        alreadyBookedTrialTutorIds = new Set<string>();
      }

      try {
        const favs = await prisma.favorite.findMany({ where: { userId: resolvedViewerId }, select: { tutorId: true } });
        favoriteTutorIdsOnPage = new Set((favs || []).map((f: any) => String(f?.tutorId || "")).filter(Boolean));
      } catch {
        favoriteTutorIdsOnPage = new Set<string>();
      }
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main className="container mx-auto px-4 py-12">
      {dbError ? (
        <div className="mb-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
          База даних тимчасово недоступна. Спробуйте оновити сторінку або перезапустити dev-сервер.
        </div>
      ) : null}
      <div className="mx-auto w-full max-w-[980px]">
        <h1 className="text-3xl font-semibold mb-6">{t["nav.catalog"]}</h1>
        <CatalogFilters />
        <div className="mt-6 mb-4 text-2xl font-semibold">
          {total} {t["catalog.results"] || "репетиторів доступно"}
        </div>
        {/* Active filter chips */}
        {false ? null : null}
        {tutors.length === 0 ? (
          onlyFavorites ? (
            <div className="mt-10 rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-700">
              <div className="font-medium mb-1">У вас поки немає обраних викладачів</div>
              <div className="text-neutral-500">Додайте викладачів у обрані, щоб швидко знаходити їх тут.</div>
              <div className="mt-4">
                <Link href={`/${locale}/catalog`} className="inline-flex h-10 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white hover:bg-neutral-800">
                  Перейти в каталог
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-10 rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-700">
              {t["catalog.empty"] || "Поки що немає активних анкет викладачів у пошуку."}
            </div>
          )
        ) : (
          <div className="flex flex-col gap-4">
            {tutors.map((tutor: any) => {
              const hrefId = tutor.id || tutor.userId || tutor.user?.id || "";
              const stableKey = String(tutor.id || tutor.userId || tutor.user?.id || hrefId || "");
              const tracks = Array.isArray(tutor.tracks) ? (tutor.tracks as string[]) : [];
              const status = tracks.find((x) => typeof x === "string" && x.startsWith("status:"))?.replace("status:", "") || "";
              const freeFirstEnabled = tracks.includes("freefirst:true");
              const name = tutor.user?.name ?? tutor.name ?? "Tutor";
              const headline = (tutor.headline || "").trim();
              const about = (tutor.bio || "").trim();
              const rating = Number((tutor.rating ?? 0) || 0);
              const ratingCount = Number((tutor.ratingCount ?? 0) || 0);
              const lessonsCount = lessonsCountByTutor.get(String(tutor.id || "")) || 0;
              const studentsCount = studentsByTutor.get(String(tutor.id || ""))?.size || 0;
              const price = ((tutor.rateCents ?? 0) / 100).toFixed(0);
              const currency = tutor.currency || "UAH";
              const subjectsTxt = (Array.isArray(tutor.subjects) ? tutor.subjects : []).slice(0, 2).join(", ");
              const langsTxt = (Array.isArray(tutor.languages) ? tutor.languages : []).slice(0, 3).join(", ");
              const showText = headline || about || "—";
              const mediaArr: string[] = Array.isArray((tutor as any).media) ? ((tutor as any).media as string[]) : [];
              const photoUrl: string | undefined = mediaArr[0] || tutor.user?.image || undefined;
              const countryCode: string | undefined = (tutor as any).country || tutor.user?.country || undefined;

              if (!hrefId) {
                return (
                  <div key={`nohref-${tutor.user?.id || tutor.name || Math.random()}`} className="opacity-70">
                    <TutorCatalogCard
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
                    />
                    <div className="text-[11px] text-red-500 mt-1">No id/userId for this tutor. Card is disabled.</div>
                  </div>
                );
              }

              return (
                <TutorCatalogCard
                  key={stableKey}
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
                  alreadyBookedAny={alreadyBookedAnyTutorIds.has(String(tutor.id || ""))}
                  initialLiked={favoriteTutorIdsOnPage.has(String(tutor.id || ""))}
                  alreadyBookedUpcoming={alreadyBookedTutorIds.has(String(tutor.id || ""))}
                  alreadyBookedTrial={alreadyBookedTrialTutorIds.has(String(tutor.id || ""))}
                  canBook={canBook}
                />
              );
            })}
          </div>
        )}
        <div className="flex items-center justify-center gap-3 mt-8">
          <Pagination
            current={page}
            total={totalPages}
            locale={locale}
            baseQuery={paginationBaseQuery}
          />
        </div>
      </div>
    </main>
  );
}

function Pagination({
  current,
  total,
  locale,
  baseQuery,
}: {
  current: number;
  total: number;
  locale: string;
  baseQuery: string;
}): React.ReactElement {
  const items: React.ReactElement[] = [];
  const baseParams = new URLSearchParams(baseQuery || "");

  const mk = (p: number, label?: string) => {
    const params = new URLSearchParams(baseParams);
    params.set("page", String(p));
    const qs = params.toString();
    const href = `/${locale}/catalog${qs ? `?${qs}` : ""}`;
    return (
      <Link
        key={p + (label || "")}
        href={href}
        className={`px-3 py-1 rounded border ${current === p ? "bg-black text-white" : "bg-white"}`}
      >
        {label || p}
      </Link>
    );
  };
  if (current > 1) items.push(mk(current - 1, "Prev"));
  for (let p = 1; p <= total; p++) items.push(mk(p));
  if (current < total) items.push(mk(current + 1, "Next"));
  return <div className="flex items-center gap-2">{items}</div>;
}

function ActiveChips({
  locale,
  subject,
  subjects,
  language,
  min,
  max,
  minUsd,
  maxUsd,
  ratingMin,
  reviewsMin,
  hasVideo,
  hasMedia,
  native,
  days,
  slot,
  sort,
  t,
}: {
  locale: string;
  subject?: string;
  subjects?: string[];
  language?: string;
  min?: number;
  max?: number;
  minUsd?: number;
  maxUsd?: number;
  ratingMin?: number;
  reviewsMin?: number;
  hasVideo?: boolean;
  hasMedia?: boolean;
  native?: boolean;
  days?: string;
  slot?: string;
  sort?: string;
  t: Record<string, string>;
}) {
  const chips: Array<{ label: string; href: string }> = [];
  const base = new URLSearchParams();
  if (subjects && subjects.length > 1) base.set("subjects", subjects.join(","));
  else if (subject) base.set("subject", subject);
  if (language) base.set("language", language);
  if (typeof min === "number") base.set("min", String(min));
  if (typeof max === "number") base.set("max", String(max));
  if (typeof ratingMin === "number") base.set("ratingMin", String(ratingMin));
  if (typeof reviewsMin === "number") base.set("reviewsMin", String(reviewsMin));
  if (hasVideo) base.set("hasVideo", "1");
  if (hasMedia) base.set("hasMedia", "1");
  if (native) base.set("native", "1");
  if (days) base.set("days", days);
  if (slot) base.set("slot", slot);
  if (sort) base.set("sort", sort);
  if (typeof minUsd === "number") base.set("minUsd", String(minUsd));
  if (typeof maxUsd === "number") base.set("maxUsd", String(maxUsd));

  const urlForRemove = (param: string) => {
    const p = new URLSearchParams(base.toString());
    p.delete(param);
    p.delete("page");
    const qs = p.toString();
    return `/${locale}/catalog${qs ? `?${qs}` : ""}`;
  };

  if (subjects && subjects.length > 1) chips.push({ label: `${t["filters.subject.label"] || "Subject"}: ${subjects.join(", ")}`, href: urlForRemove("subjects") });
  else if (subject) chips.push({ label: `${t["filters.subject.label"] || "Subject"}: ${subject}`, href: urlForRemove("subject") });
  if (language) chips.push({ label: `${t["filters.language.label"] || "Language"}: ${language}`, href: urlForRemove("language") });
  if (typeof min === "number") chips.push({ label: `${t["filters.min.label"] || "Min"}: ${min}`, href: urlForRemove("min") });
  if (typeof max === "number") chips.push({ label: `${t["filters.max.label"] || "Max"}: ${max}`, href: urlForRemove("max") });
  if (typeof ratingMin === "number") chips.push({ label: `${t["filters.rating.label"] || "Min rating"}: ${ratingMin}+`, href: urlForRemove("ratingMin") });
  if (typeof reviewsMin === "number") chips.push({ label: `${t["filters.reviews.label"] || "Min reviews"}: ${reviewsMin}+`, href: urlForRemove("reviewsMin") });
  if (typeof minUsd === "number" || typeof maxUsd === "number") chips.push({ label: `USD: ${typeof minUsd === "number" ? minUsd : "—"}–${typeof maxUsd === "number" ? maxUsd : "—"}`, href: urlForRemove("minUsd") });
  if (hasVideo) chips.push({ label: `${t["filters.hasVideo.label"] || "Has video intro"}`, href: urlForRemove("hasVideo") });
  if (hasMedia) chips.push({ label: `${t["filters.hasMedia.label"] || "Has gallery"}`, href: urlForRemove("hasMedia") });
  if (native) chips.push({ label: `${t["filters.native.label"] || "Native speaker"}`, href: urlForRemove("native") });
  if (days) chips.push({ label: `${t["filters.availability.days"] || "Days available"}: ${days}`, href: urlForRemove("days") });
  if (slot) chips.push({ label: `${t["filters.availability.slot"] || "Time of day"}: ${slot}`, href: urlForRemove("slot") });
  if (sort) chips.push({ label: `${t["filters.sort.label"] || "Sort"}: ${sort}`, href: urlForRemove("sort") });

  if (chips.length === 0) return null as any;
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {chips.map((c) => (
        <a key={c.label} href={c.href} className="px-2 py-1 rounded-full border text-xs bg-white">
          {c.label} ✕
        </a>
      ))}
    </div>
  );
}
