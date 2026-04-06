import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  const user = session?.user as any;
  const userId = user?.id ? String(user.id) : "";
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ct = req.headers.get("content-type") || "";
  const wantsJson = ct.includes("application/json");
  const body = wantsJson ? await req.json().catch(() => null) : null;
  const form = !wantsJson ? await req.formData().catch(() => null) : null;

  const locale = String((wantsJson ? body?.locale : form?.get("locale")) || "uk").trim() || "uk";
  const message = String((wantsJson ? body?.message : form?.get("message")) || "").trim();
  const context = String((wantsJson ? body?.context : form?.get("context")) || "").trim();
  const attachmentsRaw = wantsJson ? (body as any)?.attachments : form?.getAll?.("attachments");
  const attachments: string[] = (() => {
    if (Array.isArray(attachmentsRaw)) {
      // JSON: attachments is array; FormData: getAll returns array
      return attachmentsRaw.map((x) => String(x || "").trim()).filter(Boolean);
    }
    if (attachmentsRaw == null) return [];
    const s = String(attachmentsRaw || "").trim();
    if (!s) return [];
    try {
      const j = JSON.parse(s);
      if (Array.isArray(j)) return j.map((x) => String(x || "").trim()).filter(Boolean);
    } catch {
      // ignore
    }
    return [s].map((x) => String(x || "").trim()).filter(Boolean);
  })();
  const openOnlyRaw = wantsJson ? (body as any)?.openOnly : form?.get("openOnly");
  const openOnly =
    openOnlyRaw === true ||
    String(openOnlyRaw || "") === "1" ||
    String(openOnlyRaw || "").toLowerCase() === "true";

  const { adminUser, adminTutor } = await ensureAdminTutor();

  const existing = await prisma.booking.findFirst({
    where: {
      tutorId: adminTutor.id,
      studentId: userId,
      status: { in: ["PENDING", "CONFIRMED"] as any },
    },
    orderBy: { createdAt: "desc" },
  });

  let bookingId: string;
  if (existing) {
    bookingId = String(existing.id);
  } else {
    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    endsAt.setMinutes(endsAt.getMinutes() + 50);
    const created = await prisma.booking.create({
      data: {
        studentId: userId,
        tutorId: adminTutor.id,
        startsAt,
        endsAt,
        status: "PENDING" as any,
        priceCents: 0,
        currency: "UAH",
        commissionUSDCents: 0,
      },
    });
    bookingId = String(created.id);

    const alreadyHasMessages = await prisma.message.findFirst({ where: { bookingId } });
    if (!alreadyHasMessages) {
      await prisma.message.create({
        data: {
          bookingId,
          senderId: adminUser.id,
          content: "Вітаємо! Це служба підтримки Repetitir. Опишіть, будь ласка, проблему — ми допоможемо.",
          attachments: [],
        },
      });
    }
  }

  if (!openOnly) {
    const text = (message || "").trim();
    const full = context ? (text ? `${text}\n\n${context}` : context) : text;
    if (full.trim()) {
      await prisma.message.create({
        data: {
          bookingId,
          senderId: userId,
          content: full,
          attachments,
        },
      });
    }
  }

  if (wantsJson) return NextResponse.json({ ok: true, bookingId });

  return NextResponse.redirect(new URL(`/${encodeURIComponent(locale)}/chat/${encodeURIComponent(bookingId)}`, req.url), {
    status: 303,
  });
}
