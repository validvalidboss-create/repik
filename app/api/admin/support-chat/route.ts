import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensureAdminTutor() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@repetitir.local";
  let adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: { email: adminEmail, name: "Адміністрація", role: "ADMIN", locale: "uk" },
    });
  }

  let adminTutor = await prisma.tutor.findUnique({ where: { userId: adminUser.id } });
  if (!adminTutor) {
    adminTutor = await prisma.tutor.create({
      data: {
        userId: adminUser.id,
        bio: "",
        headline: "",
        rateCents: 0,
        currency: "UAH",
        languages: [adminUser.locale || "uk"],
        subjects: ["support"],
        tracks: ["status:system"],
      },
    });
  }

  return { adminUser, adminTutor };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const viewer = session?.user as any;
  const adminEmail = process.env.ADMIN_EMAIL || "admin@repetitir.local";
  if (!viewer?.email || String(viewer.email).toLowerCase() !== String(adminEmail).toLowerCase()) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const ct = req.headers.get("content-type") || "";
  const wantsJson = ct.includes("application/json");
  const body = wantsJson ? await req.json().catch(() => null) : null;
  const form = !wantsJson ? await req.formData().catch(() => null) : null;
  const targetUserId = String((wantsJson ? body?.targetUserId : form?.get("targetUserId")) || "").trim();
  const locale = String((wantsJson ? body?.locale : form?.get("locale")) || "").trim() || "uk";
  const tab = String((wantsJson ? body?.tab : form?.get("tab")) || "").trim();

  if (!targetUserId) {
    if (wantsJson) return NextResponse.json({ ok: false, error: "targetUserId required" }, { status: 400 });
    return NextResponse.redirect(new URL(`/${encodeURIComponent(locale)}/chat`, req.url));
  }

  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!targetUser) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

  const { adminUser, adminTutor } = await ensureAdminTutor();

  const existing = await prisma.booking.findFirst({
    where: {
      tutorId: adminTutor.id,
      studentId: targetUser.id,
      status: { in: ["PENDING", "CONFIRMED"] as any },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) return NextResponse.json({ ok: true, bookingId: existing.id });

  const startsAt = new Date();
  const endsAt = new Date(startsAt);
  endsAt.setMinutes(endsAt.getMinutes() + 50);

  const booking = await prisma.booking.create({
    data: {
      studentId: targetUser.id,
      tutorId: adminTutor.id,
      startsAt,
      endsAt,
      status: "PENDING" as any,
      priceCents: 0,
      currency: "UAH",
      commissionUSDCents: 0,
    },
  });

  // Optional: first admin message
  const alreadyHasMessages = await prisma.message.findFirst({ where: { bookingId: booking.id } });
  if (!alreadyHasMessages) {
    await prisma.message.create({
      data: {
        bookingId: booking.id,
        senderId: adminUser.id,
        content: "Вітаємо! Це служба підтримки Repetitir. Уточнимо деталі щодо вашого звернення.",
        attachments: [],
      },
    });
  }

  if (wantsJson) return NextResponse.json({ ok: true, bookingId: booking.id });

  const qs = tab ? `?tab=${encodeURIComponent(tab)}` : "";
  return NextResponse.redirect(new URL(`/${encodeURIComponent(locale)}/chat/${encodeURIComponent(booking.id)}${qs}`, req.url));
}
