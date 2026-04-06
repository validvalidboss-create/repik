import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const status = (url.searchParams.get("status") || "pending").toLowerCase();
  const allowed = ["pending", "active", "rejected", "needs_revision"] as const;
  const effectiveStatus = (allowed as readonly string[]).includes(status) ? status : "pending";

  const where: any = {};
  if (effectiveStatus) {
    where.tracks = { has: `status:${effectiveStatus}` };
  }

  const tutors = await prisma.tutor.findMany({
    where,
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ items: tutors });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const action = (body as any)?.action as string | undefined;
  const tutorId = String((body as any)?.tutorId || "").trim();
  if (!tutorId) {
    return NextResponse.json({ error: "Missing tutorId" }, { status: 400 });
  }

  // Admin-only action: deactivate (remove from search) with reason
  if (action === "deactivate") {
    const reason = String((body as any)?.reason || "").trim();
    if (!reason) {
      return NextResponse.json({ error: "Reason is required" }, { status: 400 });
    }

    const session = await auth();
    const user = session?.user as any;
    const adminEmail = process.env.ADMIN_EMAIL || "admin@repetitir.local";
    if (!user?.email || String(user.email).toLowerCase() !== String(adminEmail).toLowerCase()) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tutor = await prisma.tutor.findUnique({ where: { id: tutorId } });
    if (!tutor) return NextResponse.json({ error: "Tutor not found" }, { status: 404 });

    const currentTracks: string[] = Array.isArray((tutor as any).tracks) ? ((tutor as any).tracks as string[]) : [];
    const baseTracks = currentTracks.filter((t) => !String(t).startsWith("status:"));
    const nextTracks = [...baseTracks, "status:rejected"];

    try {
      const updated = await (prisma as any).tutor.update({
        where: { id: tutorId },
        data: { tracks: nextTracks, moderationNote: reason },
        include: { user: true },
      });
      return NextResponse.json({ ok: true, tutor: updated });
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("Unknown argument `moderationNote`")) {
        const updated = await prisma.tutor.update({
          where: { id: tutorId },
          data: { tracks: nextTracks },
          include: { user: true },
        });
        await prisma.$executeRaw`
          UPDATE "Tutor"
          SET "moderationNote" = ${reason}
          WHERE "id" = ${tutorId}
        `;
        return NextResponse.json({ ok: true, tutor: updated });
      }
      throw e;
    }
  }

  // Destructive admin-only action: reset (delete) application
  if (action === "reset") {
    const session = await auth();
    const user = session?.user as any;
    const adminEmail = process.env.ADMIN_EMAIL || "admin@repetitir.local";
    if (!user?.email || String(user.email).toLowerCase() !== String(adminEmail).toLowerCase()) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tutor = await prisma.tutor.findUnique({ where: { id: tutorId } });
    if (!tutor) return NextResponse.json({ error: "Tutor not found" }, { status: 404 });

    const currentTracks: string[] = Array.isArray((tutor as any).tracks) ? ((tutor as any).tracks as string[]) : [];
    const baseTracks = currentTracks.filter((t) => !String(t).startsWith("status:"));
    const nextTracks = [...baseTracks, "status:draft"];

    await prisma.$transaction([
      prisma.availability.deleteMany({ where: { tutorId } }),
      (prisma as any).tutor.update({
        where: { id: tutorId },
        data: {
          bio: "",
          headline: "",
          rateCents: 0,
          subjects: [],
          videoUrl: null,
          media: [],
          tracks: nextTracks,
          moderationNote: null,
        },
        include: { user: true },
      }),
    ]);

    const updated = await prisma.tutor.findUnique({ where: { id: tutorId }, include: { user: true } });
    return NextResponse.json({ ok: true, tutor: updated });
  }

  const { status, reason } = body as {
    status: "active" | "rejected" | "pending" | "needs_revision";
    reason?: string | null;
  };
  if (!status) {
    return NextResponse.json({ error: "Missing status" }, { status: 400 });
  }

  // Для rejected / needs_revision желательно иметь пояснение
  if ((status === "rejected" || status === "needs_revision") && !reason) {
    return NextResponse.json({ error: "Reason is required for rejected/needs_revision" }, { status: 400 });
  }

  const tutor = (await prisma.tutor.findUnique({ where: { id: tutorId } })) as any;
  if (!tutor) return NextResponse.json({ error: "Tutor not found" }, { status: 404 });

  const currentTracks: string[] = Array.isArray(tutor.tracks) ? (tutor.tracks as string[]) : [];
  const baseTracks = currentTracks.filter((t) => !t.startsWith("status:"));
  const nextTracks = [...baseTracks, `status:${status}`];

  const nextNote =
    status === "active" || status === "pending"
      ? null
      : typeof reason === "string"
        ? reason
        : (tutor.moderationNote as string | null | undefined);

  // Prisma/DB можуть бути ще без поля moderationNote (якщо міграцію не застосовано).
  // Тоді не падаємо 500 — просто оновлюємо статус (tracks).
  try {
    const updated = await (prisma as any).tutor.update({
      where: { id: tutorId },
      data: {
        tracks: nextTracks,
        // active/pending очищают старые нотатки, rejected/needs_revision записывают причину
        moderationNote: nextNote,
      },
      include: { user: true },
    });

    // Дополнительно отправляем причину в чат с администрацией
    if ((status === "rejected" || status === "needs_revision") && typeof nextNote === "string" && nextNote.trim().length > 0) {
      try {
        const adminEmail = process.env.ADMIN_EMAIL || "admin@repetitir.local";
        let adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
        if (!adminUser) {
          adminUser = await prisma.user.create({
            data: { email: adminEmail, name: "Адміністрація", role: "TUTOR", locale: "uk" },
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
              tracks: ["status:active"],
            },
          });
        }
        const targetUserId = String((updated as any)?.userId || "");
        if (targetUserId) {
          let booking = await prisma.booking.findFirst({
            where: {
              tutorId: adminTutor.id,
              studentId: targetUserId,
              status: { in: ["PENDING", "CONFIRMED"] as any },
            },
            orderBy: { createdAt: "desc" },
          });
          if (!booking) {
            const startsAt = new Date();
            const endsAt = new Date(startsAt);
            endsAt.setMinutes(endsAt.getMinutes() + 50);
            booking = await prisma.booking.create({
              data: {
                studentId: targetUserId,
                tutorId: adminTutor.id,
                startsAt,
                endsAt,
                status: "PENDING" as any,
                priceCents: 0,
                currency: "UAH",
                commissionUSDCents: 0,
              },
            });
          }
          await prisma.message.create({
            data: {
              bookingId: booking.id,
              senderId: adminUser.id,
              content: `Повідомлення модерації:\n\n${nextNote}`,
              attachments: [],
            },
          });
        }
      } catch {
        // ignore chat failures
      }
    }

    return NextResponse.json({ ok: true, tutor: updated });
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg.includes("Unknown argument `moderationNote`")) {
      const updated = await prisma.tutor.update({
        where: { id: tutorId },
        data: {
          tracks: nextTracks,
        },
        include: { user: true },
      });

      // Надежный fallback: обновляем колонку напрямую через SQL.
      // Это работает даже если Prisma Client еще не знает про moderationNote.
      await prisma.$executeRaw`
        UPDATE "Tutor"
        SET "moderationNote" = ${nextNote}
        WHERE "id" = ${tutorId}
      `;

      // Дополнительно отправляем причину в чат с администрацией (fallback ветка)
      if ((status === "rejected" || status === "needs_revision") && typeof nextNote === "string" && nextNote.trim().length > 0) {
        try {
          const adminEmail = process.env.ADMIN_EMAIL || "admin@repetitir.local";
          let adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
          if (!adminUser) {
            adminUser = await prisma.user.create({
              data: { email: adminEmail, name: "Адміністрація", role: "TUTOR", locale: "uk" },
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
                tracks: ["status:active"],
              },
            });
          }
          const targetUserId = String((updated as any)?.userId || "");
          if (targetUserId) {
            let booking = await prisma.booking.findFirst({
              where: {
                tutorId: adminTutor.id,
                studentId: targetUserId,
                status: { in: ["PENDING", "CONFIRMED"] as any },
              },
              orderBy: { createdAt: "desc" },
            });
            if (!booking) {
              const startsAt = new Date();
              const endsAt = new Date(startsAt);
              endsAt.setMinutes(endsAt.getMinutes() + 50);
              booking = await prisma.booking.create({
                data: {
                  studentId: targetUserId,
                  tutorId: adminTutor.id,
                  startsAt,
                  endsAt,
                  status: "PENDING" as any,
                  priceCents: 0,
                  currency: "UAH",
                  commissionUSDCents: 0,
                },
              });
            }
            await prisma.message.create({
              data: {
                bookingId: booking.id,
                senderId: adminUser.id,
                content: `Повідомлення модерації:\n\n${nextNote}`,
                attachments: [],
              },
            });
          }
        } catch {
          // ignore chat failures
        }
      }

      return NextResponse.json({ ok: true, tutor: updated });
    }
    throw e;
  }
}
