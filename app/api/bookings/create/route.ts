import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const MIN_LEAD_HOURS = 24;

function decodeRate30Cents(tracks: unknown): number | null {
  const list: string[] = Array.isArray(tracks) ? (tracks as any[]).map((t) => String(t)) : [];
  const raw = list.find((t) => t.startsWith("rate30:"));
  if (!raw) return null;
  const n = Number(raw.replace("rate30:", "").trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function decodeFreeFirstLesson(tracks: unknown): boolean {
  const list: string[] = Array.isArray(tracks) ? (tracks as any[]).map((t) => String(t)) : [];
  const raw = list.find((t) => t.startsWith("freefirst:"));
  if (!raw) return false;
  return raw.includes("true");
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  const userId = user?.id ? String(user.id || "") : "";
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = String((user?.role || "") as any).toUpperCase();
  if (role === "TUTOR") {
    return NextResponse.json({ error: "Only students can book lessons" }, { status: 403 });
  }

  const adminEmail = process.env.ADMIN_EMAIL || "admin@repetitir.local";

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { tutorId, startsAtISO, durationMin = 60, useCredits = false, freeFirst = false, transferKey } = body as {
    tutorId: string;
    startsAtISO: string;
    durationMin?: number;
    useCredits?: boolean;
    freeFirst?: boolean;
    transferKey?: string;
  };

  if (!tutorId || !startsAtISO) {
    return NextResponse.json({ error: "Missing tutorId or startsAtISO" }, { status: 400 });
  }

  const tutor = await prisma.tutor.findUnique({ where: { id: tutorId } });
  if (!tutor) return NextResponse.json({ error: "Tutor not found" }, { status: 404 });

  const normalizedDurationMin = durationMin === 30 || durationMin === 60 ? durationMin : 60;

  const freeFirstFlow = !!freeFirst;

  const freeFirstEnabled = decodeFreeFirstLesson((tutor as any).tracks);

  const tb = (prisma as any)?.trialBalance;

  if (normalizedDurationMin === 30) {
    const existingTrial = await prisma.booking.findFirst({
      where: {
        studentId: userId,
        tutorId: tutor.id,
        durationMinutes: 30,
        status: { in: ["CONFIRMED", "COMPLETED", "MISSED_TRIAL"] as any },
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });
    if (existingTrial) {
      return NextResponse.json(
        {
          ok: false,
          error: "Пробний урок з цим викладачем можна забронювати лише один раз",
        },
        { status: 400 },
      );
    }
  }

  const basePriceCents = (() => {
    if (normalizedDurationMin === 30) {
      const r30 = decodeRate30Cents((tutor as any).tracks);
      if (typeof r30 === "number" && Number.isFinite(r30) && r30 >= 0) return r30;
      return Math.round((Number(tutor.rateCents || 0) || 0) / 2);
    }
    return Number(tutor.rateCents || 0) || 0;
  })();

  const studentFeeCents = Math.round(basePriceCents * 0.02);
  const totalPriceCents = basePriceCents + studentFeeCents;

  const startsAt = new Date(startsAtISO);
  if (isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const effectiveLeadHours = freeFirstFlow && normalizedDurationMin === 30 ? 1 : MIN_LEAD_HOURS;
  const minStart = Date.now() + effectiveLeadHours * 60 * 60 * 1000;
  if (startsAt.getTime() < minStart) {
    return NextResponse.json(
      { ok: false, error: `Урок можна забронювати щонайменше за ${effectiveLeadHours} годин до початку` },
      { status: 400 }
    );
  }
  const endsAt = new Date(startsAt.getTime() + normalizedDurationMin * 60 * 1000);

  try {
    const booking = await prisma.$transaction(async (tx) => {
      // Prevent concurrent double-spend / double-booking (two parallel create requests)
      // Scope: student schedule (across ALL tutors) + student+tutor (credits tied to this pair)
      try {
        const scheduleLockKey = `${userId}:schedule`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${scheduleLockKey}))`;
        const lockKey = `${userId}:${String(tutor.id)}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
      } catch {
        // ignore (non-Postgres / limited environments)
      }

      // Hard guard: prevent time overlap with ANY existing booking of this student
      // Overlap condition: existing.startsAt < new.endsAt && existing.endsAt > new.startsAt
      const conflict = await tx.booking.findFirst({
        where: {
          studentId: userId,
          status: { notIn: ["CANCELED", "REFUNDED"] as any },
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      });
      if (conflict) {
        throw new Error("TIME_CONFLICT");
      }

      const existing = await tx.booking.findFirst({
        where: {
          studentId: userId,
          tutorId: tutor.id,
          startsAt,
          durationMinutes: normalizedDurationMin,
          status: { notIn: ["CANCELED", "REFUNDED"] as any },
        },
        orderBy: { createdAt: "desc" },
      });
      if (existing) return existing;

      if (freeFirstFlow) {
        if (!freeFirstEnabled) {
          throw new Error("FREE_FIRST_NOT_ENABLED");
        }
        if (normalizedDurationMin !== 30) {
          throw new Error("FREE_FIRST_ONLY_30");
        }

        const txTb = (tx as any)?.trialBalance;
        if (!txTb?.upsert || !txTb?.update) {
          throw new Error("TRIAL_BALANCE_NOT_CONFIGURED");
        }

        await txTb.upsert({
          where: { studentId: userId },
          create: { studentId: userId, credits: 3 },
          update: {},
          select: { credits: true },
        });

        const tbState = await txTb.findUnique({ where: { studentId: userId }, select: { credits: true } }).catch(() => null);
        const tbCredits = Math.max(0, Math.floor(Number((tbState as any)?.credits ?? 0) || 0));
        const scheduledTrialCount = await tx.booking
          .count({
            where: {
              studentId: userId,
              paymentId: "free_first",
              status: "CONFIRMED" as any,
              startsAt: { gt: new Date() },
            },
          })
          .catch(() => 0);
        if (scheduledTrialCount >= tbCredits) {
          throw new Error("NO_TRIAL_CREDITS");
        }

        const booking = await tx.booking.create({
          data: {
            studentId: userId,
            tutorId: tutor.id,
            startsAt,
            endsAt,
            priceCents: 0,
            currency: tutor.currency,
            commissionUSDCents: 0,
            paymentId: "free_first",
            status: "CONFIRMED",
            durationMinutes: 30,
          },
        });

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

        const dateStr = startsAt.toLocaleDateString(undefined);
        const timeStr = startsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        await tx.message.create({
          data: {
            bookingId: booking.id,
            senderId: adminUser.id,
            content: `✅ Нове бронювання. Урок підтверджено на ${dateStr} о ${timeStr} (${normalizedDurationMin} хв).`,
            attachments: [],
          },
        });

        const tutorSenderId = String((tutor as any)?.userId || "");
        if (tutorSenderId) {
          const existingTutorMsg = await tx.message.findFirst({ where: { bookingId: booking.id, senderId: tutorSenderId } });
          if (!existingTutorMsg) {
            await tx.message.create({
              data: {
                bookingId: booking.id,
                senderId: tutorSenderId,
                content:
                  `Вітаю! Дякую за бронювання.\n` +
                  `Урок заплановано на ${dateStr} о ${timeStr} (${normalizedDurationMin} хв).\n` +
                  `Якщо є питання або побажання до уроку — напишіть тут, будь ласка. (автоматичне повідомлення)`,
                attachments: [],
              },
            });
          }
        }

        return booking;
      }

      if (useCredits) {
        const lb = (tx as any)?.lessonBalance;
        if (lb?.updateMany) {
          const lbState = await lb
            .findUnique({ where: { studentId_tutorId: { studentId: userId, tutorId: String(tutor.id) } }, select: { credits: true } })
            .catch(() => null);
          const lbCredits = Math.max(0, Math.floor(Number((lbState as any)?.credits ?? 0) || 0));
          const scheduledCreditsCount = await tx.booking
            .count({
              where: {
                studentId: userId,
                tutorId: String(tutor.id),
                status: "CONFIRMED" as any,
                startsAt: { gt: new Date() },
                OR: [
                  { paymentId: "credits" },
                  { paymentId: "credits_dev" },
                  { paymentId: { startsWith: "credits_transfer:" } as any },
                ],
              },
            })
            .catch(() => 0);
          if (scheduledCreditsCount >= lbCredits) {
            throw new Error("NO_CREDITS");
          }
          const created = await tx.booking.create({
            data: {
              studentId: userId,
              tutorId: tutor.id,
              startsAt,
              endsAt,
              priceCents: 0,
              currency: tutor.currency,
              status: "CONFIRMED",
              paymentId: transferKey ? `credits_transfer:${transferKey}` : "credits",
              durationMinutes: normalizedDurationMin,
            },
          });

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

          const dateStr = startsAt.toLocaleDateString(undefined);
          const timeStr = startsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          await tx.message.create({
            data: {
              bookingId: created.id,
              senderId: adminUser.id,
              content: `✅ Нове бронювання. Урок підтверджено на ${dateStr} о ${timeStr} (${normalizedDurationMin} хв).`,
              attachments: [],
            },
          });

          const tutorSenderId = String((tutor as any)?.userId || "");
          if (tutorSenderId) {
            const existingTutorMsg = await tx.message.findFirst({ where: { bookingId: created.id, senderId: tutorSenderId } });
            if (!existingTutorMsg) {
              await tx.message.create({
                data: {
                  bookingId: created.id,
                  senderId: tutorSenderId,
                  content:
                    `Вітаю! Дякую за бронювання.\n` +
                    `Урок заплановано на ${dateStr} о ${timeStr} (${normalizedDurationMin} хв).\n` +
                    `Якщо є питання або побажання до уроку — напишіть тут, будь ласка. (автоматичне повідомлення)`,
                  attachments: [],
                },
              });
            }
          }

          return created;
        } else if (process.env.NODE_ENV !== "production") {
          const created = await tx.booking.create({
            data: {
              studentId: userId,
              tutorId: tutor.id,
              startsAt,
              endsAt,
              priceCents: 0,
              currency: tutor.currency,
              status: "CONFIRMED",
              paymentId: "credits_dev",
              durationMinutes: normalizedDurationMin,
            },
          });

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

          const dateStr = startsAt.toLocaleDateString(undefined);
          const timeStr = startsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          await tx.message.create({
            data: {
              bookingId: created.id,
              senderId: adminUser.id,
              content: `✅ Нове бронювання (DEV). Урок підтверджено на ${dateStr} о ${timeStr} (${normalizedDurationMin} хв).`,
              attachments: [],
            },
          });

          const tutorSenderId = String((tutor as any)?.userId || "");
          if (tutorSenderId) {
            const existingTutorMsg = await tx.message.findFirst({ where: { bookingId: created.id, senderId: tutorSenderId } });
            if (!existingTutorMsg) {
              await tx.message.create({
                data: {
                  bookingId: created.id,
                  senderId: tutorSenderId,
                  content:
                    `Вітаю! Дякую за бронювання.\n` +
                    `Урок заплановано на ${dateStr} о ${timeStr} (${normalizedDurationMin} хв).\n` +
                    `Якщо є питання або побажання до уроку — напишіть тут, будь ласка. (автоматичне повідомлення)`,
                  attachments: [],
                },
              });
            }
          }

          return created;
        }
      }

      const created = await tx.booking.create({
        data: {
          studentId: userId,
          tutorId: tutor.id,
          startsAt,
          endsAt,
          priceCents: totalPriceCents,
          currency: tutor.currency,
          status: "PENDING",
          durationMinutes: normalizedDurationMin,
        },
      });

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

      const dateStr = startsAt.toLocaleDateString(undefined);
      const timeStr = startsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      await tx.message.create({
        data: {
          bookingId: created.id,
          senderId: adminUser.id,
          content: `🆕 Нове бронювання. Урок заплановано на ${dateStr} о ${timeStr} (${normalizedDurationMin} хв). Очікуємо оплату від студента.`,
          attachments: [],
        },
      });

      const tutorSenderId = String((tutor as any)?.userId || "");
      if (tutorSenderId) {
        const existingTutorMsg = await tx.message.findFirst({ where: { bookingId: created.id, senderId: tutorSenderId } });
        if (!existingTutorMsg) {
          await tx.message.create({
            data: {
              bookingId: created.id,
              senderId: tutorSenderId,
              content:
                `Вітаю! Дякую за бронювання.\n` +
                `Урок заплановано на ${dateStr} о ${timeStr} (${normalizedDurationMin} хв).\n` +
                `Якщо є питання або побажання до уроку — напишіть тут, будь ласка. (автоматичне повідомлення)`,
              attachments: [],
            },
          });
        }
      }

      return created;
    });

    return NextResponse.json({ ok: true, booking });
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : "Booking create failed";
    if (msg === "TIME_CONFLICT") {
      return NextResponse.json(
        {
          ok: false,
          error: "У вас вже є інший урок на цей час. Оберіть інший слот.",
        },
        { status: 400 },
      );
    }
    if (msg === "NO_CREDITS") {
      return NextResponse.json({ ok: false, error: "Недостатньо уроків на балансі" }, { status: 400 });
    }
    if (msg === "NO_TRIAL_CREDITS") {
      return NextResponse.json({ ok: false, error: "Недостатньо пробних уроків" }, { status: 400 });
    }
    if (msg === "FREE_FIRST_NOT_ENABLED") {
      return NextResponse.json({ ok: false, error: "Пробний урок недоступний для цього викладача" }, { status: 400 });
    }
    if (msg === "FREE_FIRST_ONLY_30") {
      return NextResponse.json({ ok: false, error: "Пробний урок доступний лише на 30 хв" }, { status: 400 });
    }
    if (msg === "TRIAL_BALANCE_NOT_CONFIGURED") {
      return NextResponse.json({ ok: false, error: "Trial balance is not configured" }, { status: 500 });
    }
    return NextResponse.json({ ok: false, error: "Не вдалося створити урок" }, { status: 500 });
  }
}
