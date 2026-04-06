import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    const userId = String((session?.user as any)?.id || "");
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tutor = await prisma.tutor.findUnique({ where: { userId } });
    if (!tutor?.id) return NextResponse.json({ error: "Tutor not found" }, { status: 404 });

    const archived = await prisma.archivedStudent.findMany({
      where: { tutorId: tutor.id },
      select: { studentId: true },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    return NextResponse.json({ ok: true, archivedStudentIds: archived.map((x) => String(x.studentId)) });
  } catch (e: any) {
    console.error("/api/tutor/students/archive GET failed", e);
    const details = process.env.NODE_ENV !== "production" ? String(e?.message || e) : undefined;
    return NextResponse.json({ error: "Internal Server Error", details }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const userId = String((session?.user as any)?.id || "");
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tutor = await prisma.tutor.findUnique({ where: { userId } });
    if (!tutor?.id) return NextResponse.json({ error: "Tutor not found" }, { status: 404 });

    const body = await req.json().catch(() => null);
    const studentId = String(body?.studentId || "");
    const action = String(body?.action || "archive");
    if (!studentId) return NextResponse.json({ error: "studentId required" }, { status: 400 });

    if (action === "unarchive") {
      await prisma.archivedStudent.deleteMany({ where: { tutorId: tutor.id, studentId } });
      return NextResponse.json({ ok: true, archived: false });
    }

    await prisma.archivedStudent.upsert({
      where: { tutorId_studentId: { tutorId: tutor.id, studentId } },
      update: {},
      create: { tutorId: tutor.id, studentId },
    });

    return NextResponse.json({ ok: true, archived: true });
  } catch (e: any) {
    console.error("/api/tutor/students/archive POST failed", e);
    const details = process.env.NODE_ENV !== "production" ? String(e?.message || e) : undefined;
    return NextResponse.json({ error: "Internal Server Error", details }, { status: 500 });
  }
}
