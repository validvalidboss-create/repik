import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isLocale, type Locale, defaultLocale } from "@/lib/i18n";
import ThreadMoreMenu from "@/components/ThreadMoreMenu";
import LessonMoreMenu from "@/components/LessonMoreMenu";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatListTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function initials(name: string) {
  const s = (name || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "";
  const second = parts.length > 1 ? parts[1]?.[0] || "" : "";
  const out = (first + second).toUpperCase();
  return out || "?";
}

function issueTypeLabel(t: string) {
  switch (String(t || "").toUpperCase()) {
    case "TUTOR_NO_SHOW":
      return "Викладач не прийшов";
    case "STUDENT_COULD_NOT_JOIN":
      return "Не вдалося приєднатись";
    case "TECHNICAL_PROBLEM":
      return "Технічна проблема";
    case "QUALITY_NOT_AS_EXPECTED":
      return "Якість не відповідала очікуванням";
    default:
      return "Інше";
  }
}

export default async function ChatListPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const p = await params;
  const locale: Locale = isLocale(p.locale) ? (p.locale as Locale) : defaultLocale;

  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const session = await auth();
  const me = session?.user as any;
  if (!me?.id) {
    return (
      <main className="container mx-auto px-4 py-12">
        <p className="text-sm text-neutral-600">Увійдіть, щоб переглянути чат.</p>
        <Link href={`/${locale}/sign-in`} className="underline">
          Go to sign in
        </Link>
      </main>
    );
  }

  const userId = String(me.id);
  const role = String(((me as any)?.role || "") as any).toUpperCase();
  const isTutorRole = role === "TUTOR";
  const adminEmail = process.env.ADMIN_EMAIL || "admin@repetitir.local";
  const isAdmin = !!me?.email && String(me.email).toLowerCase() === String(adminEmail).toLowerCase();

  const tabRaw = resolvedSearchParams?.tab;
  const tab = String(Array.isArray(tabRaw) ? tabRaw[0] : tabRaw || "").toLowerCase();
  const activeTab = tab === "greetings" || tab === "inbox" || tab === "all" || tab === "disputes" ? tab : "inbox";

  const issueRaw = resolvedSearchParams?.issue;
  const selectedIssueId = String(Array.isArray(issueRaw) ? issueRaw[0] : issueRaw || "").trim();

  let dbError: string | null = null;

  // Ensure system chat with administration exists so user always has a support thread.
  let ensuredAdminTutorId: string | null = null;
  let ensuredAdminBookingId: string | null = null;
  try {
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
    ensuredAdminTutorId = adminTutor.id;
    const existingAdminChat = await prisma.booking.findFirst({
      where: { studentId: userId, tutorId: adminTutor.id },
      orderBy: { createdAt: "desc" },
    });

    let bookingId: string;
    if (!existingAdminChat) {
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
      bookingId = created.id;
    } else {
      bookingId = existingAdminChat.id;
    }

    ensuredAdminBookingId = bookingId;

    // Welcome message from admin (only once; do not spam).
    const adminWelcomeExists = await prisma.message.findFirst({
      where: { bookingId, senderId: adminUser.id },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    if (!adminWelcomeExists) {
      await prisma.message.create({
        data: {
          bookingId,
          senderId: adminUser.id,
          content:
            "Привіт! Я представник адміністрації Repetitir. Якщо потрібна допомога з анкетою, оплатою або уроками — напиши сюди, ми відповімо якнайшвидше.",
          attachments: [],
        },
      });
    }
  } catch (e: any) {
    // ignore system chat creation failures
  }

  const openDisputes = isAdmin
    ? await (async () => {
        if (activeTab !== "disputes") return [] as any[];
        try {
          return await (prisma as any).lessonIssue.findMany({
            where: { status: "OPEN" },
            include: {
              booking: { include: { student: true, tutor: { include: { user: true } } } },
              reporter: true,
            },
            orderBy: { createdAt: "desc" },
            take: 50,
          });
        } catch (e: any) {
          return [] as any[];
        }
      })()
    : ([] as any[]);

  let asStudent: any[] = [];
  let asTutor: any[] = [];
  if (isAdmin) {
    try {
      if (ensuredAdminTutorId) {
        asStudent = await prisma.booking.findMany({
          where: { tutorId: ensuredAdminTutorId },
          include: {
            tutor: { include: { user: true } },
            student: true,
            messages: { orderBy: { createdAt: "desc" }, take: 10 },
            _count: { select: { messages: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 100,
        });
      }
    } catch (e: any) {
      dbError = e?.message ? String(e.message) : "Database is unavailable";
    }
  } else {
    try {
      [asStudent, asTutor] = await Promise.all([
        prisma.booking.findMany({
          where: { studentId: userId },
          include: {
            tutor: { include: { user: true } },
            student: true,
            messages: { orderBy: { createdAt: "desc" }, take: 1 },
          },
          orderBy: { updatedAt: "desc" },
          take: 50,
        }),
        prisma.booking.findMany({
          where: { tutor: { userId } },
          include: {
            tutor: { include: { user: true } },
            student: true,
            messages: { orderBy: { createdAt: "desc" }, take: 1 },
          },
          orderBy: { updatedAt: "desc" },
          take: 50,
        }),
      ]);
    } catch (e: any) {
      dbError = e?.message ? String(e.message) : "Database is unavailable";
    }
  }

  let items: any[] = [];
  if (isAdmin) {
    const allSupport = [...asStudent];
    const withTab = allSupport.filter((b) => {
      if (activeTab === "all") return true;
      if (activeTab === "disputes") return false;
      const msgCount = Number((b as any)?._count?.messages ?? 0) || 0;
      const last = b.messages?.[0];
      const lastSender = last?.senderId ? String(last.senderId) : "";
      const adminUserSender = String((b as any)?.tutor?.userId || "");
      if (activeTab === "greetings") {
        return true;
      }
      // inbox
      if (msgCount <= 1) return false;
      // user wrote at least once (not necessarily last)
      const hasUserMessage = Array.isArray((b as any)?.messages)
        ? (b as any).messages.some((m: any) => {
            const sid = m?.senderId ? String(m.senderId) : "";
            return sid && adminUserSender && sid !== adminUserSender;
          })
        : false;
      // fallback to last message heuristic if messages missing
      return hasUserMessage || (lastSender && adminUserSender && lastSender !== adminUserSender);
    });
    items = withTab.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } else {
    // Deduplicate: one chat per counterpart (tutor/student), pick the most recently updated booking.
    const map = new Map<string, (typeof asStudent)[number]>();
    const all = [...asStudent, ...asTutor];
    for (const b of all) {
      const isStudent = b.studentId === userId;
      const counterpartKey = isStudent
        ? `tutor:${String(b.tutorId)}`
        : `student:${String((b as any)?.studentId || "")}`;

      const prev = map.get(counterpartKey);
      if (!prev) {
        map.set(counterpartKey, b);
        continue;
      }
      const prevTs = new Date((prev as any).updatedAt).getTime();
      const curTs = new Date((b as any).updatedAt).getTime();
      if (curTs > prevTs) map.set(counterpartKey, b);
    }

    // Force-include admin chat in the list (support thread)
    if (ensuredAdminTutorId) {
      try {
        const adminBooking = await prisma.booking.findFirst({
          where: { studentId: userId, tutorId: ensuredAdminTutorId },
          include: {
            tutor: { include: { user: true } },
            student: true,
            messages: { orderBy: { createdAt: "desc" }, take: 1 },
          },
          orderBy: { createdAt: "desc" },
        });
        if (adminBooking) map.set(`tutor:${String(adminBooking.tutorId)}`, adminBooking as any);
      } catch (e: any) {
        // ignore
      }
    }
    items = Array.from(map.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }

  const viewItems = items.map((b) => {
    const last = b.messages?.[0];
    const isStudent = b.studentId === userId;
    const isAdminChat =
      !isAdmin &&
      isStudent &&
      (String(b?.tutor?.user?.email || "").toLowerCase() === String(adminEmail).toLowerCase() ||
        String(b?.tutor?.user?.name || "") === "Адміністрація");
    const title = isAdmin
      ? b.student?.name || b.student?.email || "User"
      : isStudent
        ? b.tutor?.user?.name || b.tutor?.user?.email || "Tutor"
        : b.student?.name || b.student?.email || "Student";
    const avatarUrl = isAdmin
      ? (b.student as any)?.image
      : isStudent
        ? (b.tutor?.user as any)?.image
        : (b.student as any)?.image;
    const preview = last?.content || "";
    const time = last?.createdAt ? formatListTime(new Date(last.createdAt)) : "";
    return {
      id: b.id,
      tutorId: isStudent ? String(b.tutorId) : null,
      isStudent,
      isAdminChat,
      title,
      avatarUrl: typeof avatarUrl === "string" && avatarUrl.trim().length > 0 ? avatarUrl : null,
      preview,
      time,
      status: String(b.status).toLowerCase(),
    };
  });

  const orderedViewItems = !isAdmin
    ? (() => {
        const adminPinned = viewItems.find((x) => x.isAdminChat);
        const rest = viewItems.filter((x) => !x.isAdminChat);
        return adminPinned ? [adminPinned, ...rest] : rest;
      })()
    : viewItems;

  const selectedDispute =
    activeTab === "disputes" && selectedIssueId
      ? openDisputes.find((d: any) => String(d?.id) === String(selectedIssueId))
      : (openDisputes[0] as any) || null;

  function fmtDT(x: any) {
    if (!x) return "—";
    try {
      return new Date(String(x)).toLocaleString();
    } catch {
      return String(x);
    }
  }

  function durMin(a: any, b: any) {
    if (!a || !b) return null;
    const ta = new Date(String(a)).getTime();
    const tb = new Date(String(b)).getTime();
    if (!Number.isFinite(ta) || !Number.isFinite(tb) || tb <= ta) return null;
    return Math.max(1, Math.round((tb - ta) / 60000));
  }

  return (
    <main className="h-[calc(100vh-56px)] overflow-hidden">
      {dbError ? (
        <div className="m-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
          База даних тимчасово недоступна. Спробуйте оновити сторінку або перезапустити dev-сервер.
        </div>
      ) : null}
      <div className="h-full min-h-0 grid grid-cols-[320px_minmax(0,1fr)]">
        <aside className="min-h-0 border-r bg-white overflow-y-auto">
          <div className="px-4 py-4 border-b">
            <h1 className="text-lg font-semibold">Повідомлення</h1>
            {isAdmin ? (
              <div className="mt-3 border-b border-neutral-200">
                <div className="flex items-center gap-6 text-sm">
                  <Link
                    prefetch={false}
                    href={`/${locale}/chat?tab=greetings`}
                    className={`py-3 font-semibold ${activeTab === "greetings" ? "text-neutral-900 border-b-2 border-neutral-900" : "text-neutral-500"}`}
                  >
                    Привітання
                  </Link>
                  <Link
                    prefetch={false}
                    href={`/${locale}/chat?tab=inbox`}
                    className={`py-3 font-semibold ${activeTab === "inbox" ? "text-neutral-900 border-b-2 border-neutral-900" : "text-neutral-500"}`}
                  >
                    Вхідні
                  </Link>
                  <Link
                    prefetch={false}
                    href={`/${locale}/chat?tab=all`}
                    className={`py-3 font-semibold ${activeTab === "all" ? "text-neutral-900 border-b-2 border-neutral-900" : "text-neutral-500"}`}
                  >
                    Усі
                  </Link>
                  <Link
                    prefetch={false}
                    href={`/${locale}/chat?tab=disputes`}
                    className={`py-3 font-semibold ${activeTab === "disputes" ? "text-neutral-900 border-b-2 border-neutral-900" : "text-neutral-500"}`}
                  >
                    Спори
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          {isAdmin && activeTab === "disputes" ? (
            <div className="py-2">
              {openDisputes.length === 0 ? (
                <div className="px-4 py-4 text-sm text-neutral-600">Немає відкритих спорів.</div>
              ) : (
                openDisputes.map((d: any) => {
                  const booking = d?.booking;
                  const student = booking?.student;
                  const tutorUser = booking?.tutor?.user;
                  const studentLabel = student?.name || student?.email || "Студент";
                  const tutorLabel = tutorUser?.name || tutorUser?.email || "Викладач";
                  const active = String(d?.id) === String(selectedDispute?.id);
                  return (
                    <Link
                      key={String(d.id)}
                      prefetch={false}
                      href={`/${locale}/chat?tab=disputes&issue=${encodeURIComponent(String(d.id))}`}
                      className={
                        "block px-4 py-3 border-b hover:bg-neutral-50 " +
                        (active ? "bg-neutral-50" : "")
                      }
                    >
                      <div className="text-sm font-semibold text-neutral-900 truncate">{issueTypeLabel(String(d.type || ""))}</div>
                      <div className="mt-0.5 text-xs text-neutral-500 truncate">{studentLabel} • {tutorLabel}</div>
                      <div className="mt-0.5 text-[11px] text-neutral-400">{fmtDT(d.createdAt)}</div>
                    </Link>
                  );
                })
              )}
            </div>
          ) : orderedViewItems.length === 0 ? (
            <div className="px-4 py-4 text-sm text-neutral-600">Поки що немає діалогів.</div>
          ) : (
            <div>
              {orderedViewItems.map((it) => (
                <div key={it.id} className="group flex items-start gap-2 px-4 py-3 border-b last:border-b-0 hover:bg-neutral-50">
                  <Link
                    prefetch={false}
                    href={`/${locale}/chat/${encodeURIComponent(it.id)}${isAdmin ? `?tab=${encodeURIComponent(activeTab)}` : ""}`}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    {it.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.avatarUrl}
                        alt={it.title}
                        className="h-10 w-10 rounded-full object-cover bg-neutral-200 flex-shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-neutral-200 flex-shrink-0 flex items-center justify-center text-xs font-medium text-neutral-700">
                        {initials(it.title)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium truncate">{it.title}</div>
                        <div className="text-[11px] text-neutral-500 flex-shrink-0">{it.time}</div>
                      </div>
                      <div className="text-sm text-neutral-600 truncate">{it.preview}</div>
                    </div>
                  </Link>

                  {!it.isAdminChat && it.isStudent ? (
                    <div className="w-8 flex-shrink-0 flex justify-end">
                      <ThreadMoreMenu
                        locale={locale}
                        bookingId={String(it.id)}
                        tutorId={it.tutorId}
                        variant={it.status === "CONFIRMED" || it.status === "COMPLETED" ? "post_lesson" : "trial"}
                      />
                    </div>
                  ) : !it.isAdminChat && !it.isStudent && isTutorRole ? (
                    <div className="w-8 flex-shrink-0 flex justify-end">
                      <LessonMoreMenu locale={String(locale)} bookingId={String(it.id)} tutorId={null} />
                    </div>
                  ) : (
                    <div className="w-8 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}
        </aside>

        <section className="bg-white flex flex-col min-h-0 min-w-0">
          {isAdmin && activeTab === "disputes" ? (
            <div className="p-6">
              {selectedDispute ? (
                (() => {
                  const booking = (selectedDispute as any)?.booking;
                  const student = booking?.student;
                  const tutorUser = booking?.tutor?.user;
                  const studentLabel = student?.name || student?.email || "Студент";
                  const tutorLabel = tutorUser?.name || tutorUser?.email || "Викладач";
                  const factM = durMin(booking?.startedAt, booking?.endedAt);
                  return (
                    <div className="max-w-2xl space-y-4">
                      <div className="text-lg font-semibold">{issueTypeLabel(String((selectedDispute as any)?.type || ""))}</div>
                      <div className="text-sm text-neutral-600">Створено: {fmtDT((selectedDispute as any)?.createdAt)}</div>
                      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
                        <div className="font-semibold text-neutral-900">Учасники</div>
                        <div className="mt-2 text-neutral-700">Учень: {studentLabel}</div>
                        <div className="text-neutral-700">Викладач: {tutorLabel}</div>
                      </div>
                      <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm space-y-1">
                        <div className="font-semibold text-neutral-900">Час</div>
                        <div className="text-neutral-700">План: {fmtDT(booking?.startsAt)} – {fmtDT(booking?.endsAt)}</div>
                        <div className="text-neutral-700">Факт: {fmtDT(booking?.startedAt)} – {fmtDT(booking?.endedAt)}{typeof factM === "number" ? ` (≈ ${factM} хв)` : ""}</div>
                      </div>
                      {(selectedDispute as any)?.message ? (
                        <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm whitespace-pre-wrap">
                          {(selectedDispute as any).message}
                        </div>
                      ) : null}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <form action="/api/admin/support-chat" method="POST">
                          <input type="hidden" name="targetUserId" value={String(booking?.studentId || "")} />
                          <input type="hidden" name="locale" value={String(locale)} />
                          <input type="hidden" name="tab" value="disputes" />
                          <button type="submit" className="w-full inline-flex h-10 items-center justify-center rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-neutral-800">
                            Написати учню
                          </button>
                        </form>
                        <form action="/api/admin/support-chat" method="POST">
                          <input type="hidden" name="targetUserId" value={String(booking?.tutor?.userId || "")} />
                          <input type="hidden" name="locale" value={String(locale)} />
                          <input type="hidden" name="tab" value="disputes" />
                          <button type="submit" className="w-full inline-flex h-10 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50">
                            Написати викладачу
                          </button>
                        </form>
                        <Link prefetch={false} href={`/${locale}/lesson/${encodeURIComponent(String(booking?.id || ""))}`} className="w-full inline-flex h-10 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50">
                          Відкрити урок
                        </Link>
                        <Link prefetch={false} href={`/${locale}/admin/issues`} className="w-full inline-flex h-10 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50">
                          Відкрити спір
                        </Link>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="text-sm text-neutral-600">Оберіть спір зліва.</div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-neutral-600">Виберіть репетитора, щоб почати бесіду</div>
          )}
        </section>
      </div>
    </main>
  );
}
