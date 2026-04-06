import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role") || "student";
    const userId = searchParams.get("userId");
    if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

    if (role === "tutor") {
      const tutor = await prisma.tutor.findUnique({ where: { userId } });
      if (!tutor) return Response.json({ bookings: [] });
      const bookings = await prisma.booking.findMany({ where: { tutorId: tutor.id }, orderBy: { startsAt: "desc" } });
      return Response.json({ bookings });
    } else {
      const bookings = await prisma.booking.findMany({ where: { studentId: userId }, orderBy: { startsAt: "desc" } });
      return Response.json({ bookings });
    }
  } catch (e: any) {
    return Response.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
