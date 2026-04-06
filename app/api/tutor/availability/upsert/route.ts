import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = String(user.id);

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.windows)) {
    return NextResponse.json({ error: "Invalid body. Use { windows: [{ weekday, startMin, endMin, timezone }] }" }, { status: 400 });
  }

  const tutor = await prisma.tutor.findUnique({ where: { userId }, select: { id: true } });
  if (!tutor) return NextResponse.json({ error: "Tutor profile not found" }, { status: 404 });

  // Replace all availability windows for simplicity in MVP
  await prisma.$transaction([
    prisma.availability.deleteMany({ where: { tutorId: tutor.id } }),
    prisma.availability.createMany({
      data: body.windows.map((w: any) => ({
        tutorId: tutor.id,
        weekday: Number(w.weekday),
        startMin: Number(w.startMin),
        endMin: Number(w.endMin),
        timezone: String(w.timezone || "UTC"),
      })),
    }),
  ]);

  const availability = await prisma.availability.findMany({ where: { tutorId: tutor.id }, orderBy: [{ weekday: 'asc' }, { startMin: 'asc' }] });
  return NextResponse.json({ ok: true, availability });
}
