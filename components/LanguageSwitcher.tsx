"use client";
import { locales, Locale } from "@/lib/i18n";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

export default function LanguageSwitcher({ current }: { current: Locale }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const restPath = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    return parts.slice(1).join("/");
  }, [pathname]);

  return (
    <div className="flex items-center gap-2 text-sm">
      {locales.map((loc) => (
        <button
          key={loc}
          onClick={() => {
            const qs = searchParams?.toString();
            const query = qs ? `?${qs}` : "";
            router.push(`/${loc}/${restPath}${query}`);
          }}
          className={
            "inline-flex h-8 w-10 items-center justify-center rounded transition-colors font-semibold " +
            (loc === current ? "bg-black text-white" : "bg-transparent underline")
          }
          aria-current={loc === current}
        >
          {loc.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
