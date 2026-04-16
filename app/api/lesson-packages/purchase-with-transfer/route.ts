import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const MAX_TRIAL_CREDITS = 5;

const COMMISSION_RATE = 0.01;
const MIN_COMMISSION_CENTS = 1000;

function feeForValueCents(valueCents: number) {
  const v = Math.max(0, Math.floor(Number(valueCents) || 0));
  if (!v) return 0;
  return Math.max(MIN_COMMISSION_CENTS, Math.round(v * COMMISSION_RATE));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user ? String((session.user as any).id || "") : "";
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });

  const fromTutorId = String(body?.fromTutorId || "").trim();
  const toTutorId = String(body?.toTutorId || "").trim();
  const transferCreditsRaw = Number(body?.transferCredits);
  const transferCredits = Number.isFinite(transferCreditsRaw) ? Math.trunc(transferCreditsRaw) : 0;
  const transferKey = String(body?.transferKey || "").trim();
  const confirmCancelUpcoming = Boolean(body?.confirmCancelUpcoming);

  const lessonsRaw = Number(body?.lessons);
  const lessons = Number.isFinite(lessonsRaw) ? Math.trunc(lessonsRaw) : 0;
  const purchaseKey = String(body?.purchaseKey || "").trim();
  const rateCentsRaw = Number(body?.rateCents);
  const rateCents = Number.isFinite(rateCentsRaw) ? Math.trunc(rateCentsRaw) : 0;

  if (!fromTutorId || !toTutorId || !purchaseKey || !transferKey) {
    return NextResponse.json({ ok: false, error: "fromTutorId, toTutorId, purchaseKey, transferKey required" }, { status: 400 });
  }
  if (!Number.isFinite(transferCredits) || transferCredits <= 0) {
    return NextResponse.json({ ok: false, error: "transferCredits (>0) required" }, { status: 400 });
  }
  if (!Number.isFinite(lessons) || lessons <= 0) {
    return NextResponse.json({ ok: false, error: "lessons (>0) required" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      try {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${userId}:${fromTutorId}`}))`;
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

      const now = new Date();
      const upcomingConfirmed = await tx.booking
        .findMany({
          where: {
            studentId: userId,
            tutorId: fromTutorId,
            status: "CONFIRMED",
            startsAt: { gte: now },
          },
          orderBy: { startsAt: "asc" },
          select: { id: true, startsAt: true },
          take: 200,
        })
        .catch(() => [] as any[]);

      const current = await (tx as any).lessonBalance.findUnique({
        where: { studentId_tutorId: { studentId: userId, tutorId: fromTutorId } },
        select: { credits: true },
      });
      const curCredits = Math.max(0, Math.floor(Number(current?.credits ?? 0) || 0));
      if (curCredits < transferCredits) {
        throw new Error("NO_CREDITS");
      }

      const upcomingCount = Array.isArray(upcomingConfirmed) ? upcomingConfirmed.length : 0;
      const remainingCredits = Math.max(0, curCredits - Math.max(0, transferCredits));
      const cancelCount = Math.max(0, upcomingCount - remainingCredits);
      if (cancelCount > 0) {
        const LATE_CANCEL_HOURS = 3;
        const nowMs = Date.now();
        const toCancel = (upcomingConfirmed as any[]).slice(0, cancelCount);
        const late = toCancel.some((b: any) => {
          const startsAtMs = new Date(String(b?.startsAt || 0)).getTime();
          if (!Number.isFinite(startsAtMs)) return false;
          return startsAtMs - nowMs <= LATE_CANCEL_HOURS * 60 * 60 * 1000;
        });
        if (late) throw new Error("LATE_CANCEL");

        const msg = `${cancelCount} заброньованих урок(ів) буде скасовано, оскільки після переказу не вистачить балансу. Ви впевнені?`;
        if (!confirmCancelUpcoming) {
          return {
            requiresConfirm: true as const,
            confirmMessage: msg,
            cancelCount,
            cancelBookings: toCancel.map((b: any) => ({ id: String(b?.id || ""), startsAt: (b as any)?.startsAt ?? null })),
          };
        }

        const cancelIds = toCancel.map((b: any) => String(b?.id || "")).filter(Boolean);
        if (cancelIds.length) {
          await tx.booking.updateMany({ where: { id: { in: cancelIds }, status: "CONFIRMED" as any }, data: { status: "CANCELED" as any } });
        }
      }

      const fromRate = await effectiveRateCents(fromTutorId);
      if (!Number.isFinite(fromRate) || fromRate <= 0) throw new Error("NO_RATE");

      const transferValueCents = Math.max(0, transferCredits * Math.max(0, Math.floor(Number(fromRate) || 0)));
      const transferFeeCents = feeForValueCents(transferValueCents);
      const walletCreditCents = Math.max(0, transferValueCents - transferFeeCents);

      const debit = await (tx as any).lessonBalance.updateMany({
        where: { studentId: userId, tutorId: fromTutorId, credits: { gte: transferCredits } },
        data: { credits: { decrement: transferCredits } },
      });
      if (!debit?.count) throw new Error("NO_CREDITS");

      if (walletCreditCents > 0) {
        await (tx as any).walletBalance.upsert({
          where: { studentId: userId },
          create: { studentId: userId, balanceCents: walletCreditCents },
          update: { balanceCents: { increment: walletCreditCents } },
        });
      }

      const effectiveToRateCents = rateCents > 0 ? rateCents : await effectiveRateCents(toTutorId);
      if (!Number.isFinite(effectiveToRateCents) || effectiveToRateCents <= 0) throw new Error("NO_RATE");

      const priceCents = Math.max(0, lessons * effectiveToRateCents);

      const wbRow = await (tx as any).walletBalance.upsert({
        where: { studentId: userId },
        create: { studentId: userId, balanceCents: 0 },
        update: {},
        select: { balanceCents: true },
      });
      const walletBeforeCents = Math.max(0, Math.floor(Number((wbRow as any)?.balanceCents ?? 0) || 0));
      const walletDebitCents = Math.max(0, Math.min(walletBeforeCents, priceCents));

      const lpp = (tx as any).lessonPackagePurchase;
      const lb = (tx as any).lessonBalance;
      const tb = (tx as any).trialBalance;

      await lpp.create({
        data: {
          purchaseKey,
          studentId: userId,
          tutorId: toTutorId,
          lessons,
          rateCents: effectiveToRateCents,
        },
        select: { id: true },
      });

      if (walletDebitCents > 0) {
        const dec = await (tx as any).walletBalance.updateMany({
          where: { studentId: userId, balanceCents: { gte: walletDebitCents } },
          data: { balanceCents: { decrement: walletDebitCents } },
        });
        if (!dec?.count) throw new Error("WALLET_INSUFFICIENT");
      }

      await lb.upsert({
        where: { studentId_tutorId: { studentId: userId, tutorId: toTutorId } },
        create: { studentId: userId, tutorId: toTutorId, credits: lessons },
        update: { credits: { increment: lessons } },
        select: { credits: true },
      });

      const curTb = await tb.upsert({
        where: { studentId: userId },
        create: { studentId: userId, credits: MAX_TRIAL_CREDITS },
        update: {},
        select: { credits: true },
      });
      const cur = Number(curTb?.credits ?? 0) || 0;
      if (cur < MAX_TRIAL_CREDITS) {
        await tb.update({ where: { studentId: userId }, data: { credits: MAX_TRIAL_CREDITS }, select: { credits: true } });
      }

      await (tx as any).creditsTransfer.create({
        data: {
          transferKey,
          studentId: userId,
          fromTutorId,
          toTutorId,
          credits: lessons,
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
        ok: true,
        fromCredits: Number(fromBal?.credits ?? 0) || 0,
        toCredits: Number(toBal?.credits ?? 0) || 0,
        transferValueCents,
        transferFeeCents,
        walletCreditedCents: walletCreditCents,
        walletDebitedCents: walletDebitCents,
        priceCents,
      };
    });

    if ((result as any)?.requiresConfirm) {
      return NextResponse.json({ ok: false, ...(result as any) }, { status: 409 });
    }

    return NextResponse.json(result);
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : "Server error";
    if (msg === "NO_CREDITS") {
      return NextResponse.json({ ok: false, error: "Недостатньо уроків для переказу" }, { status: 400 });
    }
    if (msg === "WALLET_INSUFFICIENT") {
      return NextResponse.json({ ok: false, error: "Недостатньо коштів у гаманці" }, { status: 409 });
    }
    if (msg === "LATE_CANCEL") {
      return NextResponse.json(
        { ok: false, error: "Є урок(и) менше ніж за 3 години — їх уже не можна скасувати, тому переказ балансу на ці уроки неможливий" },
        { status: 400 },
      );
    }
    if (msg === "NO_RATE") {
      return NextResponse.json({ ok: false, error: "Не вдалося визначити ціну уроку" }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
