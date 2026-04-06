"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isLocale, defaultLocale, Locale } from "@/lib/i18n";

export default function PracticePage() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const locale: Locale = isLocale(parts[0]) ? (parts[0] as Locale) : defaultLocale;
  return (
    <main className="container mx-auto px-4 py-10">
      <h1 className="text-3xl font-semibold mb-2">Практика</h1>
      <p className="text-muted-foreground mb-6">Щоденні завдання, слова, відео, тексти, пошук, прогрес та рюкзак.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href={`/${locale}/practice/daily`} className="border rounded-lg p-4 bg-white hover:bg-neutral-50">
          <div className="text-sm text-neutral-500 mb-1">📅</div>
          <div className="font-medium">Щоденні завдання</div>
          <div className="text-sm text-neutral-500">5–8 коротких вправ щодня</div>
        </Link>
        <Link href={`/${locale}/practice/vocabulary`} className="border rounded-lg p-4 bg-white hover:bg-neutral-50">
          <div className="text-sm text-neutral-500 mb-1">🔤</div>
          <div className="font-medium">Вивчати нові слова</div>
          <div className="text-sm text-neutral-500">Категорії, блоки по 8 слів</div>
        </Link>
        <Link href={`/${locale}/practice/video`} className="border rounded-lg p-4 bg-white hover:bg-neutral-50">
          <div className="text-sm text-neutral-500 mb-1">🎬</div>
          <div className="font-medium">Відео‑практика</div>
          <div className="text-sm text-neutral-500">Кліпи 10–60с + субтитри + вправи</div>
        </Link>
        <Link href={`/${locale}/practice/library`} className="border rounded-lg p-4 bg-white hover:bg-neutral-50">
          <div className="text-sm text-neutral-500 mb-1">📚</div>
          <div className="font-medium">Бібліотека</div>
          <div className="text-sm text-neutral-500">Короткі тексти A1–B2 + питання</div>
        </Link>
        <Link href={`/${locale}/practice/search`} className="border rounded-lg p-4 bg-white hover:bg-neutral-50">
          <div className="text-sm text-neutral-500 mb-1">🔍</div>
          <div className="font-medium">Пошук практики</div>
          <div className="text-sm text-neutral-500">Слова, теми, відео, тексти</div>
        </Link>
        <Link href={`/${locale}/practice/progress`} className="border rounded-lg p-4 bg-white hover:bg-neutral-50">
          <div className="text-sm text-neutral-500 mb-1">📈</div>
          <div className="font-medium">Прогрес</div>
          <div className="text-sm text-neutral-500">XP, streak, слова, відео, тексти</div>
        </Link>
        <Link href={`/${locale}/practice/backpack`} className="border rounded-lg p-4 bg-white hover:bg-neutral-50">
          <div className="text-sm text-neutral-500 mb-1">🎒</div>
          <div className="font-medium">Рюкзак (домашка)</div>
          <div className="text-sm text-neutral-500">Завдання від вчителя</div>
        </Link>
      </div>
    </main>
  );
}
