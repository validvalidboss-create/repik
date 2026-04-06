import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const bookingId = searchParams.get("bookingId");
  if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });

  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { tutor: true } });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isMember = booking.studentId === String((user as any).id) || booking.tutor.userId === String((user as any).id);
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const messages = await prisma.message.findMany({
    where: { bookingId },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const bookingId = body?.bookingId ? String(body.bookingId) : "";
  const content = typeof body?.content === "string" ? String(body.content) : "";
  const attachments = Array.isArray(body?.attachments)
    ? (body.attachments
        .map((x: any) => (typeof x === "string" ? x.trim() : ""))
        .filter(Boolean)
        .slice(0, 5) as string[])
    : [];
  if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });
  if (!content.trim() && attachments.length === 0) {
    return NextResponse.json({ error: "content or attachments required" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { tutor: true } });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isMember = booking.studentId === String((user as any).id) || booking.tutor.userId === String((user as any).id);
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const msg = await prisma.message.create({
    data: {
      bookingId,
      senderId: String((user as any).id),
      content: String(content || ""),
      attachments,
    },
  });
  return NextResponse.json({ message: msg });
}
