"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useMemo, useRef, useState, useTransition, useEffect } from "react";
import { isLocale, defaultLocale, Locale } from "@/lib/i18n";
import { getMessages } from "@/lib/messages";

export default function CatalogFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // i18n
  const parts = pathname.split("/").filter(Boolean);
  const locale: Locale = isLocale(parts[0]) ? (parts[0] as Locale) : defaultLocale;
  const t = getMessages(locale) as Record<string, string>;

  const [subject, setSubject] = useState(sp.get("subject") || "");
  const [language, setLanguage] = useState(sp.get("language") || "");
  const subjectsCsv = sp.get("subjects") || "";
  const [subjects, setSubjects] = useState<string[]>(subject ? [subject] : (subjectsCsv ? subjectsCsv.split(",").map((s) => s.trim()).filter(Boolean) : []));
  const [subjectQuery, setSubjectQuery] = useState("");
  const [minPrice, setMinPrice] = useState(sp.get("min") || "");
  const [maxPrice, setMaxPrice] = useState(sp.get("max") || "");
  // USD slider values (5..35)
  const [minUsd, setMinUsd] = useState(sp.get("minUsd") || "");
  const [maxUsd, setMaxUsd] = useState(sp.get("maxUsd") || "");
  // Currency switcher
  const [currency, setCurrency] = useState<("UAH"|"USD")>((sp.get("cur") as any) === "USD" ? "USD" : "UAH");
  const [sort, setSort] = useState(sp.get("sort") || "relevance");
  // Additional supported filters by schema: rating/ratingCount/video/media
  const [ratingMin, setRatingMin] = useState(sp.get("ratingMin") || "");
  const [reviewsMin, setReviewsMin] = useState(sp.get("reviewsMin") || "");
  const [hasVideo, setHasVideo] = useState(sp.get("hasVideo") === "1");
  const [hasMedia, setHasMedia] = useState(sp.get("hasMedia") === "1");
  const [pro, setPro] = useState(sp.get("pro") === "1");
  const [superTutor, setSuperTutor] = useState(sp.get("super") === "1");
  const [onlyFavorites, setOnlyFavorites] = useState(sp.get("fav") === "1");
  const [freeFirst, setFreeFirst] = useState(sp.get("freeFirst") === "1");
  // Availability filters
  const daysParam = sp.get("days") || ""; // comma-separated 0..6 (Sun..Sat)
  const [days, setDays] = useState<string[]>(daysParam ? daysParam.split(",") : []);
  const [slot, setSlot] = useState(sp.get("slot") || ""); // morn|day|eve|night
  // Direction (subject-linked): token like dir:english:conversation
  const dirCsv = sp.get("dir") || "";
  const [dir, setDir] = useState<string[]>(dirCsv ? dirCsv.split(",").map((s) => s.trim()).filter(Boolean) : []);

  // Drawers (TSUM-style)
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  // Top-bar popovers
  const [menuType, setMenuType] = useState<null | "language" | "currency" | "sort" | "subjects" | "direction" | "schedule" | "price" >(null);
  const [menuPos, setMenuPos] = useState<{x:number;y:number}>({x:0,y:0});
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuType(null);
    }
    if (menuType) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuType]);

  useEffect(() => {
    function onFocus() {
      try {
        const dirty = window.sessionStorage?.getItem("favoritesDirty") === "1";
        if (!dirty) return;
        window.sessionStorage?.removeItem("favoritesDirty");
        router.refresh();
      } catch {
        // ignore
      }
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [router]);
  function openMenu(type: typeof menuType, ev: React.MouseEvent<HTMLButtonElement>) {
    const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPos({ x: r.left, y: r.bottom + 6 });
    setFiltersOpen(false);
    setMenuType(type);
  }
  // Which section to scroll to when opening drawer
  const [focusSection, setFocusSection] = useState<"language" | "price" | "other" | null>(null);
  const langRef = useRef<HTMLDivElement | null>(null);
  const priceRef = useRef<HTMLDivElement | null>(null);
  const otherRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (filtersOpen && focusSection) {
      const el = focusSection === "language" ? langRef.current : focusSection === "price" ? priceRef.current : otherRef.current;
      if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  }, [filtersOpen, focusSection]);

  function apply() {
    const params = new URLSearchParams(sp.toString());
    // Single subject only
    const single = String(subject || "").trim();
    if (single) params.set("subject", single);
    else params.delete("subject");
    params.delete("subjects");
    language ? params.set("language", language) : params.delete("language");
    params.delete("q");
    // currency-specific price params
    currency === "UAH" ? (minPrice ? params.set("min", minPrice) : params.delete("min")) : params.delete("min");
    currency === "UAH" ? (maxPrice ? params.set("max", maxPrice) : params.delete("max")) : params.delete("max");
    sort ? params.set("sort", sort) : params.delete("sort");
    ratingMin ? params.set("ratingMin", ratingMin) : params.delete("ratingMin");
    reviewsMin ? params.set("reviewsMin", reviewsMin) : params.delete("reviewsMin");
    hasVideo ? params.set("hasVideo", "1") : params.delete("hasVideo");
    hasMedia ? params.set("hasMedia", "1") : params.delete("hasMedia");
    pro ? params.set("pro", "1") : params.delete("pro");
    superTutor ? params.set("super", "1") : params.delete("super");
    onlyFavorites ? params.set("fav", "1") : params.delete("fav");
    freeFirst ? params.set("freeFirst", "1") : params.delete("freeFirst");
    days.length ? params.set("days", days.join(",")) : params.delete("days");
    slot ? params.set("slot", slot) : params.delete("slot");
    dir.length ? params.set("dir", Array.from(new Set(dir)).join(",")) : params.delete("dir");
    params.delete("tracks");
    if (currency === "USD") {
      minUsd ? params.set("minUsd", minUsd) : params.delete("minUsd");
      maxUsd ? params.set("maxUsd", maxUsd) : params.delete("maxUsd");
    } else {
      params.delete("minUsd");
      params.delete("maxUsd");
    }
    params.set("cur", currency);
    // reset page on filter change
    params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  function clearAll() {
    startTransition(() => router.push(pathname));
  }

  // Auto-apply filters (currency/prices/ratings/etc.).
  const autoTimerRef = useRef<NodeJS.Timeout | null>(null);
  const daysKey = useMemo(() => (Array.isArray(days) ? days.join(",") : ""), [days]);
  const dirKey = useMemo(() => (Array.isArray(dir) ? dir.join(",") : ""), [dir]);
  useEffect(() => {
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    autoTimerRef.current = setTimeout(() => {
      apply();
    }, 300);
    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, language, minPrice, maxPrice, sort, ratingMin, reviewsMin, hasVideo, hasMedia, pro, superTutor, onlyFavorites, freeFirst, daysKey, slot, dirKey, minUsd, maxUsd, currency]);

  const directionOptions = useMemo(() => {
    const subjectKey = String(subject || "").trim();
    if (!subjectKey) return [] as Array<{ key: string; label: string }>;
    const languageSubjects = new Set(["english", "french", "german", "italian", "spanish", "polish", "ukrainian", "czech", "korean"]);
    const isLang = languageSubjects.has(subjectKey);
    const opts = isLang
      ? [
          { key: "conversation", label: "Розмовна мова" },
          { key: "kids", label: "Для дітей" },
          { key: "grade_5_9", label: "5–9 клас" },
          { key: "grade_10_11", label: "10–11 клас" },
          { key: "nmt", label: "Підготовка НМТ/ЗНО" },
          { key: "olympiads", label: "Олімпіади" },
        ]
      : [
          { key: "school", label: "Шкільна програма" },
          { key: "kids", label: "Для дітей" },
          { key: "primary_1_4", label: "1–4 клас" },
          { key: "grade_5_9", label: "5–9 клас" },
          { key: "grade_10_11", label: "10–11 клас" },
          { key: "dpa", label: "Підготовка до ДПА" },
          { key: "nmt", label: "Підготовка НМТ/ЗНО" },
          { key: "olympiads", label: "Олімпіади" },
        ];
    return opts;
  }, [subject]);

  const directionOptionsKey = useMemo(() => directionOptions.map((o) => o.key).join(","), [directionOptions]);

  useEffect(() => {
    const subjectKey = String(subject || "").trim();
    if (!subjectKey) {
      if (dir.length) setDir([]);
      return;
    }
    const allowed = new Set(directionOptions.map((o) => o.key));
    const next = dir.filter((d) => {
      if (!d.startsWith(`dir:${subjectKey}:`)) return false;
      const parts = String(d).split(":");
      const key = parts.length >= 3 ? String(parts[2] || "") : "";
      return allowed.has(key);
    });
    if (next.length !== dir.length) setDir(next);
  }, [subject, dirKey, directionOptionsKey]);

  const priceChipLabel = useMemo(() => {
    const base = t["filters.price"] || "Ціна";
    if (currency === "USD") {
      const mx = Number(maxUsd || 0);
      if (!mx) return base;
      const txt = mx >= 35 ? "35+" : String(mx);
      return `${base}: до $${txt}`;
    } else {
      const mx = Number(maxPrice || 0);
      if (!mx) return base;
      const txt = mx >= 1500 ? "1500+" : String(mx);
      return `${base}: до ${txt}₴`;
    }
  }, [currency, maxUsd, maxPrice, t]);

  const directionLabel = useMemo(() => {
    if (!dir.length) return "Будь-який";
    if (dir.length === 1) {
      const parts = String(dir[0]).split(":");
      const key = parts.length >= 3 ? String(parts[2] || "") : "";
      const opt = directionOptions.find((o) => o.key === key);
      return opt?.label || "Будь-який";
    }
    return `${dir.length} напрями`;
  }, [dir, directionOptions]);

  const languageFlag = (code: string) => {
    const c = String(code || "").trim().toLowerCase();
    const map: Record<string, string> = {
      en: "🇬🇧",
      fr: "🇫🇷",
      de: "🇩🇪",
      it: "🇮🇹",
      es: "🇪🇸",
      pl: "🇵🇱",
      uk: "🇺🇦",
    };
    return map[c] || "";
  };

  const subjectsLabel = useMemo(() => {
    if (!subject) return "Будь-який предмет";
    const map: Record<string, string> = {
      english: "Англійська",
      ukrainian: "Українська мова",
      math: "Математика",
      physics: "Фізика",
      chemistry: "Хімія",
      biology: "Біологія",
      history: "Історія",
      geography: "Географія",
    };
    return map[String(subject)] || String(subject);
  }, [subject]);

  const scheduleLabel = useMemo(() => {
    if (!days.length && !slot) return "Будь-коли";
    if (days.length && slot) return "Дні + час";
    if (days.length) return "У ці дні";
    return "За часом";
  }, [days, slot]);

  const sortLabel = useMemo(() => {
    const map: Record<string, string> = {
      relevance: "Рекомендовані",
      price_asc: "Дешевші",
      price_desc: "Дорожчі",
      rating_desc: "Найкращі",
    };
    return map[sort] || "Рекомендовані";
  }, [sort]);

  return (
    <div className="mb-6">
      <div className="flex flex-wrap gap-2">
        <button
          className="h-11 w-[200px] sm:w-[220px] max-w-full px-3 rounded-xl border border-neutral-200 bg-white text-left hover:border-neutral-300"
          onClick={(e) => openMenu("subjects", e)}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] text-neutral-500 leading-4">Я хочу вивчати</div>
              <div className="text-sm font-medium truncate">{subjectsLabel}</div>
            </div>
            <div className="text-neutral-500">▾</div>
          </div>
        </button>

        <button
          className={`h-11 w-[200px] sm:w-[220px] max-w-full px-3 rounded-xl border bg-white text-left hover:border-neutral-300 ${subject ? "border-neutral-200" : "border-neutral-100 opacity-60"}`}
          onClick={(e) => {
            if (!subject) return;
            openMenu("direction", e);
          }}
          aria-disabled={!subject}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] text-neutral-500 leading-4">Напрямки навчання</div>
              <div className="text-sm font-medium truncate">{subject ? directionLabel : "Оберіть предмет"}</div>
            </div>
            <div className="text-neutral-500">▾</div>
          </div>
        </button>

        <button
          className="h-11 w-[200px] sm:w-[220px] max-w-full px-3 rounded-xl border border-neutral-200 bg-white text-left hover:border-neutral-300"
          onClick={(e) => openMenu("price", e)}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] text-neutral-500 leading-4">Ціна за урок</div>
              <div className="text-sm font-medium truncate">{priceChipLabel}</div>
            </div>
            <div className="text-neutral-500">▾</div>
          </div>
        </button>

        <button
          className="h-11 w-[200px] sm:w-[220px] max-w-full px-3 rounded-xl border border-neutral-200 bg-white text-left hover:border-neutral-300"
          onClick={(e) => openMenu("language", e)}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] text-neutral-500 leading-4">Також володіє</div>
              <div className="text-sm font-medium truncate">{language ? language.toUpperCase() : "Будь-яка мова"}</div>
            </div>
            <div className="text-neutral-500">▾</div>
          </div>
        </button>

        <button
          className="h-11 w-[200px] sm:w-[220px] max-w-full px-3 rounded-xl border border-neutral-200 bg-white text-left hover:border-neutral-300"
          onClick={(e) => openMenu("schedule", e)}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] text-neutral-500 leading-4">Я хочу займатися</div>
              <div className="text-sm font-medium truncate">{scheduleLabel}</div>
            </div>
            <div className="text-neutral-500">▾</div>
          </div>
        </button>
        <button
          className="h-11 w-[200px] sm:w-[220px] max-w-full px-3 rounded-xl border border-neutral-200 bg-white text-left hover:border-neutral-300"
          onClick={(e) => openMenu("sort", e)}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] text-neutral-500 leading-4">Сортувати</div>
              <div className="text-sm font-medium truncate">{sortLabel}</div>
            </div>
            <div className="text-neutral-500">▾</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setFreeFirst((v) => !v)}
          className={`h-11 w-[200px] sm:w-[220px] max-w-full px-3 rounded-xl border text-left hover:border-neutral-300 ${freeFirst ? "border-black bg-black text-white" : "border-neutral-200 bg-white"}`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className={`text-[10px] leading-4 ${freeFirst ? "text-white/80" : "text-neutral-500"}`}>Пробний урок</div>
              <div className="text-sm font-medium truncate">Перший безкоштовно</div>
            </div>
            <div className={`${freeFirst ? "text-white/80" : "text-neutral-500"}`}>{freeFirst ? "✓" : ""}</div>
          </div>
        </button>
      </div>

      {menuType && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-white border rounded-lg shadow-xl text-sm min-w-[180px] overflow-hidden"
          style={{ left: menuPos.x, top: menuPos.y }}
        >
          {menuType === "language" && (
            <div className="p-1">
              {["en", "fr", "de", "it", "es", "pl", "uk"].map((code) => (
                <button
                  key={code}
                  onClick={() => {
                    setLanguage(language === code ? "" : code);
                    setMenuType(null);
                  }}
                  className={`block w-full text-left px-3 py-2 hover:bg-neutral-100 ${language === code ? "font-medium" : ""}`}
                >
                  <span className="inline-flex items-center gap-2">
                    <span className="w-5 inline-flex justify-center">{languageFlag(code)}</span>
                    <span>{code.toUpperCase()}</span>
                  </span>
                </button>
              ))}
              <div className="border-t my-1" />
              <button
                onClick={() => {
                  setLanguage("");
                  setMenuType(null);
                }}
                className="block w-full text-left px-3 py-2 text-neutral-600 hover:bg-neutral-100"
              >
                {t["common.clear"] || "Очистити"}
              </button>
            </div>
          )}

          {menuType === "direction" && (
            <div className="max-h-[70vh] overflow-y-auto overscroll-contain p-1">
              {!subject ? (
                <div className="px-3 py-3 text-sm text-neutral-600">Оберіть предмет, щоб вибрати напрямок.</div>
              ) : (
                <>
                  {directionOptions.map((o) => {
                    const token = `dir:${String(subject)}:${o.key}`;
                    const active = dir.includes(token);
                    return (
                      <button
                        key={o.key}
                        onClick={() => {
                          setDir((prev) => (active ? prev.filter((x) => x !== token) : [...prev, token]));
                        }}
                        className={`block w-full text-left px-3 py-2 hover:bg-neutral-100 ${active ? "font-medium" : ""}`}
                      >
                        <span className="inline-flex items-center justify-between w-full gap-3">
                          <span className="truncate">{o.label}</span>
                          <span className="text-neutral-700">{active ? "✓" : ""}</span>
                        </span>
                      </button>
                    );
                  })}
                  <div className="border-t my-1" />
                  <button
                    onClick={() => {
                      setDir([]);
                    }}
                    className="block w-full text-left px-3 py-2 text-neutral-600 hover:bg-neutral-100"
                  >
                    {t["common.clear"] || "Очистити"}
                  </button>
                  <button
                    onClick={() => setMenuType(null)}
                    className="block w-full text-left px-3 py-2 font-medium hover:bg-neutral-100"
                  >
                    {t["common.done"] || "Готово"}
                  </button>
                </>
              )}
            </div>
          )}

          {menuType === "price" && (
            <div className="p-3 w-[280px]">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">{t["filters.price.label"] || "Ціна за урок"}</div>
                <div className="inline-flex border rounded-full overflow-hidden text-xs">
                  <button
                    className={`px-2 py-1 ${currency === "UAH" ? "bg-black text-white" : "bg-white"}`}
                    onClick={() => setCurrency("UAH")}
                  >
                    UAH
                  </button>
                  <button
                    className={`px-2 py-1 ${currency === "USD" ? "bg-black text-white" : "bg-white"}`}
                    onClick={() => setCurrency("USD")}
                  >
                    USD
                  </button>
                </div>
              </div>
              {currency === "USD" ? (
                <>
                  <div className="text-xs text-neutral-600 mb-2">
                    USD: до {(Number(maxUsd || 35) >= 35 ? "35+" : maxUsd || "35")}
                  </div>
                  <input
                    type="range"
                    min={3}
                    max={35}
                    step={1}
                    value={Number(maxUsd || 35)}
                    onChange={(e) => {
                      setMinUsd("");
                      setMaxUsd(String(Number(e.target.value)));
                    }}
                    className="w-full"
                  />
                </>
              ) : (
                <>
                  <div className="text-xs text-neutral-600 mb-2">
                    UAH: до {(Number(maxPrice || 1500) >= 1500 ? "1500+" : maxPrice || "1500")}
                  </div>
                  <input
                    type="range"
                    min={150}
                    max={1500}
                    step={10}
                    value={Number(maxPrice || 1500)}
                    onChange={(e) => {
                      setMinPrice("");
                      setMaxPrice(String(Number(e.target.value)));
                    }}
                    className="w-full"
                  />
                </>
              )}
            </div>
          )}

          {menuType === "subjects" && (
            <div className="max-h-[70vh] overflow-y-auto overscroll-contain p-1">
              {[
                { key: "english", label: "Англійська" },
                { key: "ukrainian", label: "Українська мова" },
                { key: "math", label: "Математика" },
                { key: "physics", label: "Фізика" },
                { key: "chemistry", label: "Хімія" },
                { key: "biology", label: "Біологія" },
                { key: "history", label: "Історія" },
                { key: "geography", label: "Географія" },
              ].map((s) => {
                const active = subject === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => {
                      setSubject(s.key);
                      setSubjects([s.key]);
                      setMenuType(null);
                    }}
                    className={`block w-full text-left px-3 py-2 hover:bg-neutral-100 ${active ? "font-medium" : ""}`}
                  >
                    <span className="inline-flex items-center justify-between w-full gap-3">
                      <span className="truncate">{s.label}</span>
                      <span className="text-neutral-700">{active ? "✓" : ""}</span>
                    </span>
                  </button>
                );
              })}
              <div className="border-t my-1" />
              <button
                onClick={() => {
                  setSubject("");
                  setSubjects([]);
                  setDir([]);
                  setMenuType(null);
                }}
                className="block w-full text-left px-3 py-2 text-neutral-600 hover:bg-neutral-100"
              >
                {t["common.clear"] || "Очистити"}
              </button>
            </div>
          )}

          {menuType === "schedule" && (
            <div className="p-3 w-[360px]">
              <div className="text-xs font-medium text-neutral-900 mb-2">Періоди</div>
              <div className="text-[11px] text-neutral-500 mb-1">Вдень</div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {[
                  { k: "9-12", l: "9-12" },
                  { k: "12-15", l: "12-15" },
                  { k: "15-18", l: "15-18" },
                ].map((p) => (
                  <button
                    key={p.k}
                    type="button"
                    onClick={() => {
                      setSlot(slot === p.k ? "" : p.k);
                      setMenuType(null);
                    }}
                    className={`h-11 rounded-xl border text-sm ${slot === p.k ? "bg-black text-white border-black" : "bg-white border-neutral-200"}`}
                  >
                    {p.l}
                  </button>
                ))}
              </div>

              <div className="text-[11px] text-neutral-500 mb-1">Увечері й вночі</div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {[
                  { k: "18-21", l: "18-21" },
                  { k: "21-24", l: "21-24" },
                  { k: "0-3", l: "0-3" },
                ].map((p) => (
                  <button
                    key={p.k}
                    type="button"
                    onClick={() => {
                      setSlot(slot === p.k ? "" : p.k);
                      setMenuType(null);
                    }}
                    className={`h-11 rounded-xl border text-sm ${slot === p.k ? "bg-black text-white border-black" : "bg-white border-neutral-200"}`}
                  >
                    {p.l}
                  </button>
                ))}
              </div>

              <div className="text-[11px] text-neutral-500 mb-1">Вранці</div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { k: "3-6", l: "3-6" },
                  { k: "6-9", l: "6-9" },
                ].map((p) => (
                  <button
                    key={p.k}
                    type="button"
                    onClick={() => {
                      setSlot(slot === p.k ? "" : p.k);
                      setMenuType(null);
                    }}
                    className={`h-11 rounded-xl border text-sm ${slot === p.k ? "bg-black text-white border-black" : "bg-white border-neutral-200"}`}
                  >
                    {p.l}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setSlot("");
                    setMenuType(null);
                  }}
                  className="h-11 rounded-xl border border-neutral-200 bg-white text-sm text-neutral-700"
                >
                  Будь-коли
                </button>
              </div>

              <div className="text-xs font-medium text-neutral-900 mb-2">Дні</div>
              <div className="grid grid-cols-7 gap-2">
                {[
                  { k: "0", l: "Нд" },
                  { k: "1", l: "Пн" },
                  { k: "2", l: "Вт" },
                  { k: "3", l: "Ср" },
                  { k: "4", l: "Чт" },
                  { k: "5", l: "Пт" },
                  { k: "6", l: "Сб" },
                ].map((d) => {
                  const active = days.includes(d.k);
                  return (
                    <button
                      key={d.k}
                      type="button"
                      onClick={() => {
                        setDays((prev) => (active ? (prev || []).filter((x) => x !== d.k) : Array.from(new Set([...(prev || []), d.k]))));
                      }}
                      className={`h-9 rounded-xl border text-xs ${active ? "bg-black text-white border-black" : "bg-white border-neutral-200"}`}
                    >
                      {d.l}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setDays([]);
                    setSlot("");
                    setMenuType(null);
                  }}
                  className="text-xs text-neutral-600 underline"
                >
                  Очистити
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuType(null);
                    apply();
                  }}
                  className="h-9 px-3 rounded-xl bg-black text-white text-xs"
                >
                  Застосувати
                </button>
              </div>
            </div>
          )}

          {menuType === "sort" && (
            <div className="p-1">
              {[
                { v: "relevance", l: t["filters.sort.relevance"] || "Relevance" },
                { v: "price_asc", l: t["filters.sort.price_asc"] || "Price: low first" },
                { v: "price_desc", l: t["filters.sort.price_desc"] || "Price: high first" },
                { v: "rating_desc", l: t["filters.sort.rating_desc"] || "Rating" },
              ].map((o) => (
                <button
                  key={o.v}
                  onClick={() => {
                    setSort(o.v);
                    setMenuType(null);
                  }}
                  className={`block w-full text-left px-3 py-2 hover:bg-neutral-100 ${sort === o.v ? "font-medium" : ""}`}
                >
                  {o.l}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
