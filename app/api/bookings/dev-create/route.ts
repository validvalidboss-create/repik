import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const user = session?.user as any;
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const form = await req.formData().catch(() => null);
    const locale = form ? String(form.get("locale") || "uk") : "uk";
    const mode = form ? String(form.get("mode") || "auto") : "auto";

    const selfTutor = await prisma.tutor.findUnique({ where: { userId: String(user.id) } });

    const startsAt = new Date(Date.now() - 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

    let tutorId = selfTutor?.id;
    let studentId = String(user.id);

    if (mode === "tutor") {
      if (!selfTutor?.id) {
        return NextResponse.json({ error: "You are not a tutor" }, { status: 400 });
      }
      tutorId = selfTutor.id;
      const anyStudent = await prisma.user.findFirst({ where: { id: { not: String(user.id) } }, orderBy: { updatedAt: "desc" } });
      if (!anyStudent?.id) return NextResponse.json({ error: "No student available" }, { status: 400 });
      studentId = String(anyStudent.id);
    } else {
      if (!tutorId) {
        const anyTutor = await prisma.tutor.findFirst({ orderBy: { updatedAt: "desc" } });
        tutorId = anyTutor?.id;
      }
    }

    if (!tutorId) {
      return NextResponse.json({ error: "No tutor available" }, { status: 400 });
    }

    const tutor = await prisma.tutor.findUnique({ where: { id: String(tutorId) } });

    const booking = await prisma.booking.create({
      data: {
        studentId,
        tutorId: String(tutorId),
        startsAt,
        endsAt,
        priceCents: 0,
        currency: tutor?.currency || selfTutor?.currency || "UAH",
        status: "CONFIRMED",
        durationMinutes: 30,
      },
    });

    const url = new URL(`/${encodeURIComponent(locale)}/lesson/${encodeURIComponent(booking.id)}`, req.url);
    return NextResponse.redirect(url, 303);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
