import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const userId = String((session.user as any).id || "");
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const role = String(((session.user as any)?.role || "") as any).toUpperCase();
  if (role === "TUTOR") {
    return NextResponse.json({ ok: false, error: "Only students can transfer credits" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const mode = String(body?.mode || "credits").trim().toLowerCase();
  const fromTutorId = String(body?.fromTutorId || "").trim();
  const toTutorId = String(body?.toTutorId || "").trim();
  const credits = Math.trunc(Number(body?.credits));
  const valueCents = Math.trunc(Number(body?.valueCents));
  const transferKey = String(body?.transferKey || "").trim();

  if (!fromTutorId || !toTutorId || !transferKey) {
    return NextResponse.json({ ok: false, error: "fromTutorId, toTutorId, transferKey required" }, { status: 400 });
  }
  if (mode === "money") {
    if (!Number.isFinite(valueCents) || valueCents <= 0) {
      return NextResponse.json({ ok: false, error: "valueCents (>0) required" }, { status: 400 });
    }
  } else {
    if (!Number.isFinite(credits) || credits <= 0) {
      return NextResponse.json({ ok: false, error: "credits (>0) required" }, { status: 400 });
    }
  }
  if (fromTutorId === toTutorId) {
    return NextResponse.json({ ok: false, error: "Cannot transfer to the same tutor" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Idempotency
      const existing = await (tx as any).creditsTransfer?.findUnique?.({
        where: { transferKey },
        select: { id: true, credits: true, fromTutorId: true, toTutorId: true },
      });
      if (existing) {
        const fromBal = await (tx as any).lessonBalance.findUnique({
          where: { studentId_tutorId: { studentId: userId, tutorId: fromTutorId } },
          select: { credits: true },
        });
        const toBal = await (tx as any).lessonBalance.findUnique({
          where: { studentId_tutorId: { studentId: userId, tutorId: toTutorId } },
          select: { credits: true },
        });
        return {
          applied: false,
          fromCredits: Number(fromBal?.credits ?? 0) || 0,
          toCredits: Number(toBal?.credits ?? 0) || 0,
        };
      }

      // Prevent concurrent double-spend for this student+fromTutor
      try {
        const lockKey = `${userId}:${fromTutorId}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
      } catch {
        // ignore
      }

      const effectiveRateCents = async (tutorId: string) => {
        const t = await tx.tutor.findUnique({ where: { id: tutorId }, select: { rateCents: true } }).catch(() => null);
        const rate = Number((t as any)?.rateCents ?? 0) || 0;
        if (rate > 0) return rate;
        const lastPaid = await tx.booking
          .findFirst({
            where: {
              studentId: userId,
              tutorId,
              priceCents: { gt: 0 },
              status: { notIn: ["CANCELED", "REFUNDED"] },
            },
            select: { priceCents: true },
            orderBy: { startsAt: "desc" },
          })
          .catch(() => null);
        return Number((lastPaid as any)?.priceCents ?? 0) || 0;
      };

      const doCredits = async (fromDebitCredits: number, toAddCredits: number) => {
        const now = new Date();
        const upcomingConfirmedCount = await tx.booking
          .count({
            where: {
              studentId: userId,
              tutorId: fromTutorId,
              status: "CONFIRMED",
              startsAt: { gte: now },
            },
          })
          .catch(() => 0);

        const current = await (tx as any).lessonBalance.findUnique({
          where: { studentId_tutorId: { studentId: userId, tutorId: fromTutorId } },
          select: { credits: true },
        });
        const curCredits = Math.max(0, Math.floor(Number(current?.credits ?? 0) || 0));
        const maxTransferable = Math.max(0, curCredits - Math.max(0, Math.floor(Number(upcomingConfirmedCount || 0) || 0)));
        if (fromDebitCredits > maxTransferable) {
          throw new Error("RESERVED_CREDITS");
        }

        const debit = await (tx as any).lessonBalance.updateMany({
          where: { studentId: userId, tutorId: fromTutorId, credits: { gte: fromDebitCredits } },
          data: { credits: { decrement: fromDebitCredits } },
        });
        if (!debit?.count) {
          throw new Error("NO_CREDITS");
        }

        await (tx as any).lessonBalance.upsert({
          where: { studentId_tutorId: { studentId: userId, tutorId: toTutorId } },
          create: { studentId: userId, tutorId: toTutorId, credits: toAddCredits },
          update: { credits: { increment: toAddCredits } },
        });

        return { fromDebitCredits, toAddCredits };
      };

      const transfer =
        mode === "money"
          ? await (async () => {
              const fromRate = await effectiveRateCents(fromTutorId);
              const toRate = await effectiveRateCents(toTutorId);
              if (fromRate <= 0 || toRate <= 0) throw new Error("NO_RATE");

              const toAddCredits = Math.floor(valueCents / toRate);
              if (toAddCredits <= 0) throw new Error("VALUE_TOO_SMALL");
              const neededValueCents = toAddCredits * toRate;
              const fromDebitCredits = Math.ceil(neededValueCents / fromRate);
              if (fromDebitCredits <= 0) throw new Error("NO_CREDITS");
              return doCredits(fromDebitCredits, toAddCredits);
            })()
          : await doCredits(credits, credits);

      await (tx as any).creditsTransfer.create({
        data: {
          transferKey,
          studentId: userId,
          fromTutorId,
          toTutorId,
          credits: Number((transfer as any)?.toAddCredits ?? credits) || credits,
        },
        select: { id: true },
      });

      const fromBal = await (tx as any).lessonBalance.findUnique({
        where: { studentId_tutorId: { studentId: userId, tutorId: fromTutorId } },
        select: { credits: true },
      });
      const toBal = await (tx as any).lessonBalance.findUnique({
        where: { studentId_tutorId: { studentId: userId, tutorId: toTutorId } },
        select: { credits: true },
      });

      return {
        applied: true,
        fromCredits: Number(fromBal?.credits ?? 0) || 0,
        toCredits: Number(toBal?.credits ?? 0) || 0,
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : "Server error";
    if (msg === "NO_CREDITS") {
      return NextResponse.json({ ok: false, error: "Недостатньо уроків для переказу" }, { status: 400 });
    }
    if (msg === "RESERVED_CREDITS") {
      return NextResponse.json(
        { ok: false, error: "Частина уроків уже запланована — спочатку скасуйте/перенесіть майбутні уроки або переказуйте менше" },
        { status: 400 },
      );
    }
    if (msg === "NO_RATE") {
      return NextResponse.json({ ok: false, error: "Не вдалося визначити ціну уроку для переказу" }, { status: 400 });
    }
    if (msg === "VALUE_TOO_SMALL") {
      return NextResponse.json({ ok: false, error: "Недостатньо коштів для переказу" }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
