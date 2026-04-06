import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const userId = String((session?.user as any)?.id || "");
    if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    const tutorId = String(body?.tutorId || "").trim();
    const paused = !!body?.paused;

    if (!tutorId) return NextResponse.json({ ok: false, error: "tutorId required" }, { status: 400 });

    const updated = await (prisma as any).lessonBalance.updateMany({
      where: { studentId: userId, tutorId },
      data: { paused },
    });

    if (!updated?.count) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, tutorId, paused });
  } catch (e: any) {
    const details = process.env.NODE_ENV !== "production" ? String(e?.message || e) : undefined;
    return NextResponse.json({ ok: false, error: "Internal Server Error", details }, { status: 500 });
  }
}
