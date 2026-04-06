import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAdminEmail(sessionUser: any) {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@repetitir.local";
  return !!sessionUser?.email && String(sessionUser.email).toLowerCase() === String(adminEmail).toLowerCase();
}

const HOLD_HOURS = 72;
const USD_TO_UAH = Number(process.env.USD_TO_UAH || "40") || 40;

function sumCents(arr: any[], pick: (x: any) => number) {
  return (Array.isArray(arr) ? arr : []).reduce((s, x) => s + (Number(pick(x)) || 0), 0);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const viewer = session?.user as any;
  if (!isAdminEmail(viewer)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const statusRaw = String(url.searchParams.get("status") || "pending").toLowerCase();
  const status = statusRaw === "paid" ? "PAID" : statusRaw === "failed" ? "FAILED" : statusRaw === "all" ? "ALL" : "PENDING";
  const q = String(url.searchParams.get("q") || "").trim().toLowerCase();

  const where: any = {};
  if (status !== "ALL") where.status = status;

  const payouts = await (prisma as any).payout.findMany({
    where,
    include: { tutor: { include: { user: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const filtered = q
    ? payouts.filter((p: any) => {
        const name = String(p?.tutor?.user?.name || "").toLowerCase();
        const email = String(p?.tutor?.user?.email || "").toLowerCase();
        const tid = String(p?.tutorId || "").toLowerCase();
        return name.includes(q) || email.includes(q) || tid.includes(q);
      })
    : payouts;

  const tutorIds: string[] = Array.from(new Set(filtered.map((p: any) => String(p.tutorId)).filter(Boolean))) as string[];

  const tutors = tutorIds.length
    ? await prisma.tutor.findMany({
        where: { id: { in: tutorIds as string[] } },
        include: { user: true },
      })
    : [];
  const tutorById = new Map(tutors.map((t: any) => [String(t.id), t]));

  const bookings = tutorIds.length
    ? await prisma.booking.findMany({
        where: {
          tutorId: { in: tutorIds as string[] },
          paymentId: { not: null },
        },
        select: {
          tutorId: true,
          status: true,
          endsAt: true,
          endedAt: true,
          priceCents: true,
          commissionUSDCents: true,
        },
        take: 5000,
      })
    : [];

  const now = Date.now();
  const cutoffMs = now - HOLD_HOURS * 60 * 60 * 1000;

  const bookingBuckets = new Map<
    string,
    {
      grossSettledCents: number;
      grossHoldCents: number;
      commissionSettledCents: number;
      commissionHoldCents: number;
    }
  >();

  for (const b of bookings as any[]) {
    const tid = String(b.tutorId || "");
    if (!tid) continue;
    const st = String(b.status || "").toUpperCase();
    if (st !== "COMPLETED") continue;
    const endMs = new Date((b as any).endedAt || b.endsAt).getTime();
    if (!Number.isFinite(endMs)) continue;

    const prev =
      bookingBuckets.get(tid) ||
      {
        grossSettledCents: 0,
        grossHoldCents: 0,
        commissionSettledCents: 0,
        commissionHoldCents: 0,
      };
    const cents = Number((b as any).priceCents || 0) || 0;
    const commissionCents = (Number((b as any).commissionUSDCents || 0) || 0) * USD_TO_UAH;
    if (endMs < cutoffMs) {
      prev.grossSettledCents += cents;
      prev.commissionSettledCents += commissionCents;
    } else {
      prev.grossHoldCents += cents;
      prev.commissionHoldCents += commissionCents;
    }
    bookingBuckets.set(tid, prev);
  }

  const payoutsAll = tutorIds.length
    ? await (prisma as any).payout.findMany({
        where: { tutorId: { in: tutorIds } },
        select: { tutorId: true, amountCents: true, status: true },
        take: 2000,
      })
    : [];

  const payoutBuckets = new Map<string, { pending: number; paid: number; failed: number }>();
  for (const p of payoutsAll as any[]) {
    const tid = String(p.tutorId || "");
    if (!tid) continue;
    const prev = payoutBuckets.get(tid) || { pending: 0, paid: 0, failed: 0 };
    const cents = Number(p.amountCents || 0) || 0;
    const st = String(p.status || "").toUpperCase();
    if (st === "PAID") prev.paid += cents;
    else if (st === "FAILED") prev.failed += cents;
    else prev.pending += cents;
    payoutBuckets.set(tid, prev);
  }

  const items = filtered.map((p: any) => {
    const tid = String(p.tutorId || "");
    const tutor = (tutorById.get(tid) || p.tutor) as any;
    const bb =
      bookingBuckets.get(tid) ||
      {
        grossSettledCents: 0,
        grossHoldCents: 0,
        commissionSettledCents: 0,
        commissionHoldCents: 0,
      };
    const pb = payoutBuckets.get(tid) || { pending: 0, paid: 0, failed: 0 };

    const netSettledCents = Math.max(0, bb.grossSettledCents - bb.commissionSettledCents);
    const netHoldCents = Math.max(0, bb.grossHoldCents - bb.commissionHoldCents);
    const availableCents = Math.max(0, netSettledCents - pb.paid - pb.pending);

    return {
      id: String(p.id),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      status: String(p.status),
      amountCents: Number(p.amountCents || 0) || 0,
      currency: String(p.currency || "UAH"),
      externalId: p.externalId ? String(p.externalId) : null,
      note: p.note ? String(p.note) : null,
      tutor: {
        id: tid,
        name: String(tutor?.user?.name || ""),
        email: String(tutor?.user?.email || ""),
        currency: String(tutor?.currency || "UAH"),
        payoutReceiverName: (tutor as any)?.payoutReceiverName ? String((tutor as any).payoutReceiverName) : null,
        payoutIban: (tutor as any)?.payoutIban ? String((tutor as any).payoutIban) : null,
        payoutBankName: (tutor as any)?.payoutBankName ? String((tutor as any).payoutBankName) : null,
        payoutCardLast4: (tutor as any)?.payoutCardLast4 ? String((tutor as any).payoutCardLast4) : null,
      },
      balance: {
        availableCents,
        holdCents: netHoldCents,
        payoutPendingCents: pb.pending,
        paidCents: pb.paid,
        earnedSettledCents: netSettledCents,
        grossSettledCents: bb.grossSettledCents,
        commissionSettledCents: bb.commissionSettledCents,
        grossHoldCents: bb.grossHoldCents,
        commissionHoldCents: bb.commissionHoldCents,
      },
    };
  });

  return NextResponse.json({ ok: true, items });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const viewer = session?.user as any;
  if (!isAdminEmail(viewer)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });

  const payoutId = String(body?.payoutId || "").trim();
  const status = String(body?.status || "").trim().toUpperCase();
  const externalId = body?.externalId != null ? String(body.externalId).trim().slice(0, 200) : null;
  const note = body?.note != null ? String(body.note).trim().slice(0, 2000) : null;

  if (!payoutId) return NextResponse.json({ ok: false, error: "payoutId required" }, { status: 400 });
  if (status !== "PAID" && status !== "FAILED") {
    return NextResponse.json({ ok: false, error: "status must be PAID or FAILED" }, { status: 400 });
  }

  const payout = await (prisma as any).payout.findUnique({ where: { id: payoutId } });
  if (!payout) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if (String(payout.status) !== "PENDING") {
    return NextResponse.json({ ok: false, error: "Only PENDING payouts can be updated" }, { status: 400 });
  }

  const updated = await (prisma as any).payout.update({
    where: { id: payoutId },
    data: {
      status: status as any,
      externalId: externalId || undefined,
      note: note || undefined,
    },
  });

  return NextResponse.json({ ok: true, payout: updated });
}
