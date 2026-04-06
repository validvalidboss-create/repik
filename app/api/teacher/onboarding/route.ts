import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function getStatusFromTracks(tracks: unknown): string {
  const list: string[] = Array.isArray(tracks) ? (tracks as string[]).map(String) : [];
  const raw = list.find((t) => t.startsWith("status:"));
  return raw ? raw.replace("status:", "") : "draft";
}

function replaceStatusTrack(tracks: string[], status: string): string[] {
  const base = tracks.filter((t) => !t.startsWith("status:"));
  return [...base, `status:${status}`];
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tutor = await prisma.tutor.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      bio: "",
      headline: "",
      rateCents: 0,
      currency: "UAH",
      languages: [],
      subjects: [],
      // статус нової анкети: чернетка
      tracks: ["status:draft"],
    },
    include: { user: true },
  });

  return NextResponse.json({ tutor });
}

export async function PATCH(req: Request) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const {
    submitForModeration,
    resetOnboarding,
    firstName,
    lastName,
    country,
    timezone,
    city,
    languages,
    languageLevels,
    phone,
    phoneCountry,
    adult,
    subjectLevels,
    subjectLevelRows,
    subjects,
    bio,
    headline,
    ratePerLesson,
    ratePerLesson30,
    trialRatePerLesson,
    currency,
    experienceTag,
    experienceYears,
    teacherType,
    videoUrl,
    photoUrl,
    resume,
    certifications,
    noTeachingCertificate,
    freeFirstLesson,
    profileIntro,
    profileExperience,
    profileMotivation,
    directionsBySubject,
  } = body ?? {};

  const shouldUpdateDirections = !!directionsBySubject && typeof directionsBySubject === "object";

  const existingTutor = await prisma.tutor.findFirst({ where: { userId: user.id } });

  const currentStatus = getStatusFromTracks(existingTutor?.tracks);

  // Если модератор отклонил — нельзя править, пока пользователь не сбросит анкету и не начнет заново
  if (currentStatus === "rejected" && !resetOnboarding) {
    return NextResponse.json(
      { error: "Profile rejected. Please reset onboarding to start over." },
      { status: 409 },
    );
  }

  // Сброс анкеты "с нуля"
  if (resetOnboarding) {
    // оставляем только статус:draft
    const tracks = replaceStatusTrack(
      Array.isArray(existingTutor?.tracks) ? ((existingTutor?.tracks as any) as string[]) : [],
      "draft",
    );

    const tutor = await prisma.tutor.upsert({
      where: { userId: user.id },
      update: {
        bio: "",
        headline: "",
        rateCents: 0,
        currency: "UAH",
        subjects: [],
        country: null,
        videoUrl: null,
        media: [],
        tracks,
        moderationNote: null,
      } as any,
      create: {
        userId: user.id,
        bio: "",
        headline: "",
        rateCents: 0,
        currency: "UAH",
        languages: [user.locale || "uk"],
        subjects: [],
        videoUrl: null,
        media: [],
        tracks,
        moderationNote: null,
      } as any,
      include: { user: true },
    });
    return NextResponse.json({ tutor });
  }

  const data: any = {};
  if (typeof country === "string") data.country = country || null;
  if (Array.isArray(languages)) data.languages = languages.map(String).filter(Boolean);
  if (Array.isArray(subjects)) {
    const uniq: string[] = [];
    const seen = new Set<string>();
    for (const s of subjects) {
      const v = String(s || "").trim();
      if (!v) continue;
      if (seen.has(v)) continue;
      seen.add(v);
      uniq.push(v);
    }
    data.subjects = uniq;
  }
  if (typeof bio === "string") data.bio = bio;
  if (typeof headline === "string") data.headline = headline;
  if (typeof ratePerLesson === "number" && Number.isFinite(ratePerLesson)) {
    data.rateCents = Math.max(0, Math.round(ratePerLesson * 100));
  }
  if (typeof currency === "string" && currency) data.currency = currency;
  if (typeof videoUrl === "string") data.videoUrl = videoUrl || null;

  // базовые треки из существующей анкеты, без статусных
  let baseTracks: string[] = [];
  if (existingTutor && Array.isArray(existingTutor.tracks)) {
    baseTracks = (existingTutor.tracks as string[]).filter((t) => !t.startsWith("status:"));
  }

  // Чистим треки, которые мы контролируем на шаге "Данные"
  baseTracks = baseTracks.filter(
    (t) =>
      !t.startsWith("phone:") &&
      !t.startsWith("phonecc:") &&
      !t.startsWith("adult:") &&
      !t.startsWith("tz:") &&
      !t.startsWith("city:") &&
      !t.startsWith("expyrs:") &&
      !t.startsWith("langlvl:") &&
      !t.startsWith("subjlvl:") &&
      !t.startsWith("aud:") &&
      !t.startsWith("grade:") &&
      !t.startsWith("goal:") &&
      !t.startsWith("cert:") &&
      !t.startsWith("certnone:") &&
      !t.startsWith("freefirst:") &&
      !t.startsWith("desc:") &&
      (!shouldUpdateDirections || !t.startsWith("dir:")),
  );

  const metaTracks: string[] = [];
  if (typeof phone === "string" && phone.trim().length > 0) metaTracks.push(`phone:${phone.trim()}`);
  if (typeof phoneCountry === "string" && phoneCountry.trim().length > 0) metaTracks.push(`phonecc:${phoneCountry.trim()}`);
  if (typeof adult === "boolean") metaTracks.push(`adult:${adult ? "true" : "false"}`);
  if (typeof timezone === "string" && timezone.trim().length > 0) metaTracks.push(`tz:${timezone.trim()}`);
  if (typeof city === "string" && city.trim().length > 0) metaTracks.push(`city:${city.trim()}`);

  if (typeof experienceYears === "number" && Number.isFinite(experienceYears) && experienceYears > 0) {
    metaTracks.push(`expyrs:${Math.round(experienceYears)}`);
  }
  if (typeof experienceYears === "string") {
    const n = Number(String(experienceYears).trim());
    if (Number.isFinite(n) && n > 0) metaTracks.push(`expyrs:${Math.round(n)}`);
  }
  if (languageLevels && typeof languageLevels === "object") {
    for (const [k, v] of Object.entries(languageLevels as Record<string, unknown>)) {
      const code = String(k || "").trim();
      const lvl = String(v || "").trim();
      if (code && lvl) metaTracks.push(`langlvl:${code}:${lvl}`);
    }
  }

  if (subjectLevels && typeof subjectLevels === "object") {
    for (const [k, v] of Object.entries(subjectLevels as Record<string, unknown>)) {
      const code = String(k || "").trim();
      const lvl = String(v || "").trim();
      if (code && lvl) metaTracks.push(`subjlvl:${code}:${lvl}`);
    }
  }

  if (Array.isArray(subjectLevelRows)) {
    for (const row of subjectLevelRows as any[]) {
      if (!row || typeof row !== "object") continue;
      const code = String((row as any).key || "").trim();
      const lvl = String((row as any).level || "").trim();
      if (code && lvl) metaTracks.push(`subjlvl:${code}:${lvl}`);
    }
  }

  if (typeof experienceTag === "string" && experienceTag) metaTracks.push(`exp:${experienceTag}`);
  if (typeof teacherType === "string" && teacherType) metaTracks.push(`type:${teacherType}`);
  if (typeof ratePerLesson30 === "number" && Number.isFinite(ratePerLesson30) && ratePerLesson30 > 0) {
    metaTracks.push(`rate30:${Math.round(ratePerLesson30 * 100)}`);
  }
  if (typeof trialRatePerLesson === "number" && Number.isFinite(trialRatePerLesson) && trialRatePerLesson > 0) {
    metaTracks.push(`trial:${Math.round(trialRatePerLesson * 100)}`);
  }

  if (typeof noTeachingCertificate === "boolean") {
    metaTracks.push(`certnone:${noTeachingCertificate ? "true" : "false"}`);
  }

  if (typeof freeFirstLesson === "boolean") {
    metaTracks.push(`freefirst:${freeFirstLesson ? "true" : "false"}`);
  }
  if (Array.isArray(certifications)) {
    for (const c of certifications) {
      if (!c || typeof c !== "object") continue;
      try {
        const payload = JSON.stringify(c);
        metaTracks.push(`cert:${encodeURIComponent(payload)}`);
      } catch {
        // ignore
      }
    }
  }

  if (typeof profileIntro === "string") metaTracks.push(`desc:intro:${encodeURIComponent(profileIntro)}`);
  if (typeof profileExperience === "string") metaTracks.push(`desc:experience:${encodeURIComponent(profileExperience)}`);
  if (typeof profileMotivation === "string") metaTracks.push(`desc:motivate:${encodeURIComponent(profileMotivation)}`);

  if (directionsBySubject && typeof directionsBySubject === "object") {
    for (const [subj, dirs] of Object.entries(directionsBySubject as Record<string, unknown>)) {
      const subject = String(subj || "").trim();
      if (!subject) continue;
      const list = Array.isArray(dirs) ? (dirs as any[]).map((d) => String(d || "").trim()).filter(Boolean) : [];
      for (const dir of Array.from(new Set(list))) {
        metaTracks.push(`dir:${subject}:${dir}`);
      }
    }
  }

  if (
    typeof data.bio !== "string" &&
    (typeof profileIntro === "string" || typeof profileExperience === "string" || typeof profileMotivation === "string")
  ) {
    const parts: string[] = [];
    const intro = typeof profileIntro === "string" ? profileIntro.trim() : "";
    const exp = typeof profileExperience === "string" ? profileExperience.trim() : "";
    const mot = typeof profileMotivation === "string" ? profileMotivation.trim() : "";
    if (intro) parts.push(intro);
    if (exp) parts.push(exp);
    if (mot) parts.push(mot);
    const merged = parts.join("\n\n").trim();
    if (merged) data.bio = merged;
  }

  const nextStatus = submitForModeration ? "pending" : currentStatus;
  const statusTrack = `status:${nextStatus}`;
  const finalTracks = [...baseTracks, ...metaTracks.filter((t) => !baseTracks.includes(t)), statusTrack];
  data.tracks = finalTracks;

  // При отправке на модерацию очищаем старый комментарий модератора
  if (submitForModeration) data.moderationNote = null;

  if (typeof photoUrl === "string" && photoUrl) {
    data.media = [photoUrl];
  }
  if (typeof resume === "string" && resume) {
    const currentMedia: string[] = Array.isArray(data.media) ? data.media : [];
    // сохраняем резюме як другий елемент
    data.media = currentMedia.length ? [currentMedia[0], resume] : [resume];
  }

  const wantsNameUpdate = typeof firstName === "string" || typeof lastName === "string";
  if (!Object.keys(data).length && !wantsNameUpdate) return NextResponse.json({ ok: true });

  // Update user's display name
  if (wantsNameUpdate) {
    const fn = typeof firstName === "string" ? firstName.trim() : "";
    const ln = typeof lastName === "string" ? lastName.trim() : "";
    const nextName = `${fn} ${ln}`.trim();
    if (nextName.length > 0) {
      try {
        await prisma.user.update({ where: { id: String(user.id) }, data: { name: nextName } });
      } catch {
        // ignore
      }
    }
  }

  let tutor: any;
  try {
    tutor = await (prisma as any).tutor.upsert({
      where: { userId: user.id },
      update: data,
      create: {
        userId: user.id,
        bio: data.bio ?? "",
        headline: data.headline ?? "",
        rateCents: data.rateCents ?? 0,
        currency: data.currency ?? "UAH",
        languages: [user.locale || "uk"],
        subjects: data.subjects ?? [],
        videoUrl: data.videoUrl ?? null,
        media: data.media ?? [],
        tracks: data.tracks ?? ["status:draft"],
        moderationNote: null,
      },
      include: { user: true },
    });
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg.includes("Unknown argument `moderationNote`")) {
      tutor = await prisma.tutor.upsert({
        where: { userId: user.id },
        update: { ...data, moderationNote: undefined } as any,
        create: {
          userId: user.id,
          bio: data.bio ?? "",
          headline: data.headline ?? "",
          rateCents: data.rateCents ?? 0,
          currency: data.currency ?? "UAH",
          languages: [user.locale || "uk"],
          subjects: data.subjects ?? [],
          videoUrl: data.videoUrl ?? null,
          media: data.media ?? [],
          tracks: data.tracks ?? ["status:draft"],
        },
        include: { user: true },
      });
      await prisma.$executeRaw`
        UPDATE "Tutor"
        SET "moderationNote" = NULL
        WHERE "userId" = ${String(user.id)}
      `;
    } else {
      throw e;
    }
  }

  return NextResponse.json({ tutor });
}
