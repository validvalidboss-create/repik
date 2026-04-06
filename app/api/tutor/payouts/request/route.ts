import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOLD_HOURS = 72;
const MIN_PAYOUT_CENTS = 1000;

function sumBy(arr: any[], pick: (x: any) => number) {
  return (Array.isArray(arr) ? arr : []).reduce((s, x) => s + (Number(pick(x)) || 0), 0);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = String((session?.user as any)?.id || "");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tutor = await prisma.tutor.findUnique({ where: { userId } });
  if (!tutor?.id) return NextResponse.json({ error: "Tutor not found" }, { status: 404 });

  const now = Date.now();
  const cutoffMs = now - HOLD_HOURS * 60 * 60 * 1000;

  const bookings = await prisma.booking.findMany({
    where: {
      tutorId: tutor.id,
      paymentId: { not: null },
    },
    select: {
      id: true,
      status: true,
      endsAt: true,
      endedAt: true,
      priceCents: true,
      currency: true,
    },
    orderBy: { startsAt: "desc" },
    take: 500,
  });

  const completedSettled = bookings.filter((b: any) => {
    const st = String(b?.status || "").toUpperCase();
    if (st !== "COMPLETED") return false;
    const endMs = new Date((b as any).endedAt || b.endsAt).getTime();
    if (!Number.isFinite(endMs)) return false;
    return endMs < cutoffMs;
  });

  const currency = String(tutor.currency || completedSettled?.[0]?.currency || "UAH");

  const earnedCents = sumBy(completedSettled, (b) => Number((b as any).priceCents || 0));

  const payouts = await prisma.payout.findMany({
    where: { tutorId: tutor.id },
    select: { amountCents: true, status: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const paidOutCents = sumBy(payouts.filter((p: any) => String(p.status) === "PAID"), (p) => Number(p.amountCents || 0));
  const pendingOutCents = sumBy(
    payouts.filter((p: any) => String(p.status) === "PENDING"),
    (p) => Number(p.amountCents || 0)
  );

  const availableCents = Math.max(0, earnedCents - paidOutCents - pendingOutCents);

  const contentType = String(req.headers.get("content-type") || "");
  const wantsJson = contentType.includes("application/json");

  const backUrl = (() => {
    const ref = req.headers.get("referer") || "";
    try {
      return new URL(ref);
    } catch {
      return null;
    }
  })();

  const redirectBackWithError = (msg: string) => {
    if (!backUrl) return NextResponse.redirect(new URL("/", req.url), { status: 303 });
    backUrl.searchParams.set("payout_error", msg);
    return NextResponse.redirect(backUrl, { status: 303 });
  };
  let requestedRaw: any = undefined;
  let requestedUAHRaw: any = undefined;
  if (wantsJson) {
    const body = await req.json().catch(() => null);
    requestedRaw = body?.amountCents;
    requestedUAHRaw = body?.amountUAH;
  } else {
    const form = await req.formData().catch(() => null);
    requestedRaw = form ? (form as any).get("amountCents") : undefined;
    requestedUAHRaw = form ? (form as any).get("amountUAH") : undefined;
  }

  const requestedCents = (() => {
    if (requestedRaw != null && requestedRaw !== "") return Number(requestedRaw || 0);
    if (requestedUAHRaw != null && requestedUAHRaw !== "") {
      const v = Number(String(requestedUAHRaw).replace(",", "."));
      if (!Number.isFinite(v)) return NaN;
      return Math.round(v * 100);
    }
    return availableCents;
  })();

  if (!Number.isFinite(requestedCents) || requestedCents <= 0) {
    if (!wantsJson) return redirectBackWithError("Невірна сума");
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }
  if (requestedCents < MIN_PAYOUT_CENTS) {
    if (!wantsJson) return redirectBackWithError("Мінімальна сума виплати: 10");
    return NextResponse.json({ error: `Minimum payout is ${MIN_PAYOUT_CENTS}` }, { status: 400 });
  }
  if (requestedCents > availableCents) {
    if (!wantsJson) return redirectBackWithError("Недостатньо доступних коштів");
    return NextResponse.json({ error: "Insufficient available balance" }, { status: 400 });
  }

  const payout = await prisma.payout.create({
    data: {
      tutorId: tutor.id,
      amountCents: Math.round(requestedCents),
      currency,
      status: "PENDING" as any,
    },
  });

  if (!wantsJson) {
    const back = req.headers.get("referer") || "/";
    return NextResponse.redirect(back, { status: 303 });
  }

  return NextResponse.json({ ok: true, payout });
}
