import Link from "next/link";
import { auth } from "@/lib/auth";
import { isLocale, type Locale, defaultLocale } from "@/lib/i18n";
import TutorScheduleQuickEditor from "@/components/TutorScheduleQuickEditor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function TeacherSchedulePage({
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
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold mb-3">Графік</h1>
        <p className="text-sm text-neutral-600 mb-4">Увійдіть, щоб редагувати графік доступності.</p>
        <Link
          href={`/${currentLocale}/sign-in`}
          className="inline-flex items-center rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Увійти
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Швидке редагування графіка</h1>
          <p className="text-sm text-neutral-600">Зміни тут одразу вплинуть на доступні слоти для бронювання.</p>
        </div>
      </header>

      <TutorScheduleQuickEditor locale={currentLocale} />
    </main>
  );
}
