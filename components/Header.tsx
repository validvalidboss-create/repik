"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { isLocale, Locale, defaultLocale } from "@/lib/i18n";

export default function Header({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  if (pathname.includes("/lesson/")) return null;
  const parts = pathname.split("/").filter(Boolean);
  const currentLocale: Locale = isLocale(parts[0]) ? (parts[0] as Locale) : defaultLocale;

  const { data: session } = useSession();
  const role = String((session?.user as any)?.role || "").toUpperCase();
  const isTutorRole = role === "TUTOR";
  const showBalance = !isAdmin && role !== "TUTOR";

  const [moneyTotalCents, setMoneyTotalCents] = useState<number | null>(null);
  const [byTutor, setByTutor] = useState<
    Array<{ tutorId: string; tutorName: string; tutorImage: string | null; valueCents: number; credits: number; rateCents: number }>
  >([]);
  const [trialRemaining, setTrialRemaining] = useState<number | null>(null);
  const [balOpen, setBalOpen] = useState(false);
  const balRootRef = useRef<HTMLDivElement>(null);
  const reloadBalRef = useRef<null | (() => void)>(null);

  const balanceLabel = useMemo(() => {
    const cents = typeof moneyTotalCents === "number" && Number.isFinite(moneyTotalCents) ? moneyTotalCents : 0;
    const uah = Math.max(0, Math.round(cents / 100));
    return `Баланс: ₴${uah}`;
  }, [moneyTotalCents]);

  const trialLabel = useMemo(() => {
    const n = typeof trialRemaining === "number" && Number.isFinite(trialRemaining) ? trialRemaining : 0;
    const suffix = n === 1 ? "" : n >= 2 && n <= 4 ? "и" : "ів";
    return `Пробні: ${n} урок${suffix}`;
  }, [trialRemaining]);

  useEffect(() => {
    if (!showBalance) return;
    let mounted = true;
    async function load() {
      try {
        const [trialRes, lessonRes] = await Promise.all([
          fetch("/api/trial-balance", { cache: "no-store" }),
          fetch("/api/lesson-balance", { cache: "no-store" }),
        ]);

        const trialData = await trialRes.json().catch(() => null);
        const lessonData = await lessonRes.json().catch(() => null);
        if (!mounted) return;

        if (!trialRes.ok || !trialData?.ok) setTrialRemaining(0);
        else setTrialRemaining(Number(trialData?.remaining ?? 0) || 0);

        if (!lessonRes.ok || !lessonData?.ok) setMoneyTotalCents(0);
        else {
          setMoneyTotalCents(Number(lessonData?.totalValueCents ?? 0) || 0);
          setByTutor(Array.isArray(lessonData?.byTutor) ? lessonData.byTutor : []);
        }
      } catch {
        if (!mounted) return;
        setTrialRemaining(0);
        setMoneyTotalCents(0);
        setByTutor([]);
      }
    }

    reloadBalRef.current = load;
    load();

    function onBalanceChanged() {
      load();
    }
    window.addEventListener("lesson-balance-changed", onBalanceChanged);
    window.addEventListener("trial-balance-changed", onBalanceChanged);

    return () => {
      mounted = false;
      reloadBalRef.current = null;
      window.removeEventListener("lesson-balance-changed", onBalanceChanged);
      window.removeEventListener("trial-balance-changed", onBalanceChanged);
    };
  }, [showBalance]);

  useEffect(() => {
    if (!showBalance) return;
    if (!balOpen) return;
    try {
      reloadBalRef.current?.();
    } catch {
      // ignore
    }
  }, [balOpen, showBalance]);

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      const root = balRootRef.current;
      if (!root) return;
      if (root.contains(e.target as Node)) return;
      setBalOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setBalOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link prefetch={false} href={`/${currentLocale}`} className="font-semibold tracking-tight">Repetitir</Link>
          <nav className="flex items-center gap-3 text-xs sm:text-sm overflow-x-auto">
            <Link prefetch={false} href={`/${currentLocale}/catalog`} className="whitespace-nowrap hover:underline">Пошук</Link>
            {isAdmin ? (
              <>
                <Link prefetch={false} href={`/${currentLocale}/admin/tutors`} className="whitespace-nowrap hover:underline">Модерація анкет</Link>
                <Link prefetch={false} href={`/${currentLocale}/admin/issues`} className="whitespace-nowrap hover:underline">Спори</Link>
                <Link prefetch={false} href={`/${currentLocale}/profile`} className="whitespace-nowrap hover:underline">Профіль</Link>
                <Link prefetch={false} href={`/${currentLocale}/chat`} className="whitespace-nowrap hover:underline">Чат</Link>
              </>
            ) : (
              <>
                <Link prefetch={false} href={`/${currentLocale}/practice`} className="whitespace-nowrap hover:underline">Практика</Link>
                <Link prefetch={false} href={`/${currentLocale}/profile`} className="whitespace-nowrap hover:underline">Профіль</Link>
                <Link prefetch={false} href={`/${currentLocale}/chat`} className="whitespace-nowrap hover:underline">Чат</Link>
                <Link prefetch={false} href={`/${currentLocale}/dashboard#schedule`} className="whitespace-nowrap hover:underline">Розклад</Link>
                {isTutorRole ? (
                  <Link
                    prefetch={false}
                    href={`/${currentLocale}/dashboard?tab=payouts#schedule`}
                    className="whitespace-nowrap hover:underline"
                  >
                    Виплати
                  </Link>
                ) : null}
              </>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin ? (
            <Link
              prefetch={false}
              href={`/${currentLocale}/admin/tutors`}
              className="inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-3 text-xs sm:text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              Модерація анкет
            </Link>
          ) : null}
          {showBalance ? (
            <div ref={balRootRef} className="relative">
              <button
                type="button"
                onClick={() => setBalOpen((v) => !v)}
                className="inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-3 text-xs sm:text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
              >
                {balanceLabel}
              </button>

              {balOpen ? (
                <div className="absolute right-0 mt-2 w-[280px] rounded-2xl border border-neutral-200 bg-white p-3 shadow-xl">
                  <div className="text-xs text-neutral-500">Ваш баланс</div>
                  <div className="mt-1 text-base font-semibold text-neutral-900">{trialLabel}</div>

                  {Array.isArray(byTutor) && byTutor.length > 0 ? (
                    <div className="mt-3">
                      <div className="text-xs font-medium text-neutral-500">По викладачам</div>
                      <div className="mt-2 space-y-2">
                        {byTutor.slice(0, 6).map((t) => {
                          const cents = Number((t as any)?.valueCents ?? 0) || 0;
                          const uah = Math.max(0, Math.round(cents / 100));
                          const name = String((t as any)?.tutorName || "Репетитор");
                          const img = ((t as any)?.tutorImage as string | null) ?? null;
                          return (
                            <div key={String((t as any)?.tutorId || name)} className="flex items-center justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-2">
                                <div className="h-8 w-8 overflow-hidden rounded-xl ring-1 ring-neutral-200 bg-white text-neutral-700 flex items-center justify-center text-[11px] font-semibold">
                                  {img ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={img} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    (name || "R").slice(0, 2).toUpperCase()
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium text-neutral-900">{name}</div>
                                </div>
                              </div>
                              <div className="shrink-0 text-sm font-semibold text-neutral-900">₴{uah}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <Link
                    prefetch={false}
                    href={`/${currentLocale}/catalog?freeFirst=1`}
                    className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white hover:bg-neutral-800"
                    onClick={() => setBalOpen(false)}
                  >
                    Знайти пробний урок
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}
          <LanguageSwitcher current={currentLocale} />
        </div>
      </div>
    </header>
  );
}
