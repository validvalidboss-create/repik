import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const rateUAH = Number((body as any)?.rateUAH);
  const currency = String((body as any)?.currency || "UAH");

  if (!Number.isFinite(rateUAH) || rateUAH <= 0) {
    return NextResponse.json({ error: "Invalid rate" }, { status: 400 });
  }

  if (currency.length > 8) {
    return NextResponse.json({ error: "Invalid currency" }, { status: 400 });
  }

  const rateCents = Math.floor(rateUAH * 100);
  if (!Number.isFinite(rateCents) || rateCents < 0) {
    return NextResponse.json({ error: "Invalid rate" }, { status: 400 });
  }

  const userId = String(user.id);
  const tutor = await prisma.tutor.findUnique({ where: { userId }, select: { id: true } });
  if (!tutor?.id) return NextResponse.json({ error: "Tutor profile not found" }, { status: 404 });

  const updated = await prisma.tutor.update({
    where: { id: tutor.id },
    data: { rateCents, currency },
    select: { id: true, rateCents: true, currency: true },
  });

  return NextResponse.json({ ok: true, tutor: updated });
}
