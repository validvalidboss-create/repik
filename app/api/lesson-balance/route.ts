import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = session?.user ? String((session.user as any).id || "") : "";
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tutorId = String(searchParams.get("tutorId") || "").trim();

  try {
    if (!tutorId) {
      const now = new Date();
      const list = await (prisma as any).lessonBalance.findMany({
        where: { studentId: userId, credits: { gt: 0 } },
        select: {
          tutorId: true,
          credits: true,
          tutor: {
            select: {
              id: true,
              rateCents: true,
              currency: true,
              media: true,
              user: { select: { name: true, image: true } },
            },
          },
        },
      });

      // Also include already-paid upcoming lessons (one-time payment) so that
      // the header "Баланс" does not show 0 right after a paid trial/one-time booking.
      // Exclude bookings paid via credits or free-first to avoid double counting.
      const paidUpcoming = await prisma.booking
        .findMany({
          where: {
            studentId: userId,
            status: "CONFIRMED",
            startsAt: { gte: now },
            paymentId: { not: null },
            NOT: [
              { paymentId: { startsWith: "credits" } as any },
              { paymentId: "free_first" as any },
            ],
          },
          select: {
            tutorId: true,
            priceCents: true,
            tutor: {
              select: {
                id: true,
                rateCents: true,
                currency: true,
                media: true,
                user: { select: { name: true, image: true } },
              },
            },
          },
        })
        .catch(() => [] as any[]);

      const needFallbackTutorIds = (() => {
        const fromBalances = Array.isArray(list)
          ? (list as any[])
              .filter((r: any) => (Number(r?.tutor?.rateCents ?? 0) || 0) <= 0)
              .map((r: any) => String(r?.tutorId || r?.tutor?.id || ""))
              .filter(Boolean)
          : [];
        const fromPaidUpcoming = Array.isArray(paidUpcoming)
          ? (paidUpcoming as any[])
              .filter((b: any) => (Number(b?.tutor?.rateCents ?? 0) || 0) <= 0)
              .map((b: any) => String(b?.tutorId || b?.tutor?.id || ""))
              .filter(Boolean)
          : [];
        return Array.from(new Set([...fromBalances, ...fromPaidUpcoming]));
      })();

      const fallbackPriceByTutorId = new Map<string, number>();
      if (needFallbackTutorIds.length > 0) {
        const rows = await prisma.booking.findMany({
          where: {
            studentId: userId,
            tutorId: { in: needFallbackTutorIds },
            priceCents: { gt: 0 },
            status: { notIn: ["CANCELED", "REFUNDED"] },
          },
          select: { tutorId: true, priceCents: true },
          orderBy: { startsAt: "desc" },
          distinct: ["tutorId"],
        });
        for (const r of rows as any[]) {
          const tid = String((r as any)?.tutorId || "");
          const pc = Number((r as any)?.priceCents ?? 0) || 0;
          if (tid && pc > 0) fallbackPriceByTutorId.set(tid, pc);
        }
      }

      const paidUpcomingValueByTutorId = new Map<string, number>();
      for (const b of paidUpcoming as any[]) {
        const tid = String((b as any)?.tutorId || "");
        if (!tid) continue;
        const priceCents = Math.max(0, Math.floor(Number((b as any)?.priceCents ?? 0) || 0));
        const rateCents = Math.max(0, Math.floor(Number((b as any)?.tutor?.rateCents ?? 0) || 0));
        const fallback = tid ? Math.max(0, Math.floor(Number(fallbackPriceByTutorId.get(tid) || 0) || 0)) : 0;
        const effectiveRateCents = rateCents > 0 ? rateCents : fallback;
        const pc = priceCents > 0 ? priceCents : effectiveRateCents;
        paidUpcomingValueByTutorId.set(tid, (paidUpcomingValueByTutorId.get(tid) || 0) + Math.max(0, pc));
      }

      const totalCredits = Array.isArray(list)
        ? list.reduce((sum: number, r: any) => sum + (Number(r?.credits ?? 0) || 0), 0)
        : 0;

      const totalValueCents = (() => {
        const creditsValue = Array.isArray(list)
          ? list.reduce((sum: number, r: any) => {
              const credits = Number(r?.credits ?? 0) || 0;
              const tutorId = String(r?.tutorId || r?.tutor?.id || "");
              const rateCents = Number(r?.tutor?.rateCents ?? 0) || 0;
              const fallback = tutorId ? Number(fallbackPriceByTutorId.get(tutorId) || 0) || 0 : 0;
              const effectiveRateCents = rateCents > 0 ? rateCents : fallback;
              return sum + credits * effectiveRateCents;
            }, 0)
          : 0;
        const upcomingPaidValue = Array.from(paidUpcomingValueByTutorId.values()).reduce((a, b) => a + (Number(b) || 0), 0);
        return Math.max(0, creditsValue + upcomingPaidValue);
      })();

      const byTutor = (() => {
        const map = new Map<string, any>();

        for (const r of Array.isArray(list) ? (list as any[]) : []) {
          const tid = String(r?.tutorId || r?.tutor?.id || "");
          if (!tid) continue;
          const credits = Math.max(0, Math.floor(Number(r?.credits ?? 0) || 0));
          const rateCents = Number(r?.tutor?.rateCents ?? 0) || 0;
          const fallback = tid ? Number(fallbackPriceByTutorId.get(tid) || 0) || 0 : 0;
          const effectiveRateCents = rateCents > 0 ? rateCents : fallback;
          const paidUpcomingValue = Math.max(0, Math.floor(Number(paidUpcomingValueByTutorId.get(tid) || 0) || 0));
          const valueCents = credits * effectiveRateCents + paidUpcomingValue;
          map.set(tid, {
            tutorId: tid,
            credits,
            rateCents: effectiveRateCents,
            valueCents,
            tutorName: String(r?.tutor?.user?.name || ""),
            tutorImage:
              (r?.tutor?.user?.image as string | null) ??
              (Array.isArray(r?.tutor?.media) ? (r?.tutor?.media?.[0] as string | undefined) : undefined) ??
              null,
          });
        }

        // Add tutors that only have already-paid upcoming lessons (no credits yet).
        for (const b of paidUpcoming as any[]) {
          const tid = String((b as any)?.tutorId || "");
          if (!tid) continue;
          if (map.has(tid)) continue;
          const rateCents = Number((b as any)?.tutor?.rateCents ?? 0) || 0;
          const fallback = tid ? Number(fallbackPriceByTutorId.get(tid) || 0) || 0 : 0;
          const effectiveRateCents = rateCents > 0 ? rateCents : fallback;
          const paidUpcomingValue = Math.max(0, Math.floor(Number(paidUpcomingValueByTutorId.get(tid) || 0) || 0));
          map.set(tid, {
            tutorId: tid,
            credits: 0,
            rateCents: effectiveRateCents,
            valueCents: paidUpcomingValue,
            tutorName: String((b as any)?.tutor?.user?.name || ""),
            tutorImage:
              ((b as any)?.tutor?.user?.image as string | null) ??
              (Array.isArray((b as any)?.tutor?.media) ? ((b as any)?.tutor?.media?.[0] as string | undefined) : undefined) ??
              null,
          });
        }

        return Array.from(map.values()).sort((a: any, b: any) => (Number(b?.valueCents ?? 0) || 0) - (Number(a?.valueCents ?? 0) || 0));
      })();

      return NextResponse.json({ ok: true, totalCredits, totalValueCents, currency: "UAH", byTutor });
    }

    const row = await (prisma as any).lessonBalance.findUnique({
      where: { studentId_tutorId: { studentId: userId, tutorId } },
      select: { credits: true, updatedAt: true },
    });

    return NextResponse.json({ ok: true, tutorId, credits: row?.credits ?? 0, updatedAt: row?.updatedAt ?? null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "DB error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  const userId = user?.id ? String(user.id || "") : "";
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const userEmail = String(user?.email || "").trim().toLowerCase();
  const isAdmin = !!adminEmail && !!userEmail && adminEmail === userEmail;
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const tutorId = String(body?.tutorId || "").trim();
  const delta = Number(body?.delta);

  if (!tutorId || !Number.isFinite(delta)) {
    return NextResponse.json({ error: "tutorId and delta required" }, { status: 400 });
  }
  if (!Number.isInteger(delta) || delta === 0) {
    return NextResponse.json({ error: "delta must be a non-zero integer" }, { status: 400 });
  }

  try {
    const updated = await (prisma as any).lessonBalance.upsert({
      where: { studentId_tutorId: { studentId: userId, tutorId } },
      create: {
        studentId: userId,
        tutorId,
        credits: delta,
      },
      update: {
        credits: { increment: delta },
      },
      select: { credits: true },
    });

    return NextResponse.json({ ok: true, tutorId, credits: updated.credits });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "DB error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
