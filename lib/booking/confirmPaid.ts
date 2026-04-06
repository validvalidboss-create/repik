import { prisma } from "@/lib/prisma";

export async function confirmBookingPaid(params: { bookingId: string; provider: string }) {
  const bookingId = String(params.bookingId || "");
  const provider = String(params.provider || "").trim() || "unknown";
  if (!bookingId) throw new Error("bookingId required");

  const adminEmail = process.env.ADMIN_EMAIL || "admin@repetitir.local";

  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { tutor: { include: { user: true } }, student: true },
    });
    if (!booking) throw new Error("BOOKING_NOT_FOUND");

    let adminUser = await tx.user.findUnique({ where: { email: adminEmail } });
    if (!adminUser) {
      adminUser = await tx.user.create({
        data: {
          email: adminEmail,
          name: "Адміністрація",
          role: "ADMIN",
          locale: "uk",
        },
      });
    }

    const wasPending = booking.status === "PENDING";

    if (wasPending) {
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: "CONFIRMED", paymentId: provider },
      });
    } else if (!booking.paymentId) {
      await tx.booking.update({
        where: { id: booking.id },
        data: { paymentId: provider },
      });
    }

    const startsAt = new Date(booking.startsAt);
    const dateStr = startsAt.toLocaleDateString(undefined);
    const timeStr = startsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const dur = Number((booking as any).durationMinutes || 0) || 0;
    const studentName = (booking.student as any)?.name || (booking.student as any)?.email || "Студент";

    const paymentPrefix = "✅ Оплата успішна.";
    const existingPaymentMsg = await tx.message.findFirst({
      where: {
        bookingId: booking.id,
        senderId: adminUser.id,
        content: { startsWith: paymentPrefix },
      },
    });
    if (!existingPaymentMsg) {
      await tx.message.create({
        data: {
          bookingId: booking.id,
          senderId: adminUser.id,
          content: `${paymentPrefix} Урок підтверджено на ${dateStr} о ${timeStr} (${dur} хв).`,
          attachments: [],
        },
      });
    }

    const tutorSenderId = String((booking.tutor as any)?.userId || "");
    if (tutorSenderId) {
      const existingTutorMsg = await tx.message.findFirst({ where: { bookingId: booking.id, senderId: tutorSenderId } });
      if (!existingTutorMsg) {
        await tx.message.create({
          data: {
            bookingId: booking.id,
            senderId: tutorSenderId,
            content:
              `Вітаю! Дякую за бронювання.\n` +
              `Урок заплановано на ${dateStr} о ${timeStr} (${dur} хв).\n` +
              `Якщо є питання або побажання до уроку — напишіть тут, будь ласка. (автоматичне повідомлення)`,
            attachments: [],
          },
        });
      }
    }

    const existingStudentHintMsg = await tx.message.findFirst({
      where: {
        bookingId: booking.id,
        senderId: adminUser.id,
        content: { startsWith: "👋 " },
      },
    });
    if (!existingStudentHintMsg) {
      await tx.message.create({
        data: {
          bookingId: booking.id,
          senderId: adminUser.id,
          content: `👋 ${studentName}, ви можете поставити питання або написати побажання до уроку прямо в цьому чаті.`,
          attachments: [],
        },
      });
    }

    return { ok: true };
  });
}
