import { getMessages } from "@/lib/messages";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isLocale, type Locale, defaultLocale } from "@/lib/i18n";
import ContinueLessonsButton from "@/components/ContinueLessonsButton";
import LessonMoreMenu from "@/components/LessonMoreMenu";
import SubscriptionMoreMenu from "@/components/SubscriptionMoreMenu";
import SubscriptionReschedulePicker from "@/components/SubscriptionReschedulePicker";
import ReviewModalButton from "@/components/ReviewModalButton";
import CreditsTransferModal from "@/components/CreditsTransferModal";
import StudentMoreMenu from "@/components/StudentMoreMenu";
import TutorWeekScheduleGrid from "@/components/TutorWeekScheduleGrid";
import StudentWeekScheduleGrid from "@/components/StudentWeekScheduleGrid";
import PayoutSupportCTA from "@/components/PayoutSupportCTA";
import PayOrTransferFlow from "@/components/PayOrTransferFlow";
import ScheduleTutorPickerButton from "@/components/ScheduleTutorPickerButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const locale: Locale = isLocale(resolvedParams.locale) ? (resolvedParams.locale as Locale) : defaultLocale;
  const t = getMessages(locale) as Record<string, string>;

  if (!session?.user) {
    return (
      <main className="container mx-auto px-4 py-16">
        <p className="mb-4">Please sign in to access the dashboard.</p>
        <Link href={`/${locale}/sign-in`} className="underline">Go to sign in</Link>
      </main>
    );
  }

  const userId = String((session.user as any).id);
  const role = String(((session.user as any).role || "") as any).toUpperCase();
  const isTutorRole = role === "TUTOR";
  const noticeRaw = (() => {
    const raw = (resolvedSearchParams as any)?.notice;
    if (!raw) return "";
    if (Array.isArray(raw)) return String(raw[0] || "");
    return String(raw);
  })();
  const purchasedTutorId = (() => {
    const raw = (resolvedSearchParams as any)?.dev_purchased_tutor;
    if (!raw) return "";
    if (Array.isArray(raw)) return String(raw[0] || "");
    return String(raw);
  })();
  const noticeUi = (() => {
    const n = String(noticeRaw || "").trim();
    if (!n) return "";
    if (n === "transfer_ok") return "Уроки успішно переведено";
    if (n === "purchase_ok") return "Уроки успішно куплено";
    if (n === "topup_ok") return "Оплату успішно виконано";
    return n.slice(0, 120);
  })();
  const adminEmail = process.env.ADMIN_EMAIL || "admin@repetitir.local";
  const isAdminUser =
    !!(session.user as any)?.email &&
    String((session.user as any).email).toLowerCase() === String(adminEmail).toLowerCase();
  let dbError: string | null = null;
  let asStudent: any[] = [];
  let asTutor: any[] = [];
  try {
    [asStudent, asTutor] = await Promise.all([
      prisma.booking.findMany({
        where: { studentId: userId },
        include: {
          tutor: { include: { user: true } },
          student: true,
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
          review: true,
        },
        orderBy: { startsAt: "desc" },
        take: 200,
      }),
      prisma.booking.findMany({
        where: { tutor: { userId } },
        include: {
          tutor: { include: { user: true } },
          student: true,
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
          review: true,
        },
        orderBy: { startsAt: "desc" },
        take: 200,
      }),
    ]);

    const AUTO_COMPLETE_HOURS = 72;
    const cutoffMs = Date.now() - AUTO_COMPLETE_HOURS * 60 * 60 * 1000;
    const needsAutoComplete = (b: any) => {
      if (String(b?.status || "") !== "CONFIRMED") return false;
      const endsAtMs = new Date(b?.endsAt).getTime();
      if (!Number.isFinite(endsAtMs)) return false;
      return endsAtMs < cutoffMs;
    };

    const candidate = [...asStudent, ...asTutor].filter(needsAutoComplete);
    const openIssueIds = candidate.length
      ? new Set(
          (
            await (prisma as any).lessonIssue.findMany({
              where: { bookingId: { in: candidate.map((b: any) => String(b.id)) }, status: "OPEN" },
              select: { bookingId: true },
            })
          ).map((x: any) => String(x.bookingId))
        )
      : new Set<string>();

    const toUpdate = candidate.filter((b: any) => !openIssueIds.has(String(b.id)));
    if (toUpdate.length) {
      for (const b of toUpdate) {
        await prisma.booking
          .update({
            where: { id: String(b.id) },
            data: {
              status: "COMPLETED" as any,
              endedAt: (b as any).endedAt ?? b.endsAt,
            },
          })
          .catch(() => null);
      }

      [asStudent, asTutor] = await Promise.all([
        prisma.booking.findMany({
          where: { studentId: userId },
          include: {
            tutor: { include: { user: true } },
            student: true,
            messages: { orderBy: { createdAt: "desc" }, take: 1 },
            review: true,
          },
          orderBy: { startsAt: "desc" },
          take: 200,
        }),
        prisma.booking.findMany({
          where: { tutor: { userId } },
          include: {
            tutor: { include: { user: true } },
            student: true,
            messages: { orderBy: { createdAt: "desc" }, take: 1 },
            review: true,
          },
          orderBy: { startsAt: "desc" },
          take: 200,
        }),
      ]);
    }
  } catch (e: any) {
    dbError = e?.message ? String(e.message) : "Database is unavailable";
  }

  const studentItems = asStudent;
  const tutorItems = asTutor;

  const fmtMoney = (cents: number, currency: string) => `${(Number(cents || 0) / 100).toFixed(0)} ${currency || "UAH"}`;
  const fmtWhen = (d: Date) => new Date(d).toLocaleString();
  const fmtDuration = (ms: number) => {
    const v = Math.max(0, Number(ms) || 0);
    const totalMin = Math.ceil(v / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h <= 0) return `${m} хв`;
    if (m <= 0) return `${h} год`;
    return `${h} год ${m} хв`;
  };
  const fmtDateOnly = (d: Date) => {
    try {
      return new Intl.DateTimeFormat(String(locale), { day: "numeric", month: "long" }).format(new Date(d));
    } catch {
      return new Date(d).toLocaleDateString();
    }
  };
  const capFirst = (s: string) => (s ? s.slice(0, 1).toUpperCase() + s.slice(1) : s);
  const fmtWeekday = (d: Date) => {
    try {
      return capFirst(new Intl.DateTimeFormat(String(locale), { weekday: "long" }).format(new Date(d)));
    } catch {
      return capFirst(new Date(d).toLocaleDateString());
    }
  };
  const fmtDay = (d: Date) => {
    try {
      return new Intl.DateTimeFormat(String(locale), { weekday: "long", day: "numeric", month: "short" }).format(new Date(d));
    } catch {
      return new Date(d).toLocaleDateString();
    }
  };
  const fmtTime = (d: Date) => {
    try {
      return new Intl.DateTimeFormat(String(locale), { hour: "2-digit", minute: "2-digit" }).format(new Date(d));
    } catch {
      return new Date(d).toLocaleTimeString();
    }
  };
  const addMinutes = (d: Date, m: number) => new Date(new Date(d).getTime() + (Number(m || 0) || 0) * 60000);
  const joinButtonLabel = (startsAt: Date, durationMin: number) => {
    const starts = new Date(startsAt);
    const end = addMinutes(starts, Number(durationMin || 60) || 60);
    const ms = starts.getTime() - now.getTime();

    // Within 24 hours: show countdown like Preply: "Приєднатися через …"
    if (ms > 15 * 60 * 1000 && ms <= 24 * 60 * 60 * 1000) {
      const totalMin = Math.ceil(ms / 60000);
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      if (h <= 0) return `Приєднатися через ${m} хв`;
      if (m === 0) return `Приєднатися через ${h} год`;
      return `Приєднатися через ${h} год ${m} хв`;
    }

    // Default state: show the lesson time range on the button
    if (ms > 15 * 60 * 1000) {
      return `${fmtTime(starts)}–${fmtTime(end)}`;
    }

    // <= 15 min to start (or started): join is (or will be) available
    return "Приєднатися до уроку";
  };
  const initials = (name: string) => {
    const parts = String(name || "")
      .split(/\s+/)
      .filter(Boolean);
    const first = parts[0]?.[0] || "";
    const second = parts.length > 1 ? parts[1]?.[0] || "" : "";
    const out = (first + second).toUpperCase();
    return out || "?";
  };
  const lessonLabel = (b: any) => {
    const name = b?.tutor?.user?.name || "Tutor";
    return name;
  };
  const studentLabel = (b: any) => b?.student?.name || b?.student?.email || "Студент";

  const tabRaw = resolvedSearchParams?.tab;
  const tab = Array.isArray(tabRaw) ? tabRaw[0] : tabRaw;
  const activeTabRaw = String(tab || "").toLowerCase();
  const activeTab =
    activeTabRaw === "subscriptions"
      ? isTutorRole
        ? "students"
        : "subscriptions"
      : activeTabRaw === "calendar"
        ? "calendar"
      : activeTabRaw === "schedule"
        ? "schedule"
        : activeTabRaw === "students"
          ? "students"
        : activeTabRaw === "payouts"
          ? "payouts"
          : "lessons";

  const studentsViewRaw = resolvedSearchParams?.students_view;
  const studentsView = String(Array.isArray(studentsViewRaw) ? studentsViewRaw[0] : studentsViewRaw || "current").toLowerCase();
  const studentsViewMode = studentsView === "archived" ? "archived" : "current";

  const devPostTrialRaw = resolvedSearchParams?.dev_post_trial;
  const devPostTrial = (Array.isArray(devPostTrialRaw) ? devPostTrialRaw[0] : devPostTrialRaw) === "1";

  const payoutErrorRaw = resolvedSearchParams?.payout_error;
  const payoutError = String(Array.isArray(payoutErrorRaw) ? payoutErrorRaw[0] : payoutErrorRaw || "").trim();

  const devDemoUpcomingRaw = resolvedSearchParams?.dev_demo_upcoming;
  const devDemoUpcoming =
    process.env.NODE_ENV !== "production" &&
    isAdminUser &&
    (Array.isArray(devDemoUpcomingRaw) ? devDemoUpcomingRaw[0] : devDemoUpcomingRaw) === "1";

  const devPurchasedTutorRaw = resolvedSearchParams?.dev_purchased_tutor;
  const devPurchasedTutor = String(Array.isArray(devPurchasedTutorRaw) ? devPurchasedTutorRaw[0] : devPurchasedTutorRaw || "").trim();
  const devPurchasedRaw = resolvedSearchParams?.dev_purchased;
  const devPurchased = String(Array.isArray(devPurchasedRaw) ? devPurchasedRaw[0] : devPurchasedRaw || "").trim() === "1";

  const transferFromRaw = resolvedSearchParams?.transferFrom;
  const transferToRaw = resolvedSearchParams?.transferTo;
  const transferFromTutorId = String(Array.isArray(transferFromRaw) ? transferFromRaw[0] : transferFromRaw || "").trim();
  const transferToTutorId = String(Array.isArray(transferToRaw) ? transferToRaw[0] : transferToRaw || "").trim();

  const allLessons = isTutorRole
    ? tutorItems.map((b: any) => ({ ...b, __role: "tutor" as const }))
    : studentItems.map((b: any) => ({ ...b, __role: "student" as const }));

  const counterpartCards = (() => {
    const map = new Map<
      string,
      {
        key: string;
        kind: "tutor" | "student";
        booking: any;
        name: string;
        subtitle: string;
        profileHref: string;
        chatHref: string;
        ctaHref?: string;
      }
    >();

    const consider = (b: any, role: "student" | "tutor") => {
      const kind: "tutor" | "student" = role === "student" ? "tutor" : "student";
      const name = kind === "tutor" ? lessonLabel(b) : studentLabel(b);
      const subtitle = kind === "tutor" ? String(b?.tutor?.subject || b?.tutor?.headline || "") : "";
      const profileHref =
        kind === "tutor"
          ? `/${locale}/tutors/${encodeURIComponent(String(b?.tutorId || ""))}`
          : `/${locale}/profile`;
      const key = `${kind}:${kind === "tutor" ? String(b?.tutorId || "") : String(b?.studentId || "")}`;

      const prev = map.get(key);
      if (!prev || new Date(b.updatedAt).getTime() > new Date(prev.booking.updatedAt).getTime()) {
        map.set(key, {
          key,
          kind,
          booking: b,
          name,
          subtitle,
          profileHref,
          chatHref: `/${locale}/chat/${encodeURIComponent(String(b.id))}`,
          ctaHref: kind === "tutor" ? `/${locale}/book/${encodeURIComponent(String(b?.tutorId || ""))}` : undefined,
        });
      }
    };

    for (const b of studentItems as any[]) consider(b, "student");
    for (const b of tutorItems as any[]) consider(b, "tutor");

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.booking.updatedAt).getTime() - new Date(a.booking.updatedAt).getTime(),
    );
  })();

  const transferModalData =
    !isTutorRole && transferFromTutorId && transferToTutorId && transferFromTutorId !== transferToTutorId
      ? await (async () => {
          const fromTutor = await prisma.tutor.findUnique({
            where: { id: transferFromTutorId },
            include: { user: true },
          });
          const toTutor = await prisma.tutor.findUnique({
            where: { id: transferToTutorId },
            include: { user: true },
          });
          const fromBal = (prisma as any)?.lessonBalance?.findUnique
            ? await (prisma as any).lessonBalance
                .findUnique({
                  where: { studentId_tutorId: { studentId: userId, tutorId: transferFromTutorId } },
                  select: { credits: true },
                })
                .catch(() => null)
            : null;

          const fromCredits = Math.max(0, Math.floor(Number(fromBal?.credits ?? 0) || 0));
          const transferCredits = Math.min(1, fromCredits);
          if (transferCredits <= 0) return null;

          return {
            fromTutorId: transferFromTutorId,
            toTutorId: transferToTutorId,
            fromTutorName: String(fromTutor?.user?.name || "Викладач"),
            toTutorName: String(toTutor?.user?.name || "Викладач"),
            fromCredits,
            transferCredits,
          };
        })()
      : null;
  const now = new Date();
  const upcoming = allLessons
    .filter((b: any) => {
      if (new Date(b.startsAt).getTime() < now.getTime()) return false;
      const st = String((b as any).status || "");
      if (st !== "CONFIRMED") return false;
      return true;
    })
    .sort((a: any, b: any) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const past = allLessons
    .filter((b: any) => new Date(b.startsAt).getTime() < now.getTime())
    .sort((a: any, b: any) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

  const pastLessons = past.filter((b: any) => {
    const st = String(b?.status || "").toUpperCase();
    return st === "COMPLETED" || st === "CANCELED" || st === "REFUNDED" || st === "MISSED_TRIAL";
  });

  const pastLessonsDeduped = (() => {
    const map = new Map<string, any>();
    for (const b of pastLessons as any[]) {
      const tutorId = String((b as any)?.tutorId || "");
      const sMs = new Date(String((b as any)?.startsAt || "")).getTime();
      const eMs = new Date(String((b as any)?.endsAt || "")).getTime();
      const sMin = Number.isFinite(sMs) ? Math.floor(sMs / 60000) : "";
      const eMin = Number.isFinite(eMs) ? Math.floor(eMs / 60000) : "";
      const dur = String((b as any)?.durationMinutes ?? "");
      const key = `${tutorId}|${sMin}|${eMin}|${dur}`;
      const prev = map.get(key);
      if (!prev) {
        map.set(key, b);
        continue;
      }
      const prevTs = new Date((prev as any)?.updatedAt || (prev as any)?.createdAt || 0).getTime();
      const curTs = new Date((b as any)?.updatedAt || (b as any)?.createdAt || 0).getTime();
      if (!Number.isFinite(prevTs) || curTs > prevTs) map.set(key, b);
    }
    return Array.from(map.values()).sort((a: any, b: any) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  })();

  const upcomingByTutorId = (() => {
    const map = new Map<string, any[]>();
    for (const b of upcoming as any[]) {
      const role = String((b as any)?.__role || "");
      if (role && role !== "student") continue;
      const tutorId = String((b as any)?.tutorId || "");
      if (!tutorId) continue;
      const arr = map.get(tutorId) || [];
      arr.push(b);
      map.set(tutorId, arr);
    }
    for (const [tid, arr] of Array.from(map.entries())) {
      arr.sort((a: any, b: any) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
      map.set(tid, arr);
    }
    return map;
  })();

  const nextUpcomingByTutorId = (() => {
    const out: Record<string, { id: string; startsAt: string } | null> = {};
    for (const [tid, arr] of Array.from(upcomingByTutorId.entries())) {
      const first = Array.isArray(arr) ? arr[0] : null;
      const id = first?.id ? String(first.id) : "";
      const startsAt = first?.startsAt ? String(first.startsAt) : "";
      if (tid && id) out[String(tid)] = { id, startsAt };
    }
    return out;
  })();

  const upcomingCountByTutorId = (() => {
    const out: Record<string, number> = {};
    for (const [tid, arr] of Array.from(upcomingByTutorId.entries())) {
      if (!tid) continue;
      out[String(tid)] = Array.isArray(arr) ? arr.length : 0;
    }
    return out;
  })();

  const subscriptions = await (async () => {
    const lb = (prisma as any)?.lessonBalance;
    if (!lb?.findMany) return [] as any[];
    try {
      return await lb.findMany({
        where: {
          studentId: userId,
          credits: { gt: 0 },
        },
        include: { tutor: { include: { user: true } } },
        orderBy: { updatedAt: "desc" },
        take: 12,
      });
    } catch {
      return [] as any[];
    }
  })();

  const pastByTutorId = (() => {
    const map = new Map<string, any[]>();
    for (const b of pastLessonsDeduped as any[]) {
      const role = String((b as any)?.__role || "");
      if (role && role !== "student") continue;
      const tutorId = String((b as any)?.tutorId || "");
      if (!tutorId) continue;
      const arr = map.get(tutorId) || [];
      arr.push(b);
      map.set(tutorId, arr);
    }
    return map;
  })();

  const subscriptionsEnriched = await (async () => {
    const list = Array.isArray(subscriptions) ? subscriptions : [];
    const tutorIdsFromLessons = new Set<string>();
    for (const [tid] of Array.from(upcomingByTutorId.entries())) tutorIdsFromLessons.add(String(tid));
    for (const [tid] of Array.from(pastByTutorId.entries())) tutorIdsFromLessons.add(String(tid));

    const tutorIds = Array.from(tutorIdsFromLessons.values()).filter(Boolean);
    if (tutorIds.length === 0) return list;

    const tutors = await prisma.tutor.findMany({
      where: { id: { in: tutorIds } },
      include: { user: true },
    });

    const byTutorId = new Map<string, any>();
    for (const s of list) {
      const tid = String((s as any)?.tutorId || (s as any)?.tutor?.id || "");
      if (!tid) continue;
      const prev = byTutorId.get(tid);
      if (!prev) {
        byTutorId.set(tid, s);
        continue;
      }
      const prevCredits = Number((prev as any)?.credits ?? 0) || 0;
      const curCredits = Number((s as any)?.credits ?? 0) || 0;
      if (curCredits > prevCredits) {
        byTutorId.set(tid, s);
        continue;
      }
      const prevUpdated = new Date((prev as any)?.updatedAt || (prev as any)?.createdAt || 0).getTime();
      const curUpdated = new Date((s as any)?.updatedAt || (s as any)?.createdAt || 0).getTime();
      if (!Number.isFinite(prevUpdated) || curUpdated > prevUpdated) byTutorId.set(tid, s);
    }

    for (const t of tutors as any[]) {
      const tid = String(t?.id || "");
      if (!tid) continue;
      if (byTutorId.has(tid)) {
        const cur = byTutorId.get(tid);
        if (!((cur as any)?.tutor?.user)) {
          byTutorId.set(tid, { ...(cur as any), tutor: t });
        }
        continue;
      }
      byTutorId.set(tid, {
        id: `synthetic:${tid}`,
        tutorId: tid,
        credits: 0,
        paused: false,
        createdAt: new Date(0),
        updatedAt: new Date(0),
        tutor: t,
      });
    }

    const getLastActivityTs = (s: any) => {
      const tutorId = String(s?.tutorId || s?.tutor?.id || "");
      const lbTs = Math.max(
        new Date(s?.updatedAt || 0).getTime(),
        new Date(s?.createdAt || 0).getTime(),
      );
      const upcomingList = tutorId ? upcomingByTutorId.get(tutorId) || [] : [];
      const upcomingTs = upcomingList.length
        ? Math.max(
            ...upcomingList.map((b: any) => new Date(String(b?.startsAt || 0)).getTime()).filter((n: any) => Number.isFinite(n)),
          )
        : 0;
      const pastList = tutorId ? pastByTutorId.get(tutorId) || [] : [];
      const pastTs = pastList.length
        ? Math.max(
            ...pastList.map((b: any) => new Date(String(b?.startsAt || 0)).getTime()).filter((n: any) => Number.isFinite(n)),
          )
        : 0;
      return Math.max(0, lbTs, upcomingTs, pastTs);
    };

    return Array.from(byTutorId.values()).sort((a: any, b: any) => getLastActivityTs(b) - getLastActivityTs(a));
  })();

  const subscriptionsFiltered = (() => {
    const list = Array.isArray(subscriptionsEnriched) ? subscriptionsEnriched : [];
    return list.filter((s: any) => {
      const tutorId = String(s?.tutorId || s?.tutor?.id || "");
      const credits = Number(s?.credits ?? 0) || 0;
      if (credits > 0) return true;
      const upcomingList = tutorId ? upcomingByTutorId.get(tutorId) || [] : [];
      if (upcomingList.length > 0) return true;
      const pastList = tutorId ? pastByTutorId.get(tutorId) || [] : [];
      if (pastList.length > 0) return true;
      return false;
    });
  })();

  const totalCredits = Array.isArray(subscriptionsFiltered)
    ? subscriptionsFiltered.reduce((sum, s: any) => sum + (Number(s?.credits ?? 0) || 0), 0)
    : 0;

  const lastStudentTutor = (() => {
    const candidates = (studentItems as any[])
      .filter((b: any) => {
        const isPast = new Date(b.startsAt).getTime() < now.getTime();
        if (!isPast) return false;
        const status = String(b.status || "");
        return ["CONFIRMED", "COMPLETED"].includes(status);
      })
      .sort((a: any, b: any) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
    return candidates[0] || null;
  })();

  const lastTutorCredits = lastStudentTutor?.tutorId
    ? await (async () => {
        const lb = (prisma as any)?.lessonBalance;
        if (!lb?.findUnique) return 0;
        try {
          const r = await lb.findUnique({
            where: { studentId_tutorId: { studentId: userId, tutorId: String(lastStudentTutor.tutorId) } },
            select: { credits: true },
          });
          return Number(r?.credits ?? 0) || 0;
        } catch {
          return 0;
        }
      })()
    : 0;

  const primarySubscription = subscriptionsFiltered?.[0] || null;
  const emptyTutorBookingLike: any = lastStudentTutor
    ? lastStudentTutor
    : primarySubscription
      ? { tutorId: String(primarySubscription.tutorId), tutor: primarySubscription.tutor }
      : null;
  const emptyTutorCredits = lastStudentTutor
    ? Number(lastTutorCredits || 0) || 0
    : Number((primarySubscription as any)?.credits ?? 0) || 0;

  const emptyStateTutorId = String((emptyTutorBookingLike as any)?.tutorId || "");
  const emptyStateTutorCredits = emptyStateTutorId
    ? await (async () => {
        const lb = (prisma as any)?.lessonBalance;
        if (!lb?.findUnique) return 0;
        try {
          const r = await lb.findUnique({
            where: { studentId_tutorId: { studentId: userId, tutorId: String(emptyStateTutorId) } },
            select: { credits: true },
          });
          return Number(r?.credits ?? 0) || 0;
        } catch {
          return 0;
        }
      })()
    : 0;

  const payoutData = isTutorRole
    ? await (async () => {
        const tutor = await prisma.tutor.findUnique({ where: { userId }, select: { id: true, currency: true } });
        if (!tutor?.id) {
          return {
            tutorId: "",
            currency: "UAH",
            availableCents: 0,
            holdCents: 0,
            payoutPendingCents: 0,
            paidCents: 0,
            grossAvailableCents: 0,
            grossHoldCents: 0,
            commissionAvailableCents: 0,
            commissionHoldCents: 0,
            processingLessons: [] as any[],
            creditedLessons: [] as any[],
            holdLessons: [] as any[],
            payouts: [] as any[],
          };
        }

        const HOLD_HOURS = 72;
        const cutoffMs = Date.now() - HOLD_HOURS * 60 * 60 * 1000;

        const USD_TO_UAH = Number(process.env.USD_TO_UAH || "40") || 40;
        const nowMs = Date.now();
        const bookings = await prisma.booking.findMany({
          where: {
            tutorId: tutor.id,
            paymentId: { not: null },
          },
          select: {
            id: true,
            status: true,
            startsAt: true,
            endsAt: true,
            endedAt: true,
            priceCents: true,
            currency: true,
            commissionUSDCents: true,
            student: { select: { name: true, email: true } },
          },
          orderBy: { startsAt: "desc" },
          take: 500,
        });

        const completedSettled = bookings.filter((b: any) => {
          const st = String(b?.status || "").toUpperCase();
          if (st !== "COMPLETED") return false;
          const endMs = new Date((b as any).endedAt || b.endsAt).getTime();
          if (!Number.isFinite(endMs)) return false;
          return endMs < cutoffMs;
        });
        const completedInHold = bookings.filter((b: any) => {
          const st = String(b?.status || "").toUpperCase();
          if (st !== "COMPLETED") return false;
          const endMs = new Date((b as any).endedAt || b.endsAt).getTime();
          if (!Number.isFinite(endMs)) return false;
          return endMs >= cutoffMs;
        });

        const upcomingConfirmed = bookings.filter((b: any) => {
          const st = String(b?.status || "").toUpperCase();
          if (st !== "CONFIRMED") return false;
          const startMs = new Date(b.startsAt).getTime();
          if (!Number.isFinite(startMs)) return false;
          return startMs >= nowMs;
        });

        const sum = (arr: any[]) => (Array.isArray(arr) ? arr.reduce((s, x) => s + (Number(x?.priceCents || 0) || 0), 0) : 0);
        const sumCommissionUAH = (arr: any[]) =>
          (Array.isArray(arr) ? arr.reduce((s, x) => s + (Number((x as any)?.commissionUSDCents || 0) || 0) * USD_TO_UAH, 0) : 0);

        const grossAvailableCents = sum(completedSettled);
        const grossHoldCents = sum(completedInHold);
        const commissionAvailableCents = sumCommissionUAH(completedSettled);
        const commissionHoldCents = sumCommissionUAH(completedInHold);

        const earnedSettledCents = Math.max(0, grossAvailableCents - commissionAvailableCents);
        const holdCents = Math.max(0, grossHoldCents - commissionHoldCents);

        const payouts = await prisma.payout.findMany({
          where: { tutorId: tutor.id },
          orderBy: { createdAt: "desc" },
          take: 50,
        });

        const paidCents = payouts
          .filter((p: any) => String(p?.status || "") === "PAID")
          .reduce((s: number, p: any) => s + (Number(p?.amountCents || 0) || 0), 0);
        const payoutPendingCents = payouts
          .filter((p: any) => String(p?.status || "") === "PENDING")
          .reduce((s: number, p: any) => s + (Number(p?.amountCents || 0) || 0), 0);

        const availableCents = Math.max(
          0,
          earnedSettledCents -
            paidCents -
            payouts
              .filter((p: any) => String(p?.status || "") === "PENDING")
              .reduce((s: number, p: any) => s + (Number(p?.amountCents || 0) || 0), 0)
        );

        return {
          tutorId: tutor.id,
          currency: String(tutor.currency || bookings?.[0]?.currency || "UAH"),
          availableCents,
          holdCents,
          payoutPendingCents,
          paidCents,
          grossAvailableCents,
          grossHoldCents,
          commissionAvailableCents,
          commissionHoldCents,
          processingLessons: [...upcomingConfirmed, ...completedInHold]
            .map((b: any) => {
              const st = String(b?.status || "").toUpperCase();
              const start = new Date(b.startsAt);
              const end = new Date((b as any).endedAt || b.endsAt);
              const availableAt = new Date(end.getTime() + HOLD_HOURS * 60 * 60 * 1000);
              const studentLabel = String(b?.student?.name || b?.student?.email || "Студент");
              const kind = st === "CONFIRMED" ? "upcoming" : "hold";
              return {
                id: String(b.id),
                kind,
                startsAt: start,
                endedAt: end,
                availableAt,
                priceCents: Number(b?.priceCents || 0) || 0,
                currency: String(b?.currency || tutor.currency || "UAH"),
                studentLabel,
              };
            })
            .sort((a: any, b: any) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
            .slice(0, 30),
          creditedLessons: completedSettled
            .map((b: any) => {
              const end = new Date((b as any).endedAt || b.endsAt);
              const availableAt = new Date(end.getTime() + HOLD_HOURS * 60 * 60 * 1000);
              const studentLabel = String(b?.student?.name || b?.student?.email || "Студент");
              return {
                id: String(b.id),
                kind: "credited",
                endedAt: end,
                availableAt,
                priceCents: Number(b?.priceCents || 0) || 0,
                currency: String(b?.currency || tutor.currency || "UAH"),
                studentLabel,
              };
            })
            .sort((a: any, b: any) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime())
            .slice(0, 30),
          holdLessons: completedInHold
            .map((b: any) => {
              const end = new Date((b as any).endedAt || b.endsAt);
              const availableAt = new Date(end.getTime() + HOLD_HOURS * 60 * 60 * 1000);
              const studentLabel = String(b?.student?.name || b?.student?.email || "Студент");
              return {
                id: String(b.id),
                priceCents: Number(b?.priceCents || 0) || 0,
                currency: String(b?.currency || tutor.currency || "UAH"),
                commissionUSDCents: Number((b as any)?.commissionUSDCents || 0) || 0,
                endedAt: end,
                availableAt,
                studentLabel,
              };
            })
            .sort((a: any, b: any) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime())
            .slice(0, 20),
          payouts,
        };
      })()
    : null;

  const demoUpcoming = (() => {
    if (!devDemoUpcoming) return null;
    const starts = new Date();
    starts.setHours(12, 15, 0, 0);
    if (starts.getTime() < now.getTime()) starts.setDate(starts.getDate() + 1);
    const durationMinutes = 60;
    return {
      id: "dev-demo-upcoming",
      startsAt: starts,
      durationMinutes,
      status: "CONFIRMED",
      priceCents: 0,
      currency: "UAH",
      __role: "student" as const,
      tutor: { user: { name: "Кобуто", image: "" }, subject: "" },
    };
  })();

  const joinableLesson = (() => {
    const items = allLessons
      .map((b: any) => {
        const starts = new Date(b.startsAt);
        const status = String(b?.status || "").toUpperCase();
        const durRaw = Number(b.durationMinutes || 0) || 0;
        const endsAt = b?.endsAt ? new Date(b.endsAt) : null;
        const durFromDates = endsAt ? Math.max(0, Math.round((endsAt.getTime() - starts.getTime()) / 60000)) : 0;
        const durationMin = (durRaw > 0 ? durRaw : durFromDates) || 60;
        const end = addMinutes(starts, durationMin);
        const openAt = new Date(starts.getTime() - 15 * 60 * 1000);
        const graceEnd = new Date(end.getTime() + 5 * 60 * 1000);
        const joinable = now.getTime() >= openAt.getTime() && now.getTime() <= graceEnd.getTime();
        const active = status === "CONFIRMED" || status === "COMPLETED";
        return { b, starts, end, joinable, active };
      })
      .filter((x) => x.joinable && x.active)
      .sort((a, b) => a.starts.getTime() - b.starts.getTime());
    return items[0] || null;
  })();

  const tutorStudents = (() => {
    if (!isTutorRole) return [] as any[];
    const map = new Map<
      string,
      {
        student: any;
        paidCount: number;
        upcomingPaidCount: number;
        completedCount: number;
        totalCount: number;
        grossCents: number;
        lastBookingId: string;
        nextLessonAtMs: number;
        nextLessonBookingId: string;
        tutorId: string | null;
      }
    >();
    const nowMs = Date.now();
    for (const b of asTutor || []) {
      const s = (b as any)?.student;
      const sid = String((s as any)?.id || "");
      if (!sid) continue;
      const status = String((b as any)?.status || "").toUpperCase();
      const startsAtMs = new Date((b as any)?.startsAt).getTime();
      const bookingId = String((b as any)?.id || "");
      const hasPayment = !!String((b as any)?.paymentId || "").trim();
      const isPaidLesson = hasPayment && (status === "CONFIRMED" || status === "COMPLETED");

      const entry = map.get(sid) || {
        student: s,
        paidCount: 0,
        upcomingPaidCount: 0,
        completedCount: 0,
        totalCount: 0,
        grossCents: 0,
        lastBookingId: "",
        nextLessonAtMs: 0,
        nextLessonBookingId: "",
        tutorId: String((b as any)?.tutorId || (b as any)?.tutor?.id || "") || null,
      };
      entry.totalCount += 1;

      if (bookingId) {
        if (!entry.lastBookingId) entry.lastBookingId = bookingId;
        if (Number.isFinite(startsAtMs) && startsAtMs > nowMs) {
          if (!entry.nextLessonAtMs || startsAtMs < entry.nextLessonAtMs) {
            entry.nextLessonAtMs = startsAtMs;
            entry.nextLessonBookingId = bookingId;
          }
        }
      }
      if (isPaidLesson) {
        entry.paidCount += 1;
        entry.grossCents += Number((b as any)?.priceCents || 0) || 0;
        if (status === "COMPLETED") entry.completedCount += 1;
        if (status === "CONFIRMED" && Number.isFinite(startsAtMs) && startsAtMs > nowMs) {
          entry.upcomingPaidCount += 1;
        }
      }
      map.set(sid, entry);
    }
    return Array.from(map.values()).sort((a, b) => (b.paidCount || 0) - (a.paidCount || 0));
  })();

  const archivedStudentIds = await (async () => {
    if (!isTutorRole) return new Set<string>();
    try {
      const tutor = await prisma.tutor.findUnique({ where: { userId } });
      if (!tutor?.id) return new Set<string>();
      const model = (prisma as any).archivedStudent;
      if (!model?.findMany) return new Set<string>();
      const rows = await model.findMany({
        where: { tutorId: tutor.id },
        select: { studentId: true },
        orderBy: { createdAt: "desc" },
        take: 5000,
      });
      return new Set((rows || []).map((r: any) => String(r.studentId)));
    } catch {
      return new Set<string>();
    }
  })();

  const tutorStudentsFiltered = (() => {
    if (!isTutorRole) return [] as any[];
    if (studentsViewMode === "archived") {
      return tutorStudents.filter((x: any) => archivedStudentIds.has(String((x as any)?.student?.id || "")));
    }
    return tutorStudents.filter((x: any) => !archivedStudentIds.has(String((x as any)?.student?.id || "")));
  })();

  return (
    <main className="container mx-auto px-4 py-12">
      {transferModalData ? (
        <CreditsTransferModal
          locale={String(locale)}
          fromTutorId={transferModalData.fromTutorId}
          toTutorId={transferModalData.toTutorId}
          fromTutorName={transferModalData.fromTutorName}
          toTutorName={transferModalData.toTutorName}
          fromCredits={transferModalData.fromCredits}
          transferCredits={transferModalData.transferCredits}
          onCloseHref={`/${locale}/dashboard?tab=lessons#schedule`}
        />
      ) : null}
      {dbError ? (
        <div className="mb-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
          База даних тимчасово недоступна. Спробуйте оновити сторінку або перезапустити dev-сервер.
        </div>
      ) : null}
      {noticeRaw === "purchase_ok" ? (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-neutral-200">
              <div className="min-w-0">
                <div className="text-2xl font-semibold text-neutral-900">Покупку успішно завершено</div>
                <div className="mt-1 text-sm text-neutral-600">Уроки додано на баланс. Можна відразу запланувати заняття.</div>
              </div>
              <Link
                href={`/${locale}/dashboard?tab=subscriptions#schedule`}
                className="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-neutral-100 text-neutral-800"
                aria-label="Close"
              >
                ✕
              </Link>
            </div>

            <div className="px-6 py-5">
              <div className="flex flex-col gap-3">
                <Link
                  href={`/${locale}/schedule/${encodeURIComponent(String(purchasedTutorId || ""))}`}
                  className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-white hover:bg-emerald-600"
                >
                  Запланувати зараз
                </Link>
                <Link
                  href={`/${locale}/dashboard?tab=subscriptions#schedule`}
                  className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-neutral-200 bg-white px-5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                >
                  Пропустити
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : noticeUi ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold">{noticeUi}</div>
            </div>
            <Link
              href={`/${locale}/dashboard?tab=${encodeURIComponent(activeTab)}#schedule`}
              className="shrink-0 rounded-xl border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
            >
              Закрити
            </Link>
          </div>
        </div>
      ) : null}
      <section id="schedule" className="scroll-mt-24">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-baseline justify-between gap-3 mb-4">
            <h2 className="text-xl font-semibold">{activeTab === "payouts" ? "Виплати" : t["nav.schedule"] || "Розклад"}</h2>
            {activeTab === "lessons" && !isTutorRole ? (
              <div className="flex items-center gap-2">
                {emptyStateTutorId ? (
                  <ScheduleTutorPickerButton
                    locale={locale}
                    buttonText="Запланувати уроки"
                    nextUpcomingByTutorId={nextUpcomingByTutorId}
                    upcomingCountByTutorId={upcomingCountByTutorId}
                  />
                ) : (
                  <Link
                    href={`/${locale}/catalog`}
                    className="inline-flex h-10 items-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                  >
                    Запланувати уроки
                  </Link>
                )}
              </div>
            ) : null}
          </div>

          {activeTab !== "payouts" ? (
            <div className="border-b border-neutral-200">
              <div className="flex items-center gap-6 text-sm">
                <Link
                  href={`/${locale}/dashboard?tab=lessons#schedule`}
                  className={`py-3 font-semibold ${activeTab === "lessons" ? "text-neutral-900 border-b-2 border-neutral-900" : "text-neutral-500"}`}
                >
                  Уроки
                </Link>
                {!isTutorRole ? (
                  <Link
                    href={`/${locale}/dashboard?tab=subscriptions#schedule`}
                    className={`py-3 font-semibold ${activeTab === "subscriptions" ? "text-neutral-900 border-b-2 border-neutral-900" : "text-neutral-500"}`}
                  >
                    Підписки
                  </Link>
                ) : null}
                {!isTutorRole ? (
                  <Link
                    href={`/${locale}/dashboard?tab=calendar#schedule`}
                    className={`py-3 font-semibold ${activeTab === "calendar" ? "text-neutral-900 border-b-2 border-neutral-900" : "text-neutral-500"}`}
                  >
                    Календар
                  </Link>
                ) : null}
                {isTutorRole ? (
                  <Link
                    href={`/${locale}/dashboard?tab=schedule#schedule`}
                    className={`py-3 font-semibold ${activeTab === "schedule" ? "text-neutral-900 border-b-2 border-neutral-900" : "text-neutral-500"}`}
                  >
                    Розклад
                  </Link>
                ) : null}
                {isTutorRole ? (
                  <Link
                    href={`/${locale}/dashboard?tab=students#schedule`}
                    className={`py-3 font-semibold ${activeTab === "students" ? "text-neutral-900 border-b-2 border-neutral-900" : "text-neutral-500"}`}
                  >
                    Мої студенти
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className={activeTab === "students" && isTutorRole ? "" : "mx-auto max-w-4xl"}>
          {activeTab === "students" && isTutorRole ? (
            <div className="mt-8">
              <div className="mx-auto w-full max-w-5xl rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-neutral-900">Мої студенти</div>
                    <div className="mt-1 text-xs text-neutral-600">
                      Статистика сформована на основі підтверджених оплат і статусів уроків.
                    </div>
                  </div>
                  <div className="shrink-0 inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white p-1 text-xs font-semibold text-neutral-900">
                    <Link
                      prefetch={false}
                      href={`/${locale}/dashboard?tab=students&students_view=current#schedule`}
                      className={`inline-flex h-7 items-center rounded-lg px-3 ${studentsViewMode === "current" ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-50"}`}
                    >
                      Current
                    </Link>
                    <Link
                      prefetch={false}
                      href={`/${locale}/dashboard?tab=students&students_view=archived#schedule`}
                      className={`inline-flex h-7 items-center rounded-lg px-3 ${studentsViewMode === "archived" ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-50"}`}
                    >
                      Архів
                    </Link>
                  </div>
                </div>

                {tutorStudentsFiltered.length ? (
                  <div className="mt-4 overflow-x-auto overflow-y-visible">
                    <div className="min-w-[640px] rounded-2xl border border-neutral-200 overflow-visible">
                      <div className="hidden sm:grid grid-cols-[minmax(220px,1.2fr)_120px_96px_180px_56px] items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-600">
                        <div>Студент</div>
                        <div className="text-center">Статус</div>
                        <div className="text-center">Оплачені</div>
                        <div className="text-center">Наступний урок</div>
                        <div className="text-right"> </div>
                      </div>
                      <div className="max-h-[360px] overflow-y-auto divide-y divide-neutral-100">
                        {tutorStudentsFiltered.map((x: any) => {
                          const s = x.student;
                          const name = String(s?.name || s?.email || "Студент");
                          const initial = name.trim() ? name.trim()[0]?.toUpperCase() : "S";
                          const img = String(s?.image || "");
                          const nextAtMs = Number(x.nextLessonAtMs || 0) || 0;
                          const nextLabel = nextAtMs
                            ? new Date(nextAtMs).toLocaleString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—";
                          const chatId = String(x.nextLessonBookingId || x.lastBookingId || "");
                          const totalCount = Number(x.totalCount || 0);
                          const paidCount = Number(x.paidCount || 0);
                          const tutorId = x.tutorId ? String(x.tutorId) : null;
                          const studentId = String(s?.id || "");
                          const isArchived = archivedStudentIds.has(studentId);
                          const statusLabel = paidCount > 0 ? "Оплачено" : totalCount > 0 ? "Без оплати" : "—";
                          const statusClass =
                            paidCount > 0
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : totalCount > 0
                                ? "bg-neutral-50 text-neutral-700 border-neutral-200"
                                : "bg-white text-neutral-400 border-neutral-200";
                          return (
                            <div key={String(s?.id)}>
                              <div className="sm:hidden px-3 py-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex min-w-0 items-center gap-3">
                                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-neutral-200 bg-neutral-50">
                                      {img ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={img} alt={name} className="h-full w-full object-cover" />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-neutral-700">
                                          {initial}
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="truncate text-sm font-semibold text-neutral-900">{name}</div>
                                      <div className="mt-0.5 text-xs text-neutral-600">Наступний урок: {nextLabel}</div>
                                      <div className="mt-1 text-xs text-neutral-600">
                                        Усього: <span className="font-semibold text-neutral-900">{totalCount}</span>
                                        <span className="mx-2 text-neutral-300">·</span>
                                        Оплачені: <span className="font-semibold text-neutral-900">{paidCount}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <div className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
                                      {statusLabel}
                                    </div>
                                    <div className="mt-2 relative z-[60]">
                                      {chatId ? (
                                        <StudentMoreMenu
                                          locale={String(locale)}
                                          bookingId={chatId}
                                          studentId={studentId}
                                          isArchived={isArchived}
                                        />
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="hidden sm:grid grid-cols-[minmax(220px,1.2fr)_120px_96px_180px_56px] items-center gap-2 px-3 py-2">
                                <div className="flex min-w-0 items-center gap-3">
                                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-neutral-200 bg-neutral-50">
                                    {img ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={img} alt={name} className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-neutral-700">
                                        {initial}
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-neutral-900">{name}</div>
                                  </div>
                                </div>
                                <div className="flex items-center justify-center">
                                  <div className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
                                    {statusLabel}
                                  </div>
                                </div>
                                <div className="text-center text-sm font-semibold text-neutral-900 tabular-nums">{paidCount}</div>
                                <div className="text-center text-sm font-semibold text-neutral-900 tabular-nums">{nextLabel}</div>
                                <div className="text-right relative z-[60]">
                                  {chatId ? (
                                    <StudentMoreMenu
                                      locale={String(locale)}
                                      bookingId={chatId}
                                      studentId={studentId}
                                      isArchived={isArchived}
                                    />
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
                    {studentsViewMode === "archived" ? "Архів порожній." : "Поки що немає студентів."}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {activeTab === "lessons" ? (
            <div className={`mt-8 ${!isTutorRole ? "pb-28 sm:pb-0" : ""}`}>
              <div className="mx-auto max-w-4xl">
                {!isTutorRole && ((joinableLesson as any) || (upcoming as any[])?.[0]) ? (
                  (() => {
                    const joinB: any = joinableLesson ? (joinableLesson as any).b : null;
                    const nextB: any = (upcoming as any[])?.[0] || null;
                    const b: any = joinB || nextB;
                    if (!b) return null;
                    const starts: Date = joinB ? (joinableLesson as any).starts : new Date((b as any)?.startsAt);
                    const end: Date = joinB ? (joinableLesson as any).end : new Date((b as any)?.endsAt);
                    const durMin = Math.max(
                      1,
                      Number((b as any)?.durationMinutes || Math.round((end.getTime() - starts.getTime()) / 60000) || 60) || 60,
                    );
                    const tutorId = String((b as any)?.tutorId || "");
                    const tutorName = String((b as any)?.tutor?.user?.name || "Репетитор");
                    const subj = String((b as any)?.tutor?.headline || "") || "";
                    const media0 = Array.isArray((b as any)?.tutor?.media) ? String((b as any)?.tutor?.media?.[0] || "") : "";
                    const avatarUrl = String(media0 || (b as any)?.tutor?.user?.image || "");
                    const href = `/${locale}/lesson/${encodeURIComponent(String((b as any)?.id || ""))}`;
                    const bookingId = String((b as any)?.id || "");
                    const btnLabel = joinButtonLabel(starts, durMin);
                    const timeRange = `${fmtTime(starts)}–${fmtTime(end)}`;
                    const canJoinNow = starts.getTime() - now.getTime() <= 15 * 60 * 1000;

                    const restUpcoming = (upcoming as any[])
                      .filter((x: any) => String(x?.id || "") && String(x?.id || "") !== String((b as any)?.id || ""))
                      .slice(0, 6);

                    return (
                      <>
                        <div className="mb-6 mx-auto w-full max-w-xl rounded-3xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
                          <div className="relative px-6 py-6 sm:px-8 sm:py-7">
                            <div className="absolute right-3 top-3">
                              <LessonMoreMenu
                                locale={String(locale)}
                                bookingId={String((b as any)?.id || "")}
                                tutorId={tutorId || null}
                              />
                            </div>

                            <div className="flex flex-col items-center text-center">
                              <div className="h-20 w-20 overflow-hidden rounded-2xl ring-1 ring-neutral-200 bg-white text-neutral-700 flex items-center justify-center text-base font-semibold">
                                {avatarUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={avatarUrl} alt="" className="h-full w-full object-cover object-top" />
                                ) : (
                                  initials(tutorName)
                                )}
                              </div>
                              <div className="mt-3 text-xs font-semibold text-neutral-500">Сьогодні</div>
                              <div className="mt-1 text-lg font-semibold text-neutral-900">{fmtDay(starts)} · {timeRange}</div>
                              <div className="mt-0.5 text-sm text-neutral-700">
                                {tutorName}
                                {subj ? ` · ${subj}` : ""}
                              </div>
                            </div>

                            <div className="mt-5 flex items-center justify-center">
                              {canJoinNow ? (
                                <Link
                                  href={href}
                                  className="inline-flex h-12 w-full max-w-sm items-center justify-center rounded-2xl bg-pink-500 px-6 text-base font-semibold text-white hover:bg-pink-600"
                                >
                                  {btnLabel}
                                </Link>
                              ) : (
                                <div className="inline-flex h-12 w-full max-w-sm items-center justify-center rounded-2xl bg-neutral-100 px-6 text-base font-semibold text-neutral-500 cursor-not-allowed select-none">
                                  {btnLabel}
                                </div>
                              )}
                            </div>

                            {process.env.NODE_ENV !== "production" && bookingId ? (
                              <div className="mt-3 flex items-center justify-center">
                                <form
                                  action={`/api/bookings/${encodeURIComponent(String(bookingId))}/dev-fast-forward`}
                                  method="POST"
                                >
                                  <input type="hidden" name="locale" value={String(locale)} />
                                  <input type="hidden" name="back" value="dashboard" />
                                  <button
                                    type="submit"
                                    className="text-xs font-semibold text-neutral-500 underline hover:text-neutral-700"
                                  >
                                    Dev: завершити
                                  </button>
                                </form>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {restUpcoming.length ? (
                          <div className="mb-8 mx-auto w-full max-w-xl">
                            <div className="px-1">
                              <div className="text-xl font-semibold text-neutral-900">Наступні уроки</div>
                              <div className="mt-3 space-y-3">
                                {restUpcoming.map((x: any) => {
                                  const id = String(x?.id || "");
                                  const st = new Date(String(x?.startsAt || ""));
                                  const en = new Date(String(x?.endsAt || ""));
                                  const tn = String(x?.tutor?.user?.name || "Репетитор");
                                  const tr = `${fmtTime(st)}–${fmtTime(en)}`;
                                  return (
                                    <div key={id} className="flex items-stretch gap-3">
                                      <div className="flex w-4 justify-center">
                                        <div className="mt-2 h-2.5 w-2.5 rounded-full bg-neutral-300" />
                                      </div>
                                      <div className="min-w-0 flex-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <div className="text-xs font-semibold text-neutral-500">Сьогодні</div>
                                            <div className="mt-0.5 text-sm font-semibold text-neutral-900 truncate">{fmtDay(st)} · {tr}</div>
                                            <div className="mt-0.5 text-xs text-neutral-600 truncate">{tn}</div>
                                          </div>
                                          <div className="shrink-0 -mt-1">
                                            <LessonMoreMenu locale={String(locale)} bookingId={id} tutorId={String(x?.tutorId || "") || null} />
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </>
                    );
                  })()
                ) : null}

                {!isTutorRole ? (
                  (() => {
                    if (Array.isArray(upcoming) && upcoming.length > 0) return null;
                    const upcomingTutorId = String(
                      (((joinableLesson as any)?.b as any) || ((upcoming as any[])?.[0] as any))?.tutorId || "",
                    );
                    const lastCompleted = (pastLessonsDeduped as any[]).find((x: any) => {
                      const role = String((x as any)?.__role || "");
                      if (role && role !== "student") return false;
                      const st = String((x as any)?.status || "").toUpperCase();
                      return st === "COMPLETED";
                    });
                    const tutorId = String((lastCompleted as any)?.tutorId || "");
                    if (!tutorId) return null;
                    if (upcomingTutorId && tutorId === upcomingTutorId) return null;

                    const hasUpcomingWithThisTutor = (upcoming as any[])?.some((u: any) => String(u?.tutorId || "") === tutorId);
                    if (hasUpcomingWithThisTutor) return null;

                    const tutorName = String((lastCompleted as any)?.tutor?.user?.name || "Репетитор");
                    const rateCents = Number((lastCompleted as any)?.tutor?.rateCents || 0) || 0;
                    const media0 = Array.isArray((lastCompleted as any)?.tutor?.media)
                      ? String((lastCompleted as any)?.tutor?.media?.[0] || "")
                      : "";
                    const avatarUrl = String(media0 || (lastCompleted as any)?.tutor?.user?.image || "");

                    return (
                      <div className="mb-6 mx-auto w-full max-w-xl rounded-3xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
                        <div className="px-6 py-6 sm:px-8">
                          <div className="flex flex-col items-center text-center">
                            <div className="h-16 w-16 overflow-hidden rounded-2xl ring-1 ring-neutral-200 bg-white text-neutral-700 flex items-center justify-center text-sm font-semibold">
                              {avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={avatarUrl} alt="" className="h-full w-full object-cover object-top" />
                              ) : (
                                initials(tutorName)
                              )}
                            </div>
                            <div className="mt-3 text-base font-semibold text-neutral-900">Продовжити з {tutorName}</div>
                            <div className="mt-1 text-sm text-neutral-600">Заплануйте наступні уроки з цим викладачем.</div>
                          </div>

                          <div className="mt-4 flex items-center justify-center">
                            <ContinueLessonsButton
                              locale={locale}
                              tutorId={tutorId}
                              tutorName={tutorName}
                              pricePerLessonUAH={Math.max(0, Math.round(rateCents / 100))}
                              variant="compact"
                              buttonText="Запланувати уроки"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : null}

                <div className="text-sm font-semibold text-neutral-900">Минулі</div>

                {pastLessonsDeduped.length === 0 ? (
                  <div className="mt-4 text-sm text-neutral-600">Поки що немає минулих уроків.</div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {pastLessonsDeduped.map((b: any) => {
                      const starts = new Date((b as any)?.startsAt);
                      const ends = new Date((b as any)?.endsAt);
                      const bookingId = String((b as any)?.id || "");
                      const tutorId = String((b as any)?.tutorId || "");
                      const tutorName = String((b as any)?.tutor?.user?.name || "Репетитор");
                      const subj = String((b as any)?.tutor?.subject || (b as any)?.tutor?.headline || "") || "";
                      const status = String((b as any)?.status || "").toUpperCase();
                      const review = (b as any)?.review;
                      const canReview = status === "COMPLETED" && !review;
                      const media0 = Array.isArray((b as any)?.tutor?.media) ? String((b as any)?.tutor?.media?.[0] || "") : "";
                      const avatarUrl = String(media0 || (b as any)?.tutor?.user?.image || "");
                      const detailsHref = `/${locale}/lesson/${encodeURIComponent(bookingId)}`;
                      const statusLabel =
                        status === "COMPLETED" ? "Завершено" : status === "CANCELED" ? "Скасовано" : status === "REFUNDED" ? "Повернено" : status || "";

                      return (
                        <div
                          key={bookingId}
                          className="relative rounded-3xl border border-neutral-200 bg-white shadow-sm hover:shadow-md hover:bg-neutral-50 transition"
                        >
                          <div className="px-6 py-5">
                            <div className="flex items-center justify-between gap-4">
                              <Link href={detailsHref} className="min-w-0 flex-1">
                                <div className="flex items-center gap-5">
                                  <div className="h-14 w-14 overflow-hidden rounded-2xl ring-1 ring-neutral-200 bg-white text-neutral-700 flex items-center justify-center text-sm font-semibold">
                                    {avatarUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                      initials(tutorName)
                                    )}
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="text-[15px] font-semibold text-neutral-900 truncate">
                                      {fmtWeekday(starts)}
                                      <span className="text-neutral-400">,</span> {fmtDateOnly(starts)}
                                      <span className="mx-2 text-neutral-300">·</span>
                                      {fmtTime(starts)}–{fmtTime(ends)}
                                    </div>

                                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-600">
                                      <span className="inline-flex items-center gap-1 text-neutral-700">
                                        <span className="font-medium">{statusLabel}</span>
                                      </span>
                                      <span className="text-neutral-400">·</span>
                                      <span className="truncate">
                                        {tutorName}
                                        {subj ? `, ${subj}` : ""}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </Link>

                              <div className="flex shrink-0 items-center gap-2">
                                {status === "COMPLETED" ? (
                                  <ReviewModalButton
                                    bookingId={bookingId}
                                    buttonText="Оцінити"
                                    initialRated={Boolean(review)}
                                  />
                                ) : null}
                                <LessonMoreMenu locale={String(locale)} bookingId={bookingId} tutorId={tutorId || null} />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === "calendar" && !isTutorRole ? (
            <div className="mt-8">
              <StudentWeekScheduleGrid locale={String(locale)} />
            </div>
          ) : !isTutorRole && activeTab === "subscriptions" ? (
            <div className="mt-8">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-neutral-900">Підписки</div>
              </div>

              {subscriptionsFiltered.length === 0 ? (
                <div className="mt-4 text-sm text-neutral-600">Поки що немає активних підписок.</div>
              ) : (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {subscriptionsFiltered.map((s: any) => {
                    const tutorId = String(s?.tutorId || s?.tutor?.id || "");
                    const tutorName = String(s?.tutor?.user?.name || "Репетитор");
                    const subj = String(s?.tutor?.subject || s?.tutor?.headline || "");
                    const media0 = Array.isArray((s as any)?.tutor?.media) ? String((s as any)?.tutor?.media?.[0] || "") : "";
                    const avatarUrl = String(media0 || s?.tutor?.user?.image || "");
                    const credits = Number(s?.credits ?? 0) || 0;
                    const paused = !!(s as any)?.paused;
                    const canSchedule = !paused && credits > 0;
                    const upcomingList = tutorId ? upcomingByTutorId.get(tutorId) || [] : [];
                    const nextUpcoming = upcomingList[0] || null;
                    const canReschedule = !paused && !!nextUpcoming;
                    const isInactive = !paused && credits <= 0 && upcomingList.length === 0;
                    const rateCents = Number((s as any)?.tutor?.rateCents ?? 0) || 0;
                    const rescheduleHref = nextUpcoming
                      ? `/${locale}/schedule/${encodeURIComponent(tutorId)}?reschedule=${encodeURIComponent(String(nextUpcoming.id))}`
                      : "";
                    const reservedValueUAH = upcomingList.length > 0 && rateCents > 0 ? Math.round((upcomingList.length * rateCents) / 100) : 0;
                    return (
                      <div
                        key={String(s.id)}
                        className={
                          isInactive
                            ? "group relative rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition"
                            : "group relative rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:shadow-md hover:bg-neutral-50 transition"
                        }
                      >
                        <div className="flex items-start gap-4">
                          <div className="h-[72px] w-[72px] min-h-[72px] min-w-[72px] overflow-hidden rounded-xl ring-1 ring-neutral-200 bg-white text-neutral-700 flex items-center justify-center text-sm font-semibold">
                            {avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={avatarUrl} alt="" className="h-full w-full object-cover object-top" />
                            ) : (
                              initials(tutorName)
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-base font-semibold text-neutral-900 truncate">
                                  {subj ? subj : "Урок"} з {tutorName}
                                </div>
                                <div className="mt-0.5 text-sm text-neutral-600 truncate">{subj ? subj : ""}</div>
                              </div>
                              <div className="flex flex-shrink-0 items-center gap-2">
                                {paused ? (
                                  <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700 ring-1 ring-inset ring-neutral-200">
                                    Призупинена
                                  </span>
                                ) : isInactive ? (
                                  <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700 ring-1 ring-inset ring-neutral-200">
                                    Неактивна
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
                                    Активна
                                  </span>
                                )}
                                <SubscriptionMoreMenu
                                  locale={String(locale)}
                                  tutorId={tutorId}
                                  tutorName={tutorName}
                                  tutorRateCents={rateCents}
                                  credits={credits}
                                  paused={paused}
                                />
                              </div>
                            </div>

                            <div className="mt-3 grid gap-1">
                              <div className="text-sm text-neutral-700">
                                <span className="text-neutral-500">Баланс:</span> {credits} уроків
                                {credits <= 0 && upcomingList.length > 0 && reservedValueUAH > 0 ? (
                                  <span className="text-neutral-500"> · ≈ ₴{reservedValueUAH}</span>
                                ) : null}
                              </div>
                              <div className="text-sm text-neutral-700">
                                <span className="text-neutral-500">Підписка:</span> активна
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4">
                          {!isTutorRole ? (
                            canReschedule ? (
                              upcomingList.length > 1 ? (
                                <SubscriptionReschedulePicker
                                  locale={String(locale)}
                                  tutorId={tutorId}
                                  bookings={upcomingList.map((b: any) => ({ id: String(b.id), startsAt: String(b.startsAt) }))}
                                  buttonText="Перенести урок"
                                />
                              ) : (
                                <Link
                                  href={rescheduleHref}
                                  className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-neutral-900 px-5 text-sm font-semibold text-white hover:bg-neutral-800"
                                >
                                  Перенести урок
                                </Link>
                              )
                            ) : isInactive ? (
                              <PayOrTransferFlow
                                locale={String(locale)}
                                toTutorId={tutorId}
                                toTutorName={tutorName}
                                toRateCents={Math.max(0, Math.round(rateCents || 0))}
                                buttonText="Купити уроки"
                                autoSkipMethod={false}
                                onSuccessHref={`/${locale}/dashboard?tab=subscriptions#schedule`}
                              />
                            ) : canSchedule ? (
                              <Link
                                href={`/${locale}/schedule/${encodeURIComponent(tutorId)}`}
                                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-neutral-900 px-5 text-sm font-semibold text-white hover:bg-neutral-800"
                              >
                                Запланувати уроки
                              </Link>
                            ) : (
                              <button
                                type="button"
                                disabled
                                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-neutral-200 px-5 text-sm font-semibold text-neutral-600 cursor-not-allowed"
                              >
                                Запланувати уроки
                              </button>
                            )
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {null}{/*
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <div className="text-xs text-neutral-600">Доступно</div>
                  <div className="mt-1 text-lg font-semibold text-neutral-900">
                    {fmtMoney(Number(payoutData?.availableCents || 0), String(payoutData?.currency || "UAH"))}
                  </div>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <div className="text-xs text-neutral-600">В холді</div>
                  <div className="mt-1 text-lg font-semibold text-neutral-900">
                    {fmtMoney(Number(payoutData?.holdCents || 0), String(payoutData?.currency || "UAH"))}
                  </div>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <div className="text-xs text-neutral-600">На виплаті</div>
                  <div className="mt-1 text-lg font-semibold text-neutral-900">
                    {fmtMoney(Number(payoutData?.payoutPendingCents || 0), String(payoutData?.currency || "UAH"))}
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="text-xs text-neutral-600">Виплачено</div>
                <div className="mt-1 text-lg font-semibold text-neutral-900">
                  {fmtMoney(Number(payoutData?.paidCents || 0), String(payoutData?.currency || "UAH"))}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-neutral-900">Уроки в холді</div>
                    <div className="mt-1 text-xs text-neutral-600">Після завершення уроку кошти стають доступними через 72 години.</div>
                  </div>
                </div>

                {Array.isArray(payoutData?.holdLessons) && payoutData!.holdLessons.length ? (
                  <div className="mt-4 divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
                    {payoutData!.holdLessons.map((x: any) => (
                      <div key={String(x.id)} className="flex items-center justify-between gap-3 p-4">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-neutral-900 truncate">
                            {fmtMoney(Number(x?.priceCents || 0), String(x?.currency || payoutData?.currency || "UAH"))}
                          </div>
                          <div className="mt-0.5 text-xs text-neutral-600 truncate">{String(x?.studentLabel || "Студент")}</div>
                          <div className="mt-0.5 text-xs text-neutral-600">
                            Завершено: {fmtWhen(new Date(x.endedAt))}
                            <span className="mx-2 text-neutral-300">·</span>
                            Доступно з: {fmtWhen(new Date(x.availableAt))}
                          </div>
                          <div className="mt-0.5 text-xs text-neutral-500">
                            Залишилось: {fmtDuration(new Date(x.availableAt).getTime() - Date.now())}
                          </div>
                        </div>
                        <div className="text-xs font-semibold">
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">В холді</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
                    Наразі немає уроків у холді.
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-neutral-900">Запросити виплату</div>
                    <div className="mt-1 text-xs text-neutral-600">Мінімальна сума: 10 {String(payoutData?.currency || "UAH")}</div>
                  </div>
                  <form action="/api/tutor/payouts/request" method="POST" className="flex items-center gap-2">
                    <input
                      name="amountUAH"
                      inputMode="decimal"
                      placeholder={`Сума (до ${(Number(payoutData?.availableCents || 0) / 100).toFixed(0)} ${String(payoutData?.currency || "UAH")})`}
                      className="h-10 w-44 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <button
                      type="submit"
                      disabled={Number(payoutData?.availableCents || 0) < 1000}
                      className="inline-flex h-10 items-center rounded-xl bg-black px-4 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
                    >
                      Запросити
                    </button>
                  </form>
                </div>
                <div className="mt-2 text-xs text-neutral-600">
                  Якщо поле суми порожнє — запросимо всю доступну суму.
                </div>
                {Number(payoutData?.availableCents || 0) > 0 ? (
                  <div className="mt-2 text-xs text-neutral-700">
                    Сума уроків: {fmtMoney(Number(payoutData?.grossAvailableCents || 0), String(payoutData?.currency || "UAH"))}
                    <span className="mx-2 text-neutral-300">·</span>
                    Комісія платформи: {fmtMoney(Number(payoutData?.commissionAvailableCents || 0), String(payoutData?.currency || "UAH"))}
                    <span className="mx-2 text-neutral-300">·</span>
                    До виплати: {fmtMoney(Number(payoutData?.availableCents || 0), String(payoutData?.currency || "UAH"))}
                  </div>
                ) : Number(payoutData?.payoutPendingCents || 0) > 0 ? (
                  <div className="mt-2 text-xs text-neutral-700">
                    Є активна заявка на виплату: {fmtMoney(Number(payoutData?.payoutPendingCents || 0), String(payoutData?.currency || "UAH"))}
                  </div>
                ) : null}
              </div>

              <div className="mt-4">
                {(() => {
                  const all = Array.isArray(payoutData?.payouts) ? payoutData!.payouts : [];
                  const pending = all.filter((p: any) => String(p?.status || "").toUpperCase() === "PENDING");
                  const done = all.filter((p: any) => {
                    const st = String(p?.status || "").toUpperCase();
                    return st === "PAID" || st === "FAILED";
                  });

                  return (
                    <>
                      <div className="text-sm font-semibold text-neutral-900">Заявки на виплату</div>
                      {pending.length ? (
                        <div className="mt-3 divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
                          {pending.map((p: any) => (
                            <div key={String(p.id)} className="flex items-center justify-between gap-3 p-4">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-neutral-900 truncate">
                                  {fmtMoney(Number(p?.amountCents || 0), String(p?.currency || payoutData?.currency || "UAH"))}
                                </div>
                                <div className="mt-0.5 text-xs text-neutral-600">{fmtWhen(new Date(p.createdAt))}</div>
                              </div>
                              <div className="text-xs font-semibold">
                                <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">В обробці</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">Немає активних заявок.</div>
                      )}

                      <div className="mt-6 text-sm font-semibold text-neutral-900">Історія виплат</div>
                      {done.length ? (
                        <div className="mt-3 divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
                          {done.map((p: any) => (
                            <div key={String(p.id)} className="flex items-center justify-between gap-3 p-4">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-neutral-900 truncate">
                                  {fmtMoney(Number(p?.amountCents || 0), String(p?.currency || payoutData?.currency || "UAH"))}
                                </div>
                                <div className="mt-0.5 text-xs text-neutral-600">{fmtWhen(new Date(p.createdAt))}</div>
                              </div>
                              <div className="text-xs font-semibold">
                                {String(p?.status || "").toUpperCase() === "PAID" ? (
                                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Виплачено</span>
                                ) : (
                                  <span className="rounded-full bg-red-50 px-3 py-1 text-red-700">Помилка</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">Поки що немає виплат.</div>
                      )}
                    </>
                  );
                })()}
              </div>

              <details className="mt-6 rounded-2xl border border-neutral-200 bg-white" open>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                  <div className="text-sm font-semibold text-neutral-900">Історія</div>
                  <div className="text-xs text-neutral-500">Згорнути / розгорнути</div>
                </summary>

                <div className="px-4 pb-4">
                  {(() => {
                    const payouts = Array.isArray(payoutData?.payouts) ? payoutData!.payouts : [];
                    const credited = Array.isArray(payoutData?.creditedLessons) ? payoutData!.creditedLessons : [];
                    const processing = Array.isArray(payoutData?.processingLessons) ? payoutData!.processingLessons : [];

                    const events: any[] = [
                      ...payouts.map((p: any) => ({
                        type: "payout",
                        id: `payout:${String(p?.id || "")}`,
                        at: new Date(p?.createdAt || Date.now()),
                        data: p,
                      })),
                      ...credited.map((x: any) => ({
                        type: "credited",
                        id: `credited:${String(x?.id || "")}`,
                        at: new Date(x?.endedAt || Date.now()),
                        data: x,
                      })),
                      ...processing.map((x: any) => ({
                        type: "processing",
                        id: `processing:${String(x?.id || "")}`,
                        at: new Date(x?.startsAt || x?.endedAt || Date.now()),
                        data: x,
                      })),
                    ]
                      .filter(Boolean)
                      .sort((a: any, b: any) => new Date(b.at).getTime() - new Date(a.at).getTime())
                      .slice(0, 12);

                    return events.length === 0 ? (
                      <div className="mt-1 text-sm text-neutral-600">Поки що немає подій.</div>
                    ) : (
                      <div className="mt-1 divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
                        {events.map((e: any) => {
                          const t = String(e.type);
                          const at = new Date(e.at);
                          const currency = String(payoutData?.currency || "UAH");

                          const summary = (() => {
                            if (t === "payout") {
                              const p = e.data;
                              const st = String(p?.status || "").toUpperCase();
                              const amount = fmtMoney(Number(p?.amountCents || 0), String(p?.currency || currency));
                              const label = st === "PAID" ? "Виплата" : st === "FAILED" ? "Виплата (помилка)" : "Запит на виплату";
                              return { left: label, right: amount };
                            }
                            if (t === "credited") {
                              const x = e.data;
                              const amount = fmtMoney(Number(x?.priceCents || 0), String(x?.currency || currency));
                              return { left: `Зараховано: ${String(x?.studentLabel || "Студент")}`, right: amount };
                            }
                            const x = e.data;
                            const amount = fmtMoney(Number(x?.priceCents || 0), String(x?.currency || currency));
                            const kind = String(x?.kind || "");
                            const label = kind === "upcoming" ? "Урок заплановано" : "В холді";
                            return { left: `${label}: ${String(x?.studentLabel || "Студент")}`, right: amount };
                          })();

                          return (
                            <details key={String(e.id)} className="group p-4">
                              <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-neutral-900 truncate">{summary.left}</div>
                                  <div className="mt-0.5 text-xs text-neutral-600">{fmtWhen(at)}</div>
                                </div>
                                <div className="shrink-0 text-sm font-semibold text-neutral-900 tabular-nums">{summary.right}</div>
                              </summary>
                              <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700 whitespace-pre-wrap">
                                {JSON.stringify(e.data, null, 2)}
                              </div>
                            </details>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </details>
            </div>
            );

            if (activeTab === "schedule" && isTutorRole) return (
            <div className="mt-8">
              {payoutError ? (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  {payoutError}
                </div>
              ) : null}

              <div className="mb-3 flex items-center justify-end">
                <PayoutSupportCTA
                  locale={String(locale)}
                  context={
                    `Локаль: ${String(locale)}\n` +
                    `\nПоточні суми:\n` +
                    `available=${fmtMoney(Number(payoutData?.availableCents || 0), String(payoutData?.currency || "UAH"))}\n` +
                    `hold=${fmtMoney(Number(payoutData?.holdCents || 0), String(payoutData?.currency || "UAH"))}\n` +
                    `payoutPending=${fmtMoney(Number(payoutData?.payoutPendingCents || 0), String(payoutData?.currency || "UAH"))}\n` +
                    `paid=${fmtMoney(Number(payoutData?.paidCents || 0), String(payoutData?.currency || "UAH"))}\n`
                  }
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <div className="text-xs text-neutral-600">Доступно</div>
                  <div className="mt-1 text-lg font-semibold text-neutral-900">
                    {fmtMoney(Number(payoutData?.availableCents || 0), String(payoutData?.currency || "UAH"))}
                  </div>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <div className="text-xs text-neutral-600">В холді</div>
                  <div className="mt-1 text-lg font-semibold text-neutral-900">
                    {fmtMoney(Number(payoutData?.holdCents || 0), String(payoutData?.currency || "UAH"))}
                  </div>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <div className="text-xs text-neutral-600">На виплаті</div>
                  <div className="mt-1 text-lg font-semibold text-neutral-900">
                    {fmtMoney(Number(payoutData?.payoutPendingCents || 0), String(payoutData?.currency || "UAH"))}
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="text-xs text-neutral-600">Виплачено</div>
                <div className="mt-1 text-lg font-semibold text-neutral-900">
                  {fmtMoney(Number(payoutData?.paidCents || 0), String(payoutData?.currency || "UAH"))}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-neutral-900">Уроки в холді</div>
                    <div className="mt-1 text-xs text-neutral-600">Після завершення уроку кошти стають доступними через 72 години.</div>
                  </div>
                </div>

                {Array.isArray(payoutData?.holdLessons) && payoutData!.holdLessons.length ? (
                  <div className="mt-4 divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
                    {payoutData!.holdLessons.map((x: any) => (
                      <div key={String(x.id)} className="flex items-center justify-between gap-3 p-4">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-neutral-900 truncate">
                            {fmtMoney(Number(x?.priceCents || 0), String(x?.currency || payoutData?.currency || "UAH"))}
                          </div>
                          <div className="mt-0.5 text-xs text-neutral-600 truncate">{String(x?.studentLabel || "Студент")}</div>
                          <div className="mt-0.5 text-xs text-neutral-600">
                            Завершено: {fmtWhen(new Date(x.endedAt))}
                            <span className="mx-2 text-neutral-300">·</span>
                            Доступно з: {fmtWhen(new Date(x.availableAt))}
                          </div>
                          <div className="mt-0.5 text-xs text-neutral-500">
                            Залишилось: {fmtDuration(new Date(x.availableAt).getTime() - Date.now())}
                          </div>
                        </div>
                        <div className="text-xs font-semibold">
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">В холді</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
                    Наразі немає уроків у холді.
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-neutral-900">Запросити виплату</div>
                    <div className="mt-1 text-xs text-neutral-600">Мінімальна сума: 10 {String(payoutData?.currency || "UAH")}</div>
                  </div>
                  <form action="/api/tutor/payouts/request" method="POST" className="flex items-center gap-2">
                    <input
                      name="amountUAH"
                      inputMode="decimal"
                      placeholder={`Сума (до ${(Number(payoutData?.availableCents || 0) / 100).toFixed(0)} ${String(payoutData?.currency || "UAH")})`}
                      className="h-10 w-44 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <button
                      type="submit"
                      disabled={Number(payoutData?.availableCents || 0) < 1000}
                      className="inline-flex h-10 items-center rounded-xl bg-black px-4 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
                    >
                      Запросити
                    </button>
                  </form>
                </div>
                <div className="mt-2 text-xs text-neutral-600">
                  Якщо поле суми порожнє — запросимо всю доступну суму.
                </div>
                {Number(payoutData?.availableCents || 0) > 0 ? (
                  <div className="mt-2 text-xs text-neutral-700">
                    Сума уроків: {fmtMoney(Number(payoutData?.grossAvailableCents || 0), String(payoutData?.currency || "UAH"))}
                    <span className="mx-2 text-neutral-300">·</span>
                    Комісія платформи: {fmtMoney(Number(payoutData?.commissionAvailableCents || 0), String(payoutData?.currency || "UAH"))}
                    <span className="mx-2 text-neutral-300">·</span>
                    До виплати: {fmtMoney(Number(payoutData?.availableCents || 0), String(payoutData?.currency || "UAH"))}
                  </div>
                ) : Number(payoutData?.payoutPendingCents || 0) > 0 ? (
                  <div className="mt-2 text-xs text-neutral-700">
                    Є активна заявка на виплату: {fmtMoney(Number(payoutData?.payoutPendingCents || 0), String(payoutData?.currency || "UAH"))}
                  </div>
                ) : null}
              </div>

              <div className="mt-4">
                {(() => {
                  const all = Array.isArray(payoutData?.payouts) ? payoutData!.payouts : [];
                  const pending = all.filter((p: any) => String(p?.status || "").toUpperCase() === "PENDING");
                  const done = all.filter((p: any) => {
                    const st = String(p?.status || "").toUpperCase();
                    return st === "PAID" || st === "FAILED";
                  });

                  return (
                    <>
                      <div className="text-sm font-semibold text-neutral-900">Заявки на виплату</div>
                      {pending.length ? (
                        <div className="mt-3 divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
                          {pending.map((p: any) => (
                            <div key={String(p.id)} className="flex items-center justify-between gap-3 p-4">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-neutral-900 truncate">
                                  {fmtMoney(Number(p?.amountCents || 0), String(p?.currency || payoutData?.currency || "UAH"))}
                                </div>
                                <div className="mt-0.5 text-xs text-neutral-600">{fmtWhen(new Date(p.createdAt))}</div>
                              </div>
                              <div className="text-xs font-semibold">
                                <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">В обробці</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">Немає активних заявок.</div>
                      )}

                      <div className="mt-6 text-sm font-semibold text-neutral-900">Історія виплат</div>
                      {done.length ? (
                        <div className="mt-3 divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
                          {done.map((p: any) => (
                            <div key={String(p.id)} className="flex items-center justify-between gap-3 p-4">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-neutral-900 truncate">
                                  {fmtMoney(Number(p?.amountCents || 0), String(p?.currency || payoutData?.currency || "UAH"))}
                                </div>
                                <div className="mt-0.5 text-xs text-neutral-600">{fmtWhen(new Date(p.createdAt))}</div>
                              </div>
                              <div className="text-xs font-semibold">
                                {String(p?.status || "").toUpperCase() === "PAID" ? (
                                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Виплачено</span>
                                ) : (
                                  <span className="rounded-full bg-red-50 px-3 py-1 text-red-700">Помилка</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">Поки що немає виплат.</div>
                      )}
                    </>
                  );
                })()}
              </div>

              <details className="mt-6 rounded-2xl border border-neutral-200 bg-white" open>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                  <div className="text-sm font-semibold text-neutral-900">Історія</div>
                  <div className="text-xs text-neutral-500">Згорнути / розгорнути</div>
                </summary>

                <div className="px-4 pb-4">
                  {(() => {
                    const payouts = Array.isArray(payoutData?.payouts) ? payoutData!.payouts : [];
                    const credited = Array.isArray(payoutData?.creditedLessons) ? payoutData!.creditedLessons : [];
                    const processing = Array.isArray(payoutData?.processingLessons) ? payoutData!.processingLessons : [];

                    const events: any[] = [
                      ...payouts.map((p: any) => ({
                        type: "payout",
                        id: `payout:${String(p?.id || "")}`,
                        at: new Date(p?.createdAt || Date.now()),
                        data: p,
                      })),
                      ...credited.map((x: any) => ({
                        type: "credited",
                        id: `credited:${String(x?.id || "")}`,
                        at: new Date(x?.endedAt || Date.now()),
                        data: x,
                      })),
                      ...processing.map((x: any) => ({
                        type: "processing",
                        id: `processing:${String(x?.id || "")}`,
                        at: new Date(x?.startsAt || x?.endedAt || Date.now()),
                        data: x,
                      })),
                    ]
                      .filter(Boolean)
                      .sort((a: any, b: any) => new Date(b.at).getTime() - new Date(a.at).getTime())
                      .slice(0, 12);

                    return events.length === 0 ? (
                      <div className="mt-1 text-sm text-neutral-600">Поки що немає подій.</div>
                    ) : (
                      <div className="mt-1 divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
                        {events.map((e: any) => {
                          const t = String(e.type);
                          const at = new Date(e.at);
                          const currency = String(payoutData?.currency || "UAH");

                          const summary = (() => {
                            if (t === "payout") {
                              const p = e.data;
                              const st = String(p?.status || "").toUpperCase();
                              const amount = fmtMoney(Number(p?.amountCents || 0), String(p?.currency || currency));
                              const label = st === "PAID" ? "Виплата" : st === "FAILED" ? "Виплата (помилка)" : "Запит на виплату";
                              return { left: label, right: amount };
                            }
                            if (t === "credited") {
                              const x = e.data;
                              const amount = fmtMoney(Number(x?.priceCents || 0), String(x?.currency || currency));
                              return { left: `Зараховано: ${String(x?.studentLabel || "Студент")}`, right: amount };
                            }
                            const x = e.data;
                            const amount = fmtMoney(Number(x?.priceCents || 0), String(x?.currency || currency));
                            const kind = String(x?.kind || "");
                            const label = kind === "upcoming" ? "Урок заплановано" : "В холді";
                            return { left: `${label}: ${String(x?.studentLabel || "Студент")}`, right: amount };
                          })();

                          return (
                            <details key={String(e.id)} className="group p-4">
                              <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-neutral-900 truncate">{summary.left}</div>
                                  <div className="mt-0.5 text-xs text-neutral-600">{fmtWhen(at)}</div>
                                </div>
                                <div className="shrink-0 text-sm font-semibold text-neutral-900 tabular-nums">{summary.right}</div>
                              </summary>
                              <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700 whitespace-pre-wrap">
                                {JSON.stringify(e.data, null, 2)}
                              </div>
                            </details>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </details>
            </div>
            );

            if (activeTab === "calendar" && !isTutorRole) return (
            <div className="mt-8">
              <StudentWeekScheduleGrid locale={String(locale)} />
            </div>
            );

            if (activeTab === "lessons") return (
            <div className={`mt-8 ${!isTutorRole ? "pb-28 sm:pb-0" : ""}`}>
              <div className="mx-auto max-w-4xl">
                {!isTutorRole && (joinableLesson || (upcoming as any[])?.[0] || (pastLessonsDeduped as any[])?.length) ? (
                  (() => {
                    const joinB: any = joinableLesson ? (joinableLesson as any).b : null;
                    const nextB: any = (upcoming as any[])?.[0] || null;
                    const hasUpcoming = !!nextB;

                    if (hasUpcoming) {
                      const b: any = joinB || nextB;
                      if (!b) return null;
                      const starts: Date = joinB ? (joinableLesson as any).starts : new Date((b as any)?.startsAt);
                      const end: Date = joinB ? (joinableLesson as any).end : new Date((b as any)?.endsAt);
                      const durMin = Math.max(
                        1,
                        Number((b as any)?.durationMinutes || Math.round((end.getTime() - starts.getTime()) / 60000) || 60) || 60,
                      );
                      const tutorId = String((b as any)?.tutorId || "");
                      const tutorName = String((b as any)?.tutor?.user?.name || "Репетитор");
                      const subj = String((b as any)?.tutor?.headline || "") || "";
                      const media0 = Array.isArray((b as any)?.tutor?.media) ? String((b as any)?.tutor?.media?.[0] || "") : "";
                      const avatarUrl = String(media0 || (b as any)?.tutor?.user?.image || "");
                      const href = `/${locale}/lesson/${encodeURIComponent(String((b as any)?.id || ""))}`;
                      const btnLabel = joinB ? joinButtonLabel(starts, durMin) : "Переглянути урок";
                      const timeRange = `${fmtTime(starts)}–${fmtTime(end)}`;

                      return (
                        <div className="mb-6 mx-auto w-full max-w-md rounded-3xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
                          <div className="relative p-6">
                            <div className="absolute right-3 top-3">
                              <LessonMoreMenu locale={String(locale)} bookingId={String((b as any)?.id || "")} tutorId={tutorId || null} />
                            </div>
                            <div className="flex flex-col items-center text-center">
                              <div className="h-14 w-14 overflow-hidden rounded-2xl ring-1 ring-neutral-200 bg-white text-neutral-700 flex items-center justify-center text-sm font-semibold">
                                {avatarUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={avatarUrl} alt="" className="h-full w-full object-cover object-top" />
                                ) : (
                                  initials(tutorName)
                                )}
                              </div>
                              <div className="mt-3 text-xs font-semibold text-neutral-500">Наступний урок</div>
                              <div className="mt-1 text-[15px] font-semibold text-neutral-900">
                                {fmtDay(starts)} · {timeRange}
                              </div>
                              <div className="mt-0.5 text-sm text-neutral-700">
                                {tutorName}
                                {subj ? ` · ${subj}` : ""}
                              </div>
                            </div>

                            <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-700 text-center">
                              {timeRange}
                            </div>

                            <div className="mt-4 flex items-center justify-center">
                              <Link
                                href={href}
                                className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-neutral-900 ring-1 ring-inset ring-neutral-200 hover:bg-neutral-50"
                              >
                                {btnLabel}
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const lastCompleted = (pastLessonsDeduped as any[]).find((x: any) => {
                      const role = String((x as any)?.__role || "");
                      if (role && role !== "student") return false;
                      const st = String((x as any)?.status || "").toUpperCase();
                      return st === "COMPLETED";
                    });

                    if (Array.isArray(upcoming) && upcoming.length > 0) return null;

                    const tutorId = String((lastCompleted as any)?.tutorId || "");
                    const upcomingTutorId = String((joinB || nextB)?.tutorId || "");
                    const tutorName = String((lastCompleted as any)?.tutor?.user?.name || "Репетитор");
                    const rateCents = Number((lastCompleted as any)?.tutor?.rateCents || 0) || 0;
                    const media0 = Array.isArray((lastCompleted as any)?.tutor?.media)
                      ? String((lastCompleted as any)?.tutor?.media?.[0] || "")
                      : "";
                    const avatarUrl = String(media0 || (lastCompleted as any)?.tutor?.user?.image || "");

                    const hasUpcomingWithThisTutor = (upcoming as any[])?.some((u: any) => String(u?.tutorId || "") === tutorId);

                    return tutorId && (!upcomingTutorId || tutorId !== upcomingTutorId) && !hasUpcomingWithThisTutor ? (
                      <div className="mb-6 mx-auto w-full max-w-md rounded-3xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
                        <div className="p-6">
                          <div className="flex flex-col items-center text-center">
                            <div className="h-14 w-14 overflow-hidden rounded-2xl ring-1 ring-neutral-200 bg-white text-neutral-700 flex items-center justify-center text-sm font-semibold">
                              {avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={avatarUrl} alt="" className="h-full w-full object-cover object-top" />
                              ) : (
                                initials(tutorName)
                              )}
                            </div>
                            <div className="mt-3 text-[15px] font-semibold text-neutral-900">Продовжити з {tutorName}</div>
                            <div className="mt-1 text-sm text-neutral-600">Заплануйте наступні уроки з цим викладачем.</div>
                          </div>

                          <div className="mt-4 flex items-center justify-center">
                            <ContinueLessonsButton
                              locale={locale}
                              tutorId={tutorId}
                              tutorName={tutorName}
                              pricePerLessonUAH={Math.max(0, Math.round(rateCents / 100))}
                              variant="compact"
                              buttonText="Запланувати уроки"
                            />
                          </div>
                        </div>
                      </div>
                    ) : null;
                  })()
                ) : null}
                <div className="mt-10">
                  <div className="text-sm font-semibold text-neutral-900">Минулі</div>
                  {pastLessonsDeduped.length === 0 ? (
                    <div className="mt-4 text-sm text-neutral-600">Поки що немає минулих уроків.</div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {pastLessonsDeduped.map((b: any) => {
                        const starts = new Date(b.startsAt);
                        const ends = new Date(b.endsAt);
                        const role = (b as any).__role;
                        const isStudentView = role === "student";
                        const counterpartName = isStudentView ? lessonLabel(b) : studentLabel(b);
                        const subj = String(b?.tutor?.subject || b?.tutor?.headline || "") || "";
                        const status = String(b?.status || "").toUpperCase();
                        const paymentId = String((b as any)?.paymentId || "");
                        const showPostTrialCta = isStudentView && status === "COMPLETED" && paymentId === "free_first";
                        const moneyText = (() => {
                          const cents = Number((b as any)?.priceCents ?? 0) || 0;
                          const currency = String((b as any)?.currency || "").toUpperCase();
                          const amount = Math.max(0, Math.round(cents / 100));
                          if (!amount) return isStudentView ? "" : "—";
                          if (currency === "USD") return `$${amount}`;
                          if (currency === "EUR") return `€${amount}`;
                          return `${amount} ₴`;
                        })();

                        const statusUi = (() => {
                          const isCanceled = status === "CANCELED" || status === "REFUNDED";
                          const isPaidLike = status === "COMPLETED" || status === "CONFIRMED";
                          if (isCanceled) {
                            return {
                              label: status === "REFUNDED" ? "Скасовано і оплачено" : "Скасовано",
                              tone: "text-rose-700",
                              icon: "x",
                            };
                          }
                          if (status === "PENDING") {
                            return {
                              label: isStudentView ? "Очікує оплати" : "В обробці",
                              tone: "text-amber-700",
                              icon: "clock",
                            };
                          }
                          if (status === "MISSED_TRIAL") {
                            return { label: "Пробний пропущено", tone: "text-neutral-700", icon: "info" };
                          }
                          if (status === "DISPUTED") {
                            return { label: "Спір", tone: "text-amber-700", icon: "info" };
                          }
                          if (isPaidLike) {
                            return {
                              label: isStudentView ? "Підтверджено" : "Сплачено",
                              tone: "text-emerald-700",
                              icon: "check",
                            };
                          }
                          return { label: "Урок", tone: "text-neutral-700", icon: "info" };
                        })();

                        const avatarUrl = (() => {
                          if (isStudentView) {
                            const media0 = Array.isArray(b?.tutor?.media) ? b?.tutor?.media?.[0] : "";
                            return String(media0 || b?.tutor?.user?.image || "");
                          }
                          return String(b?.student?.image || "");
                        })();

                        const tutorId = String(b?.tutorId || "");
                        const detailsHref = `/${locale}/lesson/${encodeURIComponent(String(b.id))}`;
                        const tutorName = String(b?.tutor?.user?.name || counterpartName || "Репетитор");
                        const rateCents = Number(b?.tutor?.rateCents || 0) || 0;
                        const review = (b as any)?.review;
                        const canReview = isStudentView && status === "COMPLETED" && !review;
                        const isReviewed = isStudentView && status === "COMPLETED" && !!review;
                        return (
                          <div
                            key={String(b.id)}
                            className="relative rounded-3xl border border-neutral-200 bg-white shadow-sm hover:shadow-md hover:bg-neutral-50 transition"
                          >
                            <Link href={detailsHref} className="block cursor-pointer px-6 py-5">
                              <div className="flex items-center gap-5">
                                <div className="h-14 w-14 overflow-hidden rounded-2xl ring-1 ring-neutral-200 bg-white text-neutral-700 flex items-center justify-center text-sm font-semibold">
                                  {avatarUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    initials(counterpartName)
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="text-[15px] font-semibold text-neutral-900 truncate">
                                    {fmtWeekday(starts)}
                                    <span className="text-neutral-400">,</span> {fmtDateOnly(starts)}
                                    <span className="mx-2 text-neutral-300">·</span>
                                    {fmtTime(starts)}–{fmtTime(ends)}
                                  </div>

                                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-600">
                                    <span className={`inline-flex items-center gap-1 ${statusUi.tone}`}>
                                      {statusUi.icon === "check" ? (
                                        <span aria-hidden="true" className="text-[14px] leading-none">✓</span>
                                      ) : statusUi.icon === "x" ? (
                                        <span aria-hidden="true" className="text-[14px] leading-none">×</span>
                                      ) : statusUi.icon === "clock" ? (
                                        <span aria-hidden="true" className="text-[14px] leading-none">⏳</span>
                                      ) : (
                                        <span aria-hidden="true" className="text-[14px] leading-none">•</span>
                                      )}
                                      <span className="font-medium">{statusUi.label}</span>
                                    </span>

                                    {moneyText ? <span className="text-neutral-400">·</span> : null}
                                    {moneyText ? <span className="font-medium text-neutral-700">{moneyText}</span> : null}
                                    <span className="text-neutral-400">·</span>
                                    <span className="truncate">
                                      {counterpartName}
                                      {subj ? `, ${subj}` : ""}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </Link>
                          </div>
                        );
                    })}
                  </div>
                )}
              </div>

              {!isTutorRole ? (
                <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white/90 backdrop-blur">
                  <div className="mx-auto max-w-4xl px-4 py-3">
                    {emptyStateTutorId ? (
                      emptyStateTutorCredits > 0 ? (
                        <Link
                          href={`/${locale}/schedule/${encodeURIComponent(emptyStateTutorId)}?planPerWeek=1&planLessons=${encodeURIComponent(String(Math.max(1, Math.min(4, emptyStateTutorCredits || 4))))}`}
                          className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-pink-500 px-5 text-sm font-semibold text-white hover:bg-pink-600"
                        >
                          Запланувати уроки
                        </Link>
                      ) : (
                        <ContinueLessonsButton
                          locale={locale}
                          tutorId={emptyStateTutorId}
                          tutorName={String((emptyTutorBookingLike as any)?.tutor?.user?.name || "Репетитор")}
                          pricePerLessonUAH={Math.max(0, Math.round(Number((emptyTutorBookingLike as any)?.tutor?.rateCents || 0) / 100))}
                          variant="pink"
                          buttonText="Запланувати уроки"
                        />
                      )
                    ) : (
                      <Link
                        href={`/${locale}/catalog`}
                        className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-pink-500 px-5 text-sm font-semibold text-white hover:bg-pink-600"
                      >
                        Запланувати уроки
                      </Link>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            );

            if (!isTutorRole && activeTab === "subscriptions") return (
            <div className="mt-8">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-neutral-900">Підписки</div>
              </div>

              {subscriptionsFiltered.length === 0 ? (
                <div className="mt-4 text-sm text-neutral-600">Поки що немає активних підписок.</div>
              ) : (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {subscriptionsFiltered.map((s: any) => {
                    const tutorId = String(s?.tutorId || s?.tutor?.id || "");
                    const tutorName = String(s?.tutor?.user?.name || "Репетитор");
                    const subj = String(s?.tutor?.subject || s?.tutor?.headline || "");
                    const media0 = Array.isArray((s as any)?.tutor?.media) ? String((s as any)?.tutor?.media?.[0] || "") : "";
                    const avatarUrl = String(media0 || s?.tutor?.user?.image || "");
                    const credits = Number(s?.credits ?? 0) || 0;
                    const paused = !!(s as any)?.paused;
                    const canSchedule = !paused && credits > 0;
                    const upcomingList = tutorId ? upcomingByTutorId.get(tutorId) || [] : [];
                    const nextUpcoming = upcomingList[0] || null;
                    const canReschedule = !paused && !!nextUpcoming;
                    const isInactive = !paused && credits <= 0 && upcomingList.length === 0;
                    const rateCents = Number((s as any)?.tutor?.rateCents ?? 0) || 0;
                    const rescheduleHref = nextUpcoming
                      ? `/${locale}/schedule/${encodeURIComponent(tutorId)}?reschedule=${encodeURIComponent(String(nextUpcoming.id))}`
                      : "";
                    const reservedValueUAH = upcomingList.length > 0 && rateCents > 0 ? Math.round((upcomingList.length * rateCents) / 100) : 0;
                    return (
                      <div
                        key={String(s.id)}
                        className={
                          isInactive
                            ? "group relative rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition"
                            : "group relative rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:shadow-md hover:bg-neutral-50 transition"
                        }
                      >
                        <div className="flex items-start gap-4">
                          <div className="h-[72px] w-[72px] min-h-[72px] min-w-[72px] overflow-hidden rounded-xl ring-1 ring-neutral-200 bg-white text-neutral-700 flex items-center justify-center text-sm font-semibold">
                            {avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={avatarUrl} alt="" className="h-full w-full object-cover object-top" />
                            ) : (
                              initials(tutorName)
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-base font-semibold text-neutral-900 truncate">
                                  {subj ? subj : "Урок"} з {tutorName}
                                </div>
                                <div className="mt-0.5 text-sm text-neutral-600 truncate">{subj ? subj : ""}</div>
                              </div>
                              <div className="flex flex-shrink-0 items-center gap-2">
                                {paused ? (
                                  <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700 ring-1 ring-inset ring-neutral-200">
                                    Призупинена
                                  </span>
                                ) : isInactive ? (
                                  <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700 ring-1 ring-inset ring-neutral-200">
                                    Неактивна
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
                                    Активна
                                  </span>
                                )}
                                <SubscriptionMoreMenu
                                  locale={String(locale)}
                                  tutorId={tutorId}
                                  tutorName={tutorName}
                                  tutorRateCents={rateCents}
                                  credits={credits}
                                  paused={paused}
                                />
                              </div>
                            </div>

                            <div className="mt-3 grid gap-1">
                              <div className="text-sm text-neutral-700">
                                <span className="text-neutral-500">Баланс:</span> {credits} уроків
                                {credits <= 0 && upcomingList.length > 0 && reservedValueUAH > 0 ? (
                                  <span className="text-neutral-500"> · ≈ ₴{reservedValueUAH}</span>
                                ) : null}
                              </div>
                              <div className="text-sm text-neutral-700">
                                <span className="text-neutral-500">Підписка:</span> активна
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4">
                          {!isTutorRole ? (
                            canReschedule ? (
                              upcomingList.length > 1 ? (
                                <SubscriptionReschedulePicker
                                  locale={String(locale)}
                                  tutorId={tutorId}
                                  bookings={upcomingList.map((b: any) => ({ id: String(b.id), startsAt: String(b.startsAt) }))}
                                  buttonText="Перенести урок"
                                />
                              ) : (
                                <Link
                                  href={rescheduleHref}
                                  className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-neutral-900 px-5 text-sm font-semibold text-white hover:bg-neutral-800"
                                >
                                  Перенести урок
                                </Link>
                              )
                            ) : isInactive ? (
                              <PayOrTransferFlow
                                locale={String(locale)}
                                toTutorId={tutorId}
                                toTutorName={tutorName}
                                toRateCents={Math.max(0, Math.round(rateCents || 0))}
                                buttonText="Купити уроки"
                                autoSkipMethod={false}
                                onSuccessHref={`/${locale}/dashboard?tab=subscriptions#schedule`}
                              />
                            ) : canSchedule ? (
                              <Link
                                href={`/${locale}/schedule/${encodeURIComponent(tutorId)}`}
                                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-white hover:bg-emerald-600"
                              >
                                Запланувати уроки
                              </Link>
                            ) : (
                              <button
                                type="button"
                                disabled
                                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-neutral-200 px-5 text-sm font-semibold text-neutral-600 cursor-not-allowed"
                              >
                                Запланувати уроки
                              </button>
                            )
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            );

          */}
        </div>
      </section>
    </main>
  );
}
