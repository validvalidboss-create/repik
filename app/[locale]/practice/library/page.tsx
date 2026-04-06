"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isLocale, defaultLocale, Locale } from "@/lib/i18n";

const LEVELS = [
  { code: "A1", title: "Beginner" },
  { code: "A2", title: "Elementary" },
  { code: "B1", title: "Intermediate" },
  { code: "B2", title: "Upper-Intermediate" },
  { code: "C1", title: "Advanced" },
  { code: "C2", title: "Proficient" },
];

export default function LibraryPage() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const locale: Locale = isLocale(parts[0]) ? (parts[0] as Locale) : defaultLocale;
  return (
    <main className="container mx-auto px-4 py-10">
      <div className="mb-4"><Link href={`/${locale}/practice`} className="text-sm text-neutral-600">← Бібліотека 📚</Link></div>
      <h1 className="text-2xl font-semibold mb-2">Вибір рівня</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {LEVELS.map((l) => (
          <Link key={l.code} href={`/${locale}/practice/library/${l.code}`} className="rounded-2xl border bg-white hover:shadow p-5">
            <div className="text-2xl font-semibold">{l.code}</div>
            <div className="text-sm text-neutral-600">{l.title}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
