import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(_req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tutor = await prisma.tutor.findUnique({ where: { userId: String(user.id) }, select: { id: true } });
  if (!tutor) return NextResponse.json({ availability: [] });
  const availability = await prisma.availability.findMany({ where: { tutorId: tutor.id }, orderBy: [{ weekday: 'asc' }, { startMin: 'asc' }] });
  return NextResponse.json({ availability });
}
