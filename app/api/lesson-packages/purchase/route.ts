import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const MAX_TRIAL_CREDITS = 5;

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user ? String((session.user as any).id || "") : "";
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });

  const tutorId = String(body?.tutorId || "").trim();
  const lessons = Math.trunc(Number(body?.lessons));
  const purchaseKey = String(body?.purchaseKey || "").trim();
  const rateCents = Math.trunc(Number(body?.rateCents));

  if (!tutorId || !purchaseKey || !Number.isFinite(lessons) || lessons <= 0) {
    return NextResponse.json({ ok: false, error: "tutorId, lessons, purchaseKey required" }, { status: 400 });
  }

  try {
    const lpp = (prisma as any)?.lessonPackagePurchase;
    const lb = (prisma as any)?.lessonBalance;
    const tb = (prisma as any)?.trialBalance;
    if (!lpp?.create || !lb?.upsert || !tb?.upsert) {
      return NextResponse.json({ ok: false, error: "DB not ready" }, { status: 500 });
    }

    let applied = false;
    try {
      await lpp.create({
        data: {
          purchaseKey,
          studentId: userId,
          tutorId,
          lessons,
        },
        select: { id: true },
      });
      applied = true;
    } catch (e: any) {
      const code = String(e?.code || "");
      if (code === "P2002") {
        applied = false;
      } else {
        throw e;
      }
    }

    if (applied) {
      try {
        if (Number.isFinite(rateCents) && rateCents > 0) {
          const t = await prisma.tutor.findUnique({ where: { id: tutorId }, select: { rateCents: true } }).catch(() => null);
          const curRate = Number((t as any)?.rateCents ?? 0) || 0;
          if (curRate <= 0) {
            await prisma.tutor.update({ where: { id: tutorId }, data: { rateCents }, select: { id: true } }).catch(() => null);
          }
        }
      } catch {
        // ignore
      }

      await lb.upsert({
        where: { studentId_tutorId: { studentId: userId, tutorId } },
        create: { studentId: userId, tutorId, credits: lessons },
        update: { credits: { increment: lessons } },
        select: { credits: true },
      });
    }

    const curTb = await tb.upsert({
      where: { studentId: userId },
      create: { studentId: userId, credits: MAX_TRIAL_CREDITS },
      update: {},
      select: { credits: true },
    });

    const cur = Number(curTb?.credits ?? 0) || 0;
    if (cur < MAX_TRIAL_CREDITS) {
      await tb.update({
        where: { studentId: userId },
        data: { credits: MAX_TRIAL_CREDITS },
        select: { credits: true },
      });
    }

    const afterLb = await lb.findUnique({
      where: { studentId_tutorId: { studentId: userId, tutorId } },
      select: { credits: true },
    });

    return NextResponse.json({
      ok: true,
      lessonCredits: Number(afterLb?.credits ?? 0) || 0,
      trialCredits: MAX_TRIAL_CREDITS,
      applied,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "DB error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
