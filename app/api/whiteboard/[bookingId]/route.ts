import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type WhiteboardEvent = {
  seq: number;
  bookingId: string;
  clientId: string;
  type: "stroke" | "text" | "clear";
  createdAt: number;
  payload: any;
};

const store: Map<string, { nextSeq: number; events: WhiteboardEvent[] }> = new Map();

function getBucket(bookingId: string) {
  let b = store.get(bookingId);
  if (!b) {
    b = { nextSeq: 1, events: [] };
    store.set(bookingId, b);
  }
  return b;
}

async function assertAccess(bookingId: string, userId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return { ok: false as const, status: 404, error: "Not found" };

  if (String(booking.studentId) === String(userId)) return { ok: true as const };

  const tutor = await prisma.tutor.findUnique({ where: { id: booking.tutorId } });
  const isTutor = tutor?.userId === String(userId);
  if (isTutor) return { ok: true as const };

  return { ok: false as const, status: 403, error: "Forbidden" };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    const session = await auth();
    const user = session?.user as any;
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolvedParams: any = typeof (params as any)?.then === "function" ? await (params as any) : params;
    const bookingId = resolvedParams?.bookingId ? String(resolvedParams.bookingId) : "";
    if (!bookingId) return NextResponse.json({ error: "Invalid bookingId" }, { status: 400 });

    const access = await assertAccess(bookingId, String(user.id));
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

    const url = new URL(req.url);
    const since = Number(url.searchParams.get("since") || "0") || 0;

    const bucket = getBucket(bookingId);
    const events = bucket.events.filter((e) => e.seq > since);

    return NextResponse.json({ events, nextSeq: bucket.nextSeq });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    const session = await auth();
    const user = session?.user as any;
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolvedParams: any = typeof (params as any)?.then === "function" ? await (params as any) : params;
    const bookingId = resolvedParams?.bookingId ? String(resolvedParams.bookingId) : "";
    if (!bookingId) return NextResponse.json({ error: "Invalid bookingId" }, { status: 400 });

    const access = await assertAccess(bookingId, String(user.id));
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

    const body = await req.json().catch(() => null);
    const clientId = String(body?.clientId || "");
    const eventsIn = Array.isArray(body?.events) ? body.events : [];

    if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
    if (!eventsIn.length) return NextResponse.json({ ok: true, added: 0 });

    const bucket = getBucket(bookingId);
    const added: WhiteboardEvent[] = [];

    for (const raw of eventsIn) {
      const type = String(raw?.type || "").trim();
      if (type !== "stroke" && type !== "text" && type !== "clear") continue;
      const ev: WhiteboardEvent = {
        seq: bucket.nextSeq++,
        bookingId,
        clientId,
        type,
        createdAt: Date.now(),
        payload: raw?.payload ?? null,
      };
      bucket.events.push(ev);
      added.push(ev);

      if (type === "clear") {
        // Keep the clear marker, drop previous history to prevent unbounded growth
        bucket.events = bucket.events.slice(-1);
      }

      // Cap history
      if (bucket.events.length > 2000) bucket.events = bucket.events.slice(-1500);
    }

    return NextResponse.json({ ok: true, added: added.length, lastSeq: bucket.nextSeq - 1 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
