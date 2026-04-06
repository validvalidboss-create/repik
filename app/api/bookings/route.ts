import { NextRequest } from "next/server";
import { PrismaClient, BookingStatus } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const { studentId, tutorId, startsAt, endsAt, priceCents, currency = "UAH" } = await req.json();
    if (!studentId || !tutorId || !startsAt || !endsAt) {
      return Response.json({ error: "studentId, tutorId, startsAt, endsAt required" }, { status: 400 });
    }
    const booking = await prisma.booking.create({
      data: {
        studentId,
        tutorId,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        status: BookingStatus.PENDING,
        priceCents: priceCents ?? 0,
        currency,
      },
    });
    return Response.json({ booking });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role") || "student";
    const userId = searchParams.get("userId");
    if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

    if (role === "tutor") {
      const bookings = await prisma.booking.findMany({ where: { tutor: { userId: userId } }, orderBy: { startsAt: "desc" } });
      return Response.json({ bookings });
    } else {
      const bookings = await prisma.booking.findMany({ where: { studentId: userId }, orderBy: { startsAt: "desc" } });
      return Response.json({ bookings });
    }
  } catch (e: any) {
    return Response.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
