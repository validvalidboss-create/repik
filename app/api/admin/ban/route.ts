import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { tutorId, active } = body as { tutorId: string; active: boolean };
  if (!tutorId || typeof active !== "boolean") {
    return NextResponse.json({ error: "Missing tutorId or active" }, { status: 400 });
  }

  if (active) {
    // Ban: create a new active ban record
    const ban = await prisma.ban.create({ data: { tutorId, active: true } });
    return NextResponse.json({ ok: true, ban });
  } else {
    // Unban: deactivate all active bans for this tutor
    const res = await prisma.ban.updateMany({ where: { tutorId, active: true }, data: { active: false } });
    return NextResponse.json({ ok: true, updated: res.count });
  }
}
