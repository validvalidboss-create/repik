"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { isLocale, Locale, defaultLocale } from "@/lib/i18n";

function tabActive(pathname: string, href: string) {
  if (!href) return false;
  // consider startsWith for sections
  return pathname === href || pathname.startsWith(href + "#") || pathname.startsWith(href + "/");
}

export default function MobileTabs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const locale: Locale = isLocale(parts[0]) ? (parts[0] as Locale) : defaultLocale;
  const tabs = [
    { key: "dashboard", label: "Кабінет", href: `/${locale}/dashboard` },
    { key: "search", label: "Пошук", href: `/${locale}/catalog` },
    { key: "chat", label: "Чат", href: `/${locale}/chat` },
    { key: "schedule", label: "Розклад", href: `/${locale}/dashboard#schedule` },
    { key: "practice", label: "Практика", href: `/${locale}/practice` },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white md:hidden">
      <div className="grid grid-cols-5 text-xs">
        {tabs.map((t) => {
          const active = tabActive(pathname, t.href);
          return (
            <Link
              key={t.key}
              prefetch={false}
              href={t.href}
              className={`flex flex-col items-center justify-center py-2 ${active ? "text-black" : "text-neutral-500"}`}
            >
              <span className={`px-2 py-0.5 rounded-full ${active ? "bg-black text-white" : "bg-transparent"}`}>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
