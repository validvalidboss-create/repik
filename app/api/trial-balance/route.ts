import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const DEFAULT_TRIAL_CREDITS = 3;
const MAX_TRIAL_CREDITS = 5;

export async function GET(_req: NextRequest) {
  const session = await auth();
  const userId = session?.user ? String((session.user as any).id || "") : "";
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tb = await prisma.$transaction(async (tx) => {
      const current = await (tx as any).trialBalance.upsert({
        where: { studentId: userId },
        create: { studentId: userId, credits: DEFAULT_TRIAL_CREDITS },
        update: {},
        select: { credits: true },
      });

      const cur = Number(current?.credits ?? 0) || 0;

      let next = Math.max(0, Math.min(MAX_TRIAL_CREDITS, cur));

      try {
        const hasPaidCredits = await (tx as any).lessonBalance.findFirst({
          where: { studentId: userId, credits: { gt: 0 } },
          select: { id: true },
        });
        if (hasPaidCredits) next = MAX_TRIAL_CREDITS;
      } catch {
        // ignore
      }

      if (next === cur) return { credits: cur };

      return (tx as any).trialBalance.update({
        where: { studentId: userId },
        data: { credits: next },
        select: { credits: true },
      });
    });

    const remaining = Math.max(0, Math.min(MAX_TRIAL_CREDITS, Number(tb?.credits ?? 0) || 0));
    return NextResponse.json({ ok: true, remaining });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "DB error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user ? String((session.user as any).id || "") : "";
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const delta = Math.trunc(Number(body?.delta ?? 0));
  if (!Number.isFinite(delta) || delta === 0) {
    return NextResponse.json({ ok: false, error: "Invalid delta" }, { status: 400 });
  }

  const topUpToMax = delta > 0;
  if (delta > 0) {
    if (delta !== 2) {
      return NextResponse.json({ ok: false, error: "Invalid delta" }, { status: 400 });
    }
    try {
      const hasPaidCredits = await (prisma as any).lessonBalance.findFirst({
        where: { studentId: userId, credits: { gt: 0 } },
        select: { id: true },
      });
      if (!hasPaidCredits) {
        return NextResponse.json({ ok: false, error: "Bonus trial credits require a purchase" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ ok: false, error: "DB error" }, { status: 500 });
    }
  }

  try {
    const tb = await prisma.$transaction(async (tx) => {
      const current = await (tx as any).trialBalance.upsert({
        where: { studentId: userId },
        create: { studentId: userId, credits: DEFAULT_TRIAL_CREDITS },
        update: {},
        select: { credits: true },
      });

      const cur = Number(current?.credits ?? 0) || 0;
      const next = topUpToMax
        ? Math.max(0, Math.min(MAX_TRIAL_CREDITS, Math.max(cur, MAX_TRIAL_CREDITS)))
        : Math.max(0, Math.min(MAX_TRIAL_CREDITS, cur + delta));
      if (next === cur) return { credits: cur };

      return (tx as any).trialBalance.update({
        where: { studentId: userId },
        data: { credits: next },
        select: { credits: true },
      });
    });

    const remaining = Math.max(0, Math.min(MAX_TRIAL_CREDITS, Number(tb?.credits ?? 0) || 0));
    return NextResponse.json({ ok: true, remaining });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "DB error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
