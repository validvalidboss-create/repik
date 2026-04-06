import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MOCK_TUTORS } from "@/mocks/tutors";
import { isLocale, defaultLocale, type Locale } from "@/lib/i18n";
import { getMessages } from "@/lib/messages";
import { auth } from "@/lib/auth";
import ChatStartButton from "@/components/ChatStartButton";
import TutorSchedulePicker from "@/components/TutorSchedulePicker";
import TutorResumeSpecializations from "@/components/TutorResumeSpecializations";
import ContinueLessonsButton from "@/components/ContinueLessonsButton";
import CollapsibleText from "@/components/CollapsibleText";
import FavoriteTutorButton from "@/components/FavoriteTutorButton";
import BookScheduleModalButton from "@/components/BookScheduleModalButton";
import RecommendedTutorsCarousel from "@/components/RecommendedTutorsCarousel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function TutorPage({ params, searchParams }: { params: Promise<{ id?: string; locale: string }>, searchParams?: Promise<any> }) {
  const p = await params;
  const sp = searchParams ? await searchParams : undefined;
  // Prefer dynamic segment; fallback to uid or id query param
  const uid = typeof sp?.get === "function" ? (sp.get("uid") || "") : ((sp?.uid as string) || "");
  const qid = typeof sp?.get === "function" ? (sp.get("id") || "") : ((sp?.id as string) || "");
  const id = (p?.id as string) || uid || qid;
  if (!id) {
    // Client-side fallback to derive id reliably in dev when params/searchParams are empty
    const Client = (await import("@/components/TutorProfileClient")).default;
    return (
      <main className="container mx-auto px-4 py-12">
        <div className="text-[11px] text-neutral-500 mb-2">Client fallback mode</div>
        <Client />
      </main>
    );
  }
  const locale: Locale = isLocale(p.locale) ? (p.locale as Locale) : defaultLocale;
  const t = getMessages(locale) as Record<string, string>;
  // Debug banner to ensure route is matched in dev
  const DebugBanner =
    process.env.NODE_ENV !== "production" ? (
      <div className="text-[11px] text-neutral-500 border-b px-4 py-2">route: /{p.locale}/tutors/{id}</div>
    ) : null;
  let tutor: any = null;
  let dbg: any = { paramsId: p.id, usedId: id };
  let hasPastLessonWithTutor = false;
  try {
    // Handle mock tutors for demo routes like mock-<slug>
    if (id.startsWith("mock-")) {
      const slug = id.replace(/^mock-/, "");
      const mt = MOCK_TUTORS.find((t) => t.slug === slug);
      if (!mt) {
        return (
          <main className="container mx-auto px-4 py-12">
            {DebugBanner}
            {dbg.isOwner && dbg.listingStatus !== "none" && (
              <section className="mb-4">
                {dbg.listingStatus === "pending" && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <div className="font-medium mb-0.5">Анкета на модерації</div>
                    <div>Модерація зазвичай триває до 12 годин. Учні поки не бачать цю анкету у пошуку.</div>
                  </div>
                )}
                {dbg.listingStatus === "active" && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    <div className="font-medium mb-0.5">Анкета активна</div>
                    <div>Учні бачать цю анкету у пошуку та можуть бронювати уроки.</div>
                  </div>
                )}
                {dbg.listingStatus === "rejected" && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    <div className="font-medium mb-0.5">Анкету відхилено</div>
                    <div>
                      Перейдіть до профілю та натисніть «Редагувати анкету викладача», щоб виправити дані і надіслати анкету на модерацію ще раз.
                    </div>
                  </div>
                )}
              </section>
            )}
            <h1 className="text-2xl font-semibold mb-2">Tutor not found</h1>
            <p className="text-sm text-neutral-500 mb-4">Unknown mock slug: {slug}</p>
            <p className="mt-4">Повернутись до <Link href={`/${p.locale}/catalog`} className="underline">каталогу</Link>.</p>
          </main>
        );
      }
      // shape to match DB tutor partially
      tutor = {
        id: `mock-${mt.slug}`,
        userId: `mock-${mt.slug}`,
        user: { name: mt.name },
        subjects: mt.subjects,
        languages: mt.languages,
        rateCents: mt.rateCents,
        currency: mt.currency,
        rating: mt.rating,
        ratingCount: mt.ratingCount,
        bio: mt.bio,
      };
      dbg.mock = true;
    } else {
      const user = await prisma.user.findUnique({ where: { id } });
      dbg.userExists = !!user;
      tutor = await prisma.tutor.findFirst({
        where: { OR: [{ id }, { userId: id }] },
        include: { user: true, availability: true },
      });
      if (tutor && !tutor.moderationNote) {
        const rows = (await prisma.$queryRaw`
          SELECT "moderationNote" as "moderationNote"
          FROM "Tutor"
          WHERE "id" = ${tutor.id}
          LIMIT 1
        `) as any[];
        const note = rows?.[0]?.moderationNote;
        if (typeof note === "string" && note.trim().length > 0) {
          tutor.moderationNote = note;
        }
      }
      if (!tutor) {
        // Dev convenience: if a User exists with this id, create a stub Tutor so profile opens
        if (user) {
          tutor = await prisma.tutor.create({
            data: {
              userId: user.id,
              bio: "",
              headline: "",
              rateCents: 30000,
              currency: "UAH",
              languages: [user.locale || "uk"],
              subjects: ["english"],
            },
            include: { user: true },
          });
        }
      }
      dbg.tutorFound = !!tutor;
      dbg.tutorId = tutor?.id;
      dbg.tutorUserId = tutor?.userId;
      const sample = await prisma.tutor.findMany({ select: { id: true, userId: true }, take: 5, orderBy: { createdAt: "desc" } });
      dbg.sampleTutors = sample;
    }
  } catch (e: any) {
    return (
      <main className="container mx-auto px-4 py-12">
        {DebugBanner}
        <h1 className="text-2xl font-semibold mb-2">Помилка завантаження профілю</h1>
        <pre className="text-xs text-neutral-500 overflow-auto">{String(e?.message || e)}</pre>
        <p className="mt-4">Повернутись до <Link href={`/${p.locale}/catalog`} className="underline">каталогу</Link>.</p>
      </main>
    );
  }
  if (!tutor) {
    return (
      <main className="container mx-auto px-4 py-12">
        {DebugBanner}
        {dbg.isOwner && dbg.listingStatus !== "none" && (
          <section className="mb-4">
            {dbg.listingStatus === "pending" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <div className="font-medium mb-0.5">Анкета на модерації</div>
                <div>Модерація зазвичай триває до 12 годин. Учні поки не бачать цю анкету у пошуку.</div>
              </div>
            )}
            {dbg.listingStatus === "active" && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <div className="font-medium mb-0.5">Анкета активна</div>
                <div>Учні бачать цю анкету у пошуку та можуть бронювати уроки.</div>
              </div>
            )}
            {dbg.listingStatus === "rejected" && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <div className="font-medium mb-0.5">Анкету відхилено</div>
                <div className="mb-1">
                  Перейдіть до профілю та натисніть «Редагувати анкету викладача», щоб виправити дані і надіслати анкету на модерацію ще раз.
                </div>
                {tutor?.moderationNote && (
                  <div className="mt-1 text-xs text-red-900 bg-red-100 border border-red-200 rounded px-3 py-2 whitespace-pre-wrap">
                    <div className="font-medium mb-0.5">Коментар модератора:</div>
                    <div>{tutor.moderationNote}</div>
                  </div>
                )}
              </div>
            )}
            {dbg.listingStatus === "needs_revision" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <div className="font-medium mb-0.5">Анкета потребує правок</div>
                <div className="mb-1">Відредагуйте анкету згідно з рекомендаціями нижче і надішліть її на модерацію ще раз.</div>
                {tutor?.moderationNote && (
                  <div className="mt-1 text-xs text-amber-900 bg-amber-100 border border-amber-200 rounded px-3 py-2 whitespace-pre-wrap">
                    <div className="font-medium mb-0.5">Що потрібно покращити:</div>
                    <div>{tutor.moderationNote}</div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
        <h1 className="text-2xl font-semibold mb-2">Tutor not found</h1>
        <p className="text-sm text-neutral-500 mb-4">id/userId: {id}</p>
        <pre className="text-xs bg-neutral-50 border p-3 rounded overflow-auto">{JSON.stringify(dbg, null, 2)}</pre>
        <p className="mt-4">Повернутись до <Link href={`/${p.locale}/catalog`} className="underline">каталогу</Link>.</p>
      </main>
    );
  }

  const session = await auth();
  const viewer = session?.user as any;
  const viewerId = viewer?.id ? String(viewer.id) : null;
  const viewerRole = String(((viewer as any)?.role || "") as any).toUpperCase();
  const canBook = viewerRole !== "TUTOR";
  const isOwner = !!viewerId && viewerId === String(tutor.userId || "");
  const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const isAdmin = !!adminEmail && !!viewer?.email && String(viewer.email).toLowerCase() === adminEmail;

  if (viewerId && tutor?.id) {
    try {
      const past = await prisma.booking.findFirst({
        where: {
          studentId: viewerId,
          tutorId: String(tutor.id),
          status: { in: ["CONFIRMED" as any, "COMPLETED" as any] },
        },
        select: { id: true },
        orderBy: { startsAt: "desc" },
      });
      hasPastLessonWithTutor = !!past;
    } catch {
      hasPastLessonWithTutor = false;
    }
  }

  let listingStatus: "pending" | "active" | "rejected" | "needs_revision" | "none" = "none";
  const tracksArr: string[] = Array.isArray(tutor.tracks)
    ? (tutor.tracks as string[])
    : typeof tutor.tracks === "string"
    ? [tutor.tracks]
    : [];
  const statusTag = tracksArr.find((t) => typeof t === "string" && t.startsWith("status:"));
  if (statusTag) {
    if (statusTag.includes("active")) listingStatus = "active";
    else if (statusTag.includes("rejected")) listingStatus = "rejected";
    else if (statusTag.includes("needs_revision")) listingStatus = "needs_revision";
    else if (statusTag.includes("pending")) listingStatus = "pending";
  }

  // Pending / non-active profiles should not be visible to regular users.
  // Allow the tutor (owner) and admin (moderation preview) to view.
  if (listingStatus !== "active" && !isOwner && !isAdmin) {
    notFound();
  }

  dbg.isOwner = isOwner;
  dbg.listingStatus = listingStatus;

  const canSeeModerationBanner = isOwner || isAdmin;

  const reviews = await prisma.review.findMany({
    where: { booking: { tutorId: tutor.id } },
    include: { author: true, booking: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  let lessonsCount = 0;
  try {
    lessonsCount = await (prisma as any).booking.count({ where: { tutorId: tutor.id, status: "COMPLETED" } });
  } catch {}

  // Helpers for languages and experience
  const langLabel: Record<string, string> = {
    uk: "Українська",
    ru: "Російська",
    en: "Англійська",
    de: "Німецька",
    pl: "Польська",
    es: "Іспанська",
    fr: "Французька",
  };
  const levelLabel = (lvl?: string) => {
    if (!lvl) return "";
    const x = String(lvl).toUpperCase();
    if (x === "NATIVE" || x === "РІДНА" || x === "N") return "Рідна мова";
    if (/^C2$/.test(x)) return "Вільне володіння C2";
    if (/^C1$/.test(x)) return "Просунутий C1";
    if (/^B2$/.test(x)) return "Upper‑intermediate B2";
    if (/^B1$/.test(x)) return "Intermediate B1";
    if (/^A2$/.test(x)) return "Елементарний A2";
    if (/^A1$/.test(x)) return "Початковий A1";
    return lvl;
  };

  const subjectLabel: Record<string, string> = {
    english: "Англійська",
    ukrainian: "Українська",
    polish: "Польська",
    german: "Німецька",
    french: "Французька",
    italian: "Італійська",
    spanish: "Іспанська",
    math: "Математика",
    physics: "Фізика",
    chemistry: "Хімія",
    biology: "Біологія",
    history: "Історія",
    geography: "Географія",
    computer_science: "Інформатика",
    nmt: "Підготовка НМТ/ЗНО",
    support: "Підтримка",
  };
  const subjectLevelLabel = (lvl?: string) => {
    if (!lvl) return "";
    const x = String(lvl).toLowerCase();
    if (x === "school") return "Шкільна програма";
    if (x === "nmt") return "НМТ/ЗНО";
    if (x === "native") return "Рідна";
    if (["a1", "a2", "b1", "b2", "c1", "c2"].includes(x)) return x.toUpperCase();
    return lvl;
  };

  const subjectLevels: Record<string, string> = {};
  for (const tr of tracksArr) {
    if (typeof tr !== "string") continue;
    if (!tr.startsWith("subjlvl:")) continue;
    const rest = tr.replace("subjlvl:", "");
    const [k, lvl] = rest.split(":");
    if (k && lvl) subjectLevels[k] = lvl;
  }

  const specializations = (() => {
    const subjects = Array.isArray(tutor.subjects) ? (tutor.subjects as string[]) : [];
    const tracks = tracksArr
      .filter((x) => typeof x === "string")
      .filter((x) => !x.startsWith("status:"))
      .filter((x) => !x.startsWith("subjlvl:"));

    const subjItems = subjects.map((s) => subjectLabel[String(s || "")] || String(s || "")).filter(Boolean);
    const trackItems = tracks
      .map((s) => String(s || ""))
      .filter(Boolean)
      .filter((x) => !x.startsWith("rate30:"))
      .filter((x) => !x.startsWith("freefirst:"));

    const out: Array<{ title: string; items?: string[] }> = [];
    if (subjItems.length) out.push({ title: "Предмети", items: subjItems });
    if (trackItems.length) out.push({ title: "Напрямки", items: trackItems });
    return out;
  })();

  const directionLabel: Record<string, string> = {
    school: "Шкільна програма",
    conversation: "Розмовна мова",
    kids: "Для дітей",
    primary_1_4: "1–4 клас",
    grade_5_9: "5–9 клас",
    grade_10_11: "10–11 клас",
    preschool: "Підготовка до школи",
    dpa: "Підготовка до ДПА",
    nmt: "Підготовка НМТ/ЗНО",
    olympiads: "Олімпіади",
  };

  const learningDirectionsBySubject = (() => {
    const map = new Map<string, string[]>();
    for (const tr of tracksArr) {
      if (typeof tr !== "string") continue;
      if (!tr.startsWith("dir:")) continue;
      const rest = tr.replace("dir:", "");
      const [subj, dir] = rest.split(":");
      const s = String(subj || "").trim();
      const d = String(dir || "").trim();
      if (!s || !d) continue;
      const list = map.get(s) || [];
      if (!list.includes(d)) list.push(d);
      map.set(s, list);
    }
    return Array.from(map.entries()).map(([subjectKey, dirs]) => ({
      subjectKey,
      subjectLabel: subjectLabel[subjectKey] || subjectKey,
      dirs: dirs.map((d) => directionLabel[d] || d),
    }));
  })();
  type LangItem = { code: string; level?: string };
  const langs: LangItem[] = Array.isArray(tutor.languages)
    ? (tutor.languages as any[]).map((l: any) => {
        if (typeof l === "string") {
          // Accept formats: "en", "en:C2", "Англійська:C2"
          const [a, b] = l.split(":");
          const code = (a || "").toLowerCase();
          return { code, level: b };
        }
        return { code: String(l?.code || l?.lang || l || "").toLowerCase(), level: l?.level };
      })
    : [];
  const expYears: number = (tutor.experienceYears ?? tutor.experience ?? tutor.years ?? 0) as number;
  const mediaArr: string[] = Array.isArray(tutor.media) ? (tutor.media as string[]) : [];
  const photoUrl: string | undefined = mediaArr[0] || undefined;
  const resumeUrl: string | undefined = mediaArr[1] || undefined;
  const videoUrl: string = String((tutor as any).videoUrl || "").trim();

  const cloudinaryPlayable = (() => {
    if (!videoUrl) return null;
    if (!/res\.cloudinary\.com\//i.test(videoUrl)) return null;
    if (!/\/video\/upload\//i.test(videoUrl)) return null;
    const playable = videoUrl.replace(
      /\/video\/upload\//i,
      "/video/upload/f_mp4,vc_h264,ac_aac/",
    );
    const poster = videoUrl.replace(/\/video\/upload\//i, "/video/upload/so_0,f_jpg/").replace(/\.[a-z0-9]+(\?|$)/i, ".jpg$1");
    return { playable, poster };
  })();

  const videoPlayableUrl = cloudinaryPlayable?.playable || videoUrl;
  const videoPosterUrl = cloudinaryPlayable?.poster;

  const weekdayLabel: Record<number, string> = {
    0: "Неділя",
    1: "Понеділок",
    2: "Вівторок",
    3: "Середа",
    4: "Четвер",
    5: "Пʼятниця",
    6: "Субота",
  };

  const availRows: Array<{ weekday: number; startMin: number; endMin: number; timezone?: string | null }> =
    Array.isArray((tutor as any).availability) ? ((tutor as any).availability as any[]) : [];

  const schedule = (() => {
    const fmt = (m: number) => {
      const hh = Math.floor((Number(m) || 0) / 60);
      const mm = (Number(m) || 0) % 60;
      return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    };
    const byDay = new Map<number, Array<{ startMin: number; endMin: number }>>();
    for (const w of availRows) {
      const wd = Number(w?.weekday);
      const startMin = Number(w?.startMin);
      const endMin = Number(w?.endMin);
      if (!Number.isFinite(wd) || wd < 0 || wd > 6) continue;
      if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) continue;
      const list = byDay.get(wd) || [];
      list.push({ startMin, endMin });
      byDay.set(wd, list);
    }
    const days = Array.from(byDay.entries())
      .map(([weekday, windows]) => ({
        weekday,
        label: weekdayLabel[weekday] || String(weekday),
        windows: windows.sort((a, b) => a.startMin - b.startMin).map((x) => `${fmt(x.startMin)}–${fmt(x.endMin)}`),
      }))
      .sort((a, b) => a.weekday - b.weekday);

    const tz = String(availRows?.[0]?.timezone || "").trim();
    return { days, timezone: tz };
  })();

  const allowedDurations: number[] = Array.isArray((tutor as any).allowedDurations)
    ? ((tutor as any).allowedDurations as any[])
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n) && n > 0)
    : [];
  const lessonDurations = (allowedDurations.length ? allowedDurations : [Number((tutor as any).defaultLessonMinutes || 50)])
    .map((n) => Math.round(n))
    .filter((n) => Number.isFinite(n) && n > 0);

  const topReviews = reviews.slice(0, 3);
  const reviewCount = Number(tutor.ratingCount || reviews.length || 0);
  const rating10 = reviewCount > 0 ? Math.max(0, Math.min(10, Number(tutor.rating || 0) * 2)) : 10;

  const primarySubjectKey = (() => {
    const subjects = Array.isArray(tutor.subjects) ? (tutor.subjects as string[]) : [];
    return String(subjects?.[0] || "").trim().toLowerCase();
  })();

  const recommendedTutors = await (async () => {
    if (!primarySubjectKey) return [] as any[];
    try {
      return await prisma.tutor.findMany({
        where: {
          id: { not: String(tutor.id) },
          subjects: { has: primarySubjectKey },
          tracks: { hasEvery: ["status:active"] },
        } as any,
        include: { user: true },
        orderBy: [{ ratingCount: "desc" }, { rating: "desc" }, { createdAt: "desc" }],
        take: 9,
      });
    } catch {
      return [] as any[];
    }
  })();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12">
      {DebugBanner}
      {canSeeModerationBanner && listingStatus !== "active" && listingStatus !== "none" && (
        <section className="mb-6">
          {listingStatus === "pending" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <div className="font-medium mb-0.5">Анкета на модерації</div>
              <div>Учні поки не бачать цю анкету у пошуку.</div>
            </div>
          )}
          {listingStatus === "rejected" && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <div className="font-medium mb-0.5">Анкету відхилено</div>
              {tutor?.moderationNote ? (
                <div className="mt-1 whitespace-pre-wrap">Причина: {tutor.moderationNote}</div>
              ) : null}
            </div>
          )}
          {listingStatus === "needs_revision" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <div className="font-medium mb-0.5">Анкета потребує правок</div>
              {tutor?.moderationNote ? (
                <div className="mt-1 whitespace-pre-wrap">{tutor.moderationNote}</div>
              ) : null}
            </div>
          )}
        </section>
      )}
      {/* Video header with actions */}
      <section className="mb-8">
        <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-neutral-200 bg-neutral-100">
          {videoPlayableUrl ? (
            /\.(mp4|mov|m4v)(\?|$)/i.test(videoPlayableUrl) ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                className="absolute inset-0 h-full w-full object-cover bg-black"
                src={videoPlayableUrl}
                controls
                preload="auto"
                playsInline
                crossOrigin="anonymous"
                poster={videoPosterUrl || undefined}
              />
            ) : (
              <iframe
                className="absolute inset-0 h-full w-full"
                src={videoPlayableUrl}
                title="Tutor video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-500">Відео не додано</div>
          )}
        </div>
      </section>
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_300px] gap-8 sm:gap-6">
        {/* Left column */}
        <div className="min-w-0">
          {/* Header info */}
          <div className="mb-6">
            <div className="flex items-start gap-4">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrl}
                  alt="Tutor photo"
                  className="h-20 w-20 rounded-2xl object-cover border bg-neutral-100"
                />
              ) : (
                <div className="h-20 w-20 rounded-2xl bg-neutral-100 border" />
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-3xl font-semibold mb-2 truncate">{tutor.user?.name ?? "Tutor"}</h1>
                <div className="flex items-center gap-2 text-sm text-neutral-700 mb-2">
                  {(() => {
                    const rating5 = Math.max(0, Math.min(5, rating10 / 2));
                    const full = Math.floor(rating5);
                    const half = rating5 - full >= 0.5;
                    return (
                      <div className="flex items-center gap-1.5">
                        {Array.from({ length: 5 }).map((_, i) => {
                          const isFull = i < full;
                          const isHalf = !isFull && half && i === full;
                          return (
                            <span key={i} className="relative inline-block h-5 w-5">
                              <svg viewBox="0 0 24 24" aria-hidden="true" className="absolute inset-0 h-5 w-5 text-neutral-200">
                                <path
                                  fill="currentColor"
                                  d="M12 17.27l5.18 3.18-1.64-5.81L20 9.24l-5.9-.5L12 3.5 9.9 8.74 4 9.24l4.46 5.4-1.64 5.81L12 17.27z"
                                />
                              </svg>
                              <span className="absolute inset-0 overflow-hidden" style={{ width: isFull ? "100%" : isHalf ? "50%" : "0%" }}>
                                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-amber-500">
                                  <path
                                    fill="currentColor"
                                    d="M12 17.27l5.18 3.18-1.64-5.81L20 9.24l-5.9-.5L12 3.5 9.9 8.74 4 9.24l4.46 5.4-1.64 5.81L12 17.27z"
                                  />
                                </svg>
                              </span>
                            </span>
                          );
                        })}
                        <span className="text-xs text-neutral-500 ml-1">{rating5.toFixed(1)}/5</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
            {/* Stats row */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div className="border rounded-lg p-3 bg-white">
                <div className="text-xs text-neutral-500">{t["profile.experience"] || "Досвід"}</div>
                <div className="font-medium">{expYears ? `${expYears} років` : "—"}</div>
              </div>
              <div className="border rounded-lg p-3 bg-white">
                <div className="text-xs text-neutral-500">{t["unit.reviews"] || "Відгуків"}</div>
                <div className="font-medium">{Number(tutor.ratingCount || 0)}</div>
              </div>
              <div className="border rounded-lg p-3 bg-white">
                <div className="text-xs text-neutral-500">{t["profile.lessons"] || "Уроків"}</div>
                <div className="font-medium">{lessonsCount}</div>
              </div>
            </div>
          </div>

          <section className="mt-6">
            <div className="flex items-start justify-between gap-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm font-semibold text-neutral-900 flex-none">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white border border-neutral-200">🎓</span>
                <span>Викладає</span>
              </div>
              <div className="text-sm text-neutral-800 text-right leading-6">
                {(() => {
                  const subjects = Array.isArray(tutor.subjects) ? (tutor.subjects as string[]) : [];
                  if (subjects.length === 0) return "—";
                  return subjects
                    .map((s) => {
                      const key = String(s || "");
                      const lbl = subjectLabel[key] || key;
                      const lvl = subjectLevelLabel(subjectLevels[key]);
                      return lvl ? `${lbl} (${lvl})` : lbl;
                    })
                    .join(", ");
                })()}
              </div>
            </div>
          </section>

          {/* About (Про мене) */}
          <section className="mt-6">
            <h2 className="text-lg font-medium mb-2">{t["profile.about"] || "Про мене"}</h2>
            <CollapsibleText
              text={String(tutor.bio || "").trim()}
              collapsedLines={5}
              className="text-neutral-800 leading-6 whitespace-pre-line"
              moreLabel="Докладніше"
              lessLabel="Згорнути"
            />
          </section>

          {/* Languages (Мови) */}
          <section className="mt-6">
            <div className="flex items-start justify-between gap-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm font-semibold text-neutral-900 flex-none">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white border border-neutral-200">🌐</span>
                <span>Володію мовами</span>
              </div>
              <div className="text-sm text-neutral-800 text-right leading-6">
                {langs.length === 0
                  ? "—"
                  : langs
                      .map((ln) => {
                        const name = langLabel[ln.code] || ln.code.toUpperCase();
                        const lvl = levelLabel(ln.level);
                        return lvl ? `${name} — ${lvl}` : name;
                      })
                      .join(", ")}
              </div>
            </div>
          </section>

          {resumeUrl ? (
            <section className="mt-8">
              <a
                href={resumeUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm underline text-blue-700 hover:text-blue-900"
              >
                Переглянути резюме
              </a>
            </section>
          ) : null}

          {/* Schedule */}
          <section id="schedule" className="mt-10">
            <h2 className="text-2xl font-semibold mb-4">{t["profile.schedule"] || "Розклад"}</h2>
            <TutorSchedulePicker days={schedule.days as any} timezone={schedule.timezone} tutorId={String(tutor.id)} locale={p.locale} />
          </section>

          <section className="mt-12">
            <h2 className="text-2xl font-semibold mb-3">Напрями</h2>
            {learningDirectionsBySubject.length > 0 ? (
              <div className="space-y-4">
                {learningDirectionsBySubject.map((g) => (
                  <div key={g.subjectKey}>
                    <div className="text-sm font-semibold text-neutral-900">{g.subjectLabel}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {g.dirs.map((d) => (
                        <span
                          key={`${g.subjectKey}-${d}`}
                          className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-neutral-500">—</div>
            )}
          </section>

          {/* Reviews */}
          <section className="mt-12">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-2xl font-semibold">{t["profile.reviewsTitle"] || "Що говорять мої учні"}</h2>
              <span className="text-xs text-neutral-500">ⓘ</span>
            </div>

            {reviewCount > 0 ? (
              <div className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl font-semibold">{rating10.toFixed(1)}</div>
                    <div>
                      <div className="text-sm text-neutral-700">★ {t["profile.rating"] || "Рейтинг"}</div>
                      <div className="text-xs text-neutral-500">{t["profile.basedOn"] || "На основі"} {reviewCount} {t["unit.reviews"] || "відгуків"}</div>
                    </div>
                  </div>
                </div>

                {topReviews.length > 0 ? (
                  <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
                    {topReviews.map((r) => (
                      <div key={r.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-sm">{r.author?.name || "User"}</div>
                          <div className="text-sm"><span className="font-semibold">{r.rating}</span> ★</div>
                        </div>
                        <div className="mt-1 text-xs text-neutral-500">{new Date(r.createdAt as any).toLocaleDateString()}</div>
                        <div className="mt-3 text-sm text-neutral-800 leading-6">
                          {String(r.text || "").trim().length > 140 ? `${String(r.text).trim().slice(0, 140)}…` : (r.text || "—")}
                        </div>
                        {String(r.text || "").trim().length > 140 ? (
                          <button className="mt-3 text-sm underline text-neutral-700 hover:text-neutral-900">{t["common.showMore"] || "Показати більше"}</button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                {reviewCount > topReviews.length ? (
                  <div className="mt-4">
                    <button className="px-4 py-2 rounded-lg border border-neutral-200 text-sm hover:bg-neutral-50">
                      {t["profile.showAllReviews"] || `Показати всі ${reviewCount} відгуків`}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="text-sm text-neutral-500">{t["profile.noReviews"] || "Відгуків поки немає"}</div>
            )}
          </section>
        </div>

        {/* Right column: booking card */}
        <aside className="w-full sm:w-auto">
          <div className="border border-neutral-200 rounded-2xl p-5 bg-white shadow-sm sm:sticky sm:top-20">
            <div className="flex flex-col items-center text-center">
              <div className="text-3xl font-semibold leading-none">{(tutor.rateCents / 100).toFixed(0)} {tutor.currency}</div>
              <div className="mt-1 text-xs text-neutral-500">{t["profile.pricePerHour"] || "за годину"}</div>
            </div>

            <div className="mt-4 space-y-2">
              {!canBook ? (
                <button
                  type="button"
                  disabled
                  className="block w-full text-center bg-neutral-100 text-neutral-500 px-4 py-2.5 rounded-xl border border-neutral-200 font-medium cursor-not-allowed"
                >
                  {t["profile.bookTrial"] || "Забронювати пробний урок"}
                </button>
              ) : hasPastLessonWithTutor ? (
                <ContinueLessonsButton
                  locale={p.locale}
                  tutorId={String(tutor.id)}
                  tutorName={String(tutor?.user?.name || "")}
                  pricePerLessonUAH={Math.max(0, Math.round(Number(tutor.rateCents || 0) / 100))}
                  buttonText={t["profile.continueLessons"] || "Продовжити заняття"}
                />
              ) : (
                <BookScheduleModalButton
                  locale={String(p.locale)}
                  tutorDbId={String(tutor.id)}
                  href={`/${p.locale}/book/${encodeURIComponent(tutor.id)}`}
                  label={t["profile.bookTrial"] || "Забронювати пробний урок"}
                  className="block text-center bg-black text-white px-4 py-2.5 rounded-xl hover:bg-neutral-800 transition-colors font-medium"
                />
              )}
              <ChatStartButton
                tutorId={String(tutor.id)}
                locale={p.locale}
                label={t["profile.sendMessage"] || "Відправити повідомлення"}
                wrapperClassName="block"
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm hover:bg-neutral-50 disabled:opacity-50"
              />
              <FavoriteTutorButton tutorId={String(tutor?.id || id || "")} locale={p.locale} />
            </div>
          </div>
        </aside>
      </div>
      {recommendedTutors.length > 0 ? (
        <RecommendedTutorsCarousel
          locale={String(p.locale)}
          subjectKey={primarySubjectKey}
          subjectLabel={subjectLabel[primarySubjectKey] || primarySubjectKey}
          items={recommendedTutors.map((rt: any) => {
            const rid = String(rt?.id || "");
            const name = String(rt?.user?.name || "Репетитор");
            const media = Array.isArray(rt?.media) ? (rt.media as string[]) : [];
            const img = (media?.[0] as string | undefined) || (rt?.user?.image as string | undefined) || null;
            const bioRaw = String(rt?.headline || rt?.bio || "").trim();
            return {
              id: rid,
              name,
              image: img,
              rateCents: Number(rt?.rateCents || 0) || 0,
              currency: String(rt?.currency || "UAH"),
              rating: Number(rt?.rating || 0) || 0,
              ratingCount: Number(rt?.ratingCount || 0) || 0,
              bio: bioRaw,
            };
          })}
        />
      ) : null}
      {process.env.NODE_ENV !== "production" ? (
        <details className="mt-6 mb-2 text-xs text-neutral-600">
          <summary>Debug</summary>
          <pre className="bg-neutral-50 border p-3 rounded overflow-auto">{JSON.stringify(dbg, null, 2)}</pre>
        </details>
      ) : null}
    </main>
  );
}
