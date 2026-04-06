import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MOCK_TUTORS } from "@/mocks/tutors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function num(v: any) {
  const n = Number(v ?? "");
  return Number.isFinite(n) ? n : NaN;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const subject = url.searchParams.get("subject") || "";
  const subjectsCsv = url.searchParams.get("subjects") || ""; // CSV multi
  const tracksCsv = url.searchParams.get("tracks") || ""; // CSV multi
  const dirCsv = url.searchParams.get("dir") || "";
  const dirs = dirCsv
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const country = (url.searchParams.get("country") || "").toUpperCase();
  const nativeFlag = url.searchParams.get("native");
  const language = url.searchParams.get("language") || "";
  const q = (url.searchParams.get("q") || "").trim();
  const min = num(url.searchParams.get("min")); // legacy UAH
  const max = num(url.searchParams.get("max")); // legacy UAH
  const minUsd = num(url.searchParams.get("minUsd"));
  const maxUsd = num(url.searchParams.get("maxUsd"));
  const ratingMin = num(url.searchParams.get("ratingMin"));
  const reviewsMin = num(url.searchParams.get("reviewsMin"));
  const hasVideo = url.searchParams.get("hasVideo") === "1";
  const hasMedia = url.searchParams.get("hasMedia") === "1";
  const freeFirst = url.searchParams.get("freeFirst") === "1";
  const daysParam = url.searchParams.get("days") || "";
  const slot = url.searchParams.get("slot") || ""; // morn|day|eve|night
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = Math.max(1, Math.min(50, Number(url.searchParams.get("pageSize") || 12)));
  const sort = url.searchParams.get("sort") || "relevance";

  const where: any = {};
  if (subject) where.subjects = { has: subject };
  const subjects = subjectsCsv
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s);
  if (subjects.length) where.subjects = { ...(where.subjects || {}), hasEvery: subjects };

  const tracks = tracksCsv
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s);
  if (tracks.length) where.tracks = { hasEvery: tracks };

  const requiredTrackTokens: string[] = [];
  // по замовчуванню показуємо лише активні анкети
  requiredTrackTokens.push("status:active");
  if (freeFirst) requiredTrackTokens.push("freefirst:true");
  const allTrackTokens = [...requiredTrackTokens, ...dirs];
  if (allTrackTokens.length) where.tracks = { ...(where.tracks || {}), hasEvery: allTrackTokens };

  if (country) where.country = country;
  if (nativeFlag === "1" || nativeFlag === "true") where.native = true;
  if (language) where.languages = { has: language };
  // Price filters: prefer USD if provided, fallback to legacy min/max in UAH
  const usdRate = Number(process.env.USD_UAH_RATE || 40);
  if (!Number.isNaN(minUsd) && minUsd > 0) {
    const uahCents = Math.round(minUsd * usdRate * 100);
    where.rateCents = { ...(where.rateCents || {}), gte: uahCents };
  }
  if (!Number.isNaN(maxUsd) && maxUsd > 0) {
    const uahCents = Math.round(maxUsd * usdRate * 100);
    where.rateCents = { ...(where.rateCents || {}), lte: uahCents };
  }
  if (!Number.isNaN(min) && min > 0) where.rateCents = { ...(where.rateCents || {}), gte: Math.floor(min * 100) };
  if (!Number.isNaN(max) && max > 0) where.rateCents = { ...(where.rateCents || {}), lte: Math.floor(max * 100) };
  if (!Number.isNaN(ratingMin) && ratingMin > 0) where.rating = { ...(where.rating || {}), gte: ratingMin };
  if (!Number.isNaN(reviewsMin) && reviewsMin > 0) where.ratingCount = { ...(where.ratingCount || {}), gte: reviewsMin };
  if (hasVideo) where.videoUrl = { not: null };
  if (hasMedia) where.media = { isEmpty: false };
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
    if (Object.keys(availCond).length) where.availability = { some: availCond };
  }
  if (q) {
    where.OR = [
      { user: { name: { contains: q, mode: "insensitive" } } },
      { bio: { contains: q, mode: "insensitive" } },
      { subjects: { has: q.toLowerCase() } },
      { languages: { has: q.toLowerCase() } },
    ];
  }

  let orderBy: any = [{ createdAt: "desc" }];
  if (sort === "price_asc") orderBy = [{ rateCents: "asc" }];
  else if (sort === "price_desc") orderBy = [{ rateCents: "desc" }];
  else if (sort === "rating_desc") orderBy = [{ rating: "desc" }, { ratingCount: "desc" }];
  else if (sort === "popular") orderBy = [{ ratingCount: "desc" }, { rating: "desc" }];
  else if (sort === "new") orderBy = [{ createdAt: "desc" }];
  else orderBy = [{ rating: "desc" }, { createdAt: "desc" }];

  let total = 0;
  let items: any[] = [];
  try {
    total = await prisma.tutor.count({ where });
    items = await prisma.tutor.findMany({
      where,
      include: { user: true },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  } catch (e) {
    const subj = String(subject || "").trim().toLowerCase();
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
        lessonsCount: 0,
        studentsCount: 0,
      }));
    total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const slice = list.slice((page - 1) * pageSize, page * pageSize);
    return NextResponse.json({ items: slice, total, page, pageSize, totalPages, mocked: true });
  }

  const tutorIds = (Array.isArray(items) ? items : []).map((t: any) => String(t?.id || "")).filter(Boolean);
  let bookingRows: any[] = [];
  try {
    bookingRows = tutorIds.length
      ? await prisma.booking.findMany({
          where: { tutorId: { in: tutorIds }, status: { in: ["CONFIRMED", "COMPLETED"] as any } },
          select: { tutorId: true, studentId: true },
        })
      : [];
  } catch {
    bookingRows = [];
  }
  const lessonsCountByTutor = new Map<string, number>();
  const studentsByTutor = new Map<string, Set<string>>();
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
  items = (Array.isArray(items) ? items : []).map((t: any) => ({
    ...t,
    lessonsCount: lessonsCountByTutor.get(String(t?.id || "")) || 0,
    studentsCount: studentsByTutor.get(String(t?.id || ""))?.size || 0,
  }));

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return NextResponse.json({ items, total, page, pageSize, totalPages });
}
