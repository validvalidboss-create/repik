import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Not available" }, { status: 404 });
  }
  const { searchParams } = new URL(req.url);
  const token = String(searchParams.get("token") || "").trim();
  const count = Math.max(1, Math.min(20, Math.trunc(Number(searchParams.get("count") ?? 10) || 10)));
  const creditsEach = Math.max(1, Math.min(10, Math.trunc(Number(searchParams.get("creditsEach") ?? 3) || 3)));

  const session = await auth();
  const authedUserId = session?.user ? String((session.user as any).id || "") : "";
  const seedToken = String(process.env.DEV_SEED_TOKEN || "dev").trim();
  const tokenOk = !!seedToken && token === seedToken;

  const userId = authedUserId
    ? authedUserId
    : tokenOk
      ? await (async () => {
          const u = await prisma.user
            .findFirst({
              where: { role: { not: "TUTOR" as any } },
              select: { id: true },
              orderBy: { createdAt: "desc" },
            })
            .catch(() => null);
          return u?.id ? String(u.id) : "";
        })()
      : "";

  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const tutors = await prisma.tutor.findMany({
      where: { tracks: { hasEvery: ["status:active"] } },
      select: { id: true, user: { select: { name: true } } },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: count,
    });

    if (!tutors.length) {
      return NextResponse.json({ ok: false, error: "No active tutors found" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const lb = (tx as any).lessonBalance;
      if (!lb?.upsert) throw new Error("LESSON_BALANCE_NOT_CONFIGURED");
      const created: Array<{ tutorId: string; tutorName: string; credits: number }> = [];
      for (const t of tutors) {
        const row = await lb.upsert({
          where: { studentId_tutorId: { studentId: userId, tutorId: String(t.id) } },
          create: { studentId: userId, tutorId: String(t.id), credits: creditsEach },
          update: { credits: creditsEach },
          select: { tutorId: true, credits: true },
        });
        created.push({
          tutorId: String(row.tutorId),
          tutorName: String((t as any)?.user?.name || "Tutor"),
          credits: Number(row.credits || 0),
        });
      }
      return created;
    });

    return NextResponse.json({ ok: true, tutorsFound: tutors.length, count: result.length, creditsEach, items: result });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Not available" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const token = String(searchParams.get("token") || "").trim();
  const seedToken = String(process.env.DEV_SEED_TOKEN || "dev").trim();
  const tokenOk = !!seedToken && token === seedToken;

  const session = await auth();
  const authedUserId = session?.user ? String((session.user as any).id || "") : "";
  const userId = authedUserId
    ? authedUserId
    : tokenOk
      ? await (async () => {
          const u = await prisma.user
            .findFirst({
              where: { role: { not: "TUTOR" as any } },
              select: { id: true },
              orderBy: { createdAt: "desc" },
            })
            .catch(() => null);
          return u?.id ? String(u.id) : "";
        })()
      : "";

  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const count = Math.max(1, Math.min(20, Math.trunc(Number((body as any)?.count ?? 10) || 10)));
  const creditsEach = Math.max(1, Math.min(10, Math.trunc(Number((body as any)?.creditsEach ?? 3) || 3)));

  try {
    const tutors = await prisma.tutor.findMany({
      where: {
        tracks: { hasEvery: ["status:active"] },
      },
      select: { id: true, user: { select: { name: true } } },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: count,
    });

    if (!tutors.length) {
      return NextResponse.json({ ok: false, error: "No active tutors found" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const lb = (tx as any).lessonBalance;
      if (!lb?.upsert) throw new Error("LESSON_BALANCE_NOT_CONFIGURED");

      const created: Array<{ tutorId: string; tutorName: string; credits: number }> = [];
      for (const t of tutors) {
        const row = await lb.upsert({
          where: { studentId_tutorId: { studentId: userId, tutorId: String(t.id) } },
          create: { studentId: userId, tutorId: String(t.id), credits: creditsEach },
          update: { credits: creditsEach },
          select: { tutorId: true, credits: true },
        });
        created.push({ tutorId: String(row.tutorId), tutorName: String((t as any)?.user?.name || "Tutor"), credits: Number(row.credits || 0) });
      }
      return created;
    });

    return NextResponse.json({ ok: true, tutorsFound: tutors.length, count: result.length, creditsEach, items: result });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
