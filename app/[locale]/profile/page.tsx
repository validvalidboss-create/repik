import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isLocale, type Locale, defaultLocale } from "@/lib/i18n";
import TutorListingControls from "@/components/TutorListingControls";
import SignOutButton from "@/components/SignOutButton";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const currentLocale: Locale = isLocale(locale) ? (locale as Locale) : defaultLocale;

  const session = await auth();
  const user = session?.user as any;

  if (!user) {
    return (
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold mb-3">Профіль</h1>
        <p className="text-sm text-neutral-600 mb-4">Увійдіть, щоб переглянути свій профіль та налаштування.</p>
        <Link
          href={`/${currentLocale}/sign-in`}
          className="inline-flex items-center rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Увійти
        </Link>
      </main>
    );
  }

  const userId = String(user.id || "");
  const adminEmail = (process.env.ADMIN_EMAIL || "").trim();
  const isAdmin =
    !!adminEmail && !!user?.email && String(user.email).toLowerCase() === String(adminEmail).toLowerCase();
  let tutor: any = null;
  let dbError: string | null = null;
  try {
    tutor = userId ? await prisma.tutor.findFirst({ where: { userId } }) : null;
  } catch (e) {
    dbError = (e as Error).message;
    tutor = null;
  }
  if (tutor && !tutor.moderationNote) {
    try {
      const rows = (await prisma.$queryRaw`
        SELECT "moderationNote" as "moderationNote"
        FROM "Tutor"
        WHERE "id" = ${tutor.id}
        LIMIT 1
      `) as any[];
      const note = rows?.[0]?.moderationNote;
      if (typeof note === "string" && note.trim().length > 0) {
        tutor.moderationNote = note;
      }
    } catch (e) {
      dbError = dbError || (e as Error).message;
    }
  }
  const isTutor = !!tutor;
  const canManageTutorProfile = !isAdmin && (user?.role === "TUTOR" || isTutor);

  let listingStatus: "pending" | "active" | "rejected" | "needs_revision" | "paused" | "draft" | "none" = "none";
  if (tutor && Array.isArray(tutor.tracks)) {
    const tracksArr = tutor.tracks as string[];
    const statusTag = tracksArr.find((t) => typeof t === "string" && t.startsWith("status:"));
    if (statusTag) {
      if (statusTag.includes("active")) listingStatus = "active";
      else if (statusTag.includes("rejected")) listingStatus = "rejected";
      else if (statusTag.includes("needs_revision")) listingStatus = "needs_revision";
      else if (statusTag.includes("pending")) listingStatus = "pending";
      else if (statusTag.includes("paused")) listingStatus = "paused";
      else if (statusTag.includes("draft")) listingStatus = "draft";
    }
  }

  const showDevSelfApprove = process.env.NODE_ENV !== "production" && listingStatus === "pending";

  return (
    <main className="container mx-auto px-4 py-8 space-y-8">
      <section>
        <h1 className="text-2xl font-semibold mb-3">Профіль</h1>
        {dbError ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            База даних зараз недоступна. Перевірте DATABASE_URL / підключення до Neon і перезапустіть dev-сервер.
          </div>
        ) : null}
        <div className="rounded-lg border bg-white p-4 flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-neutral-200" />
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{user.name || user.email}</div>
            <div className="text-xs text-neutral-500 truncate">{user.email}</div>
          </div>
        </div>
      </section>

      {/* Профиль учителя / анкета викладача */}
      {canManageTutorProfile && (
        <section className="rounded-lg border bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold mb-1">Моя анкета</h2>
              <p className="text-sm text-neutral-600">
                Створіть або відредагуйте свою публічну анкету, яку бачитимуть учні в пошуку.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isTutor && tutor ? (
                <TutorListingControls locale={currentLocale} status={listingStatus} />
              ) : null}
            {listingStatus === "pending" && (
              <span className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700 border border-dashed border-neutral-300">
                Анкета на модерації (не активна)
              </span>
            )}
            {listingStatus === "needs_revision" && (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 border border-amber-200">
                Анкета потребує правок
              </span>
            )}
            {listingStatus === "rejected" && (
              <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 border border-red-200">
                Анкету відхилено
              </span>
            )}
            {listingStatus === "active" && (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 border border-emerald-100">
                Анкета активна
              </span>
            )}
            {listingStatus === "paused" && (
              <span className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700 border border-neutral-200">
                Анкета призупинена
              </span>
            )}
            {listingStatus === "draft" && (
              <span className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700 border border-neutral-200">
                Анкета не активна
              </span>
            )}
            </div>
          </div>

          {(listingStatus === "paused" || listingStatus === "draft") && (
            <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800">
              Ваша анкета зараз не активна.
            </div>
          )}
          {(listingStatus === "rejected" || listingStatus === "needs_revision") && (
            <div
              className={
                listingStatus === "needs_revision"
                  ? "mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                  : "mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
              }
            >
              <div className="font-medium mb-1">
                {listingStatus === "needs_revision" ? "Потрібні правки" : "Анкету відхилено"}
              </div>
              <div className="whitespace-pre-wrap">
                {tutor?.moderationNote ? tutor.moderationNote : "Причина: —"}
              </div>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-3 items-center">
            {userId && (
              <Link
                href={`/${currentLocale}/teacher/onboarding`}
                className="inline-flex items-center rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
              >
                {isTutor ? "Змінити анкету" : "Створити анкету"}
              </Link>
            )}

            {showDevSelfApprove ? (
              <form action="/api/teacher/dev-self-approve" method="POST">
                <button
                  type="submit"
                  className="inline-flex items-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
                >
                  Схвалити анкету (dev)
                </button>
              </form>
            ) : null}
            {isTutor && tutor && listingStatus === "active" && (
              <Link
                href={`/${currentLocale}/tutors/${encodeURIComponent(tutor.id)}`}
                className="text-xs underline text-neutral-700 hover:text-neutral-900"
              >
                Перейти до анкети викладача
              </Link>
            )}
            {isTutor && tutor && listingStatus !== "active" && (
              <span className="text-xs text-neutral-400">
                Перейти до анкети викладача (не активна)
              </span>
            )}
            <p className="text-xs text-neutral-500 max-w-md">
              Після переходу ви зможете заповнити або відредагувати анкету. Вона підключена до бронювань і чату з учнями.
            </p>
          </div>
        </section>
      )}

      <section className="pt-4">
        <SignOutButton locale={currentLocale} />
      </section>
    </main>
  );
}
