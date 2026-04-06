"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import PayOrTransferFlow from "@/components/PayOrTransferFlow";

function MenuIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
      <span className="h-4 w-4" aria-hidden="true">
        {children}
      </span>
    </span>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <path d="M3 10h18" />
      <path d="M5 6h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 3v7h-7" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4h4v16H6z" />
      <path d="M14 4h4v16h-4z" />
    </svg>
  );
}

function IconSwap() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h5v5" />
      <path d="M4 20l7-7" />
      <path d="M21 8c-1.5-3-4.5-5-8-5H4" />
      <path d="M8 21H3v-5" />
      <path d="M20 4l-7 7" />
      <path d="M3 16c1.5 3 4.5 5 8 5h9" />
    </svg>
  );
}

function IconFlag() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22V4" />
      <path d="M4 4h12l-1.5 4L20 12H4" />
    </svg>
  );
}

export default function SubscriptionMoreMenu({
  locale,
  tutorId,
  tutorName,
  tutorRateCents,
  credits,
  paused,
}: {
  locale: string;
  tutorId: string;
  tutorName: string;
  tutorRateCents: number;
  credits: number;
  paused: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [buyMoreNonce, setBuyMoreNonce] = useState<number>(0);
  const [pauseLoading, setPauseLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportType, setReportType] = useState<string>("QUALITY_NOT_AS_EXPECTED");
  const [reportMsg, setReportMsg] = useState<string>("");
  const [reportErr, setReportErr] = useState<string>("");
  const [reportSent, setReportSent] = useState(false);
  const [reportBookingId, setReportBookingId] = useState<string>("");
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const rid = useId();

  function close() {
    setOpen(false);
    setPos(null);
  }

  function closeReport() {
    if (reportLoading) return;
    setReportOpen(false);
    setReportErr("");
    setReportSent(false);
    setReportBookingId("");
    setReportMsg("");
    setReportType("QUALITY_NOT_AS_EXPECTED");
  }

  function hrefScheduleWithPlan() {
    const planLessons = Math.max(1, Math.floor(Number(credits) || 1));
    const planPerWeek = Math.max(1, Math.min(5, Math.ceil(planLessons / 4)));
    const planWeeks = 4;
    const qp = new URLSearchParams({
      planPerWeek: String(planPerWeek),
      planLessons: String(planLessons),
      planWeeks: String(planWeeks),
    });
    return `/${locale}/schedule/${encodeURIComponent(tutorId)}?${qp.toString()}`;
  }

  async function togglePauseSubscription(nextPaused: boolean) {
    if (pauseLoading) return;
    setPauseLoading(true);
    try {
      const res = await fetch("/api/subscriptions/pause", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tutorId, paused: nextPaused }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(String(json?.error || "Failed to pause"));
      }
      close();
      window.location.reload();
    } catch (e) {
      close();
      const msg = e instanceof Error ? e.message : "Failed to pause";
      alert(msg);
    } finally {
      setPauseLoading(false);
    }
  }

  async function openReport() {
    if (reportLoading) return;
    setReportLoading(true);
    setReportErr("");
    try {
      const res = await fetch("/api/subscriptions/report-issue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tutorId,
          type: reportType,
          message: reportMsg,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok || !json?.bookingId) throw new Error(String(json?.error || "Failed"));
      setReportBookingId(String(json.bookingId));
      setReportSent(true);
    } catch (e) {
      setReportErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setReportLoading(false);
    }
  }

  const items = useMemo(() => {
    const hasCredits = Math.max(0, Math.floor(Number(credits) || 0)) > 0;
    const canSchedule = !paused && hasCredits;
    return [
      {
        type: canSchedule ? ("link" as const) : ("disabled" as const),
        href: `/${locale}/schedule/${encodeURIComponent(tutorId)}`,
        label: "Запланувати уроки",
        icon: (
          <MenuIcon>
            <IconCalendar />
          </MenuIcon>
        ),
      },
      {
        type: "button" as const,
        label: "Купити ще уроки",
        onClick: () => {
          close();
          setBuyMoreNonce(Date.now());
        },
        icon: (
          <MenuIcon>
            <IconPlus />
          </MenuIcon>
        ),
      },
      {
        type: canSchedule ? ("link" as const) : ("disabled" as const),
        href: hrefScheduleWithPlan(),
        label: "Змінити план",
        icon: (
          <MenuIcon>
            <IconRefresh />
          </MenuIcon>
        ),
      },
      {
        type: "button" as const,
        label: pauseLoading ? (paused ? "Відновлюємо…" : "Призупиняємо…") : paused ? "Відновити підписку" : "Призупинити підписку",
        onClick: () => togglePauseSubscription(!paused),
        icon: (
          <MenuIcon>
            <IconPause />
          </MenuIcon>
        ),
      },
      {
        type: hasCredits ? ("link" as const) : ("disabled" as const),
        href: `/${locale}/catalog?transferFrom=${encodeURIComponent(String(tutorId))}`,
        label: "Перевести уроки до іншого викладача",
        icon: (
          <MenuIcon>
            <IconSwap />
          </MenuIcon>
        ),
      },
      {
        type: "button" as const,
        label: reportLoading ? "Відкриваємо…" : "Поскаржитись",
        onClick: () => {
          close();
          setReportErr("");
          setReportSent(false);
          setReportBookingId("");
          setReportOpen(true);
        },
        icon: (
          <MenuIcon>
            <IconFlag />
          </MenuIcon>
        ),
      },
    ];
  }, [locale, tutorId, credits, paused, pauseLoading, reportLoading]);

  useEffect(() => {
    const onGlobalOpen = (e: Event) => {
      const ev = e as CustomEvent<{ id: string }>;
      if (ev?.detail?.id && ev.detail.id !== rid) setOpen(false);
    };
    window.addEventListener("subscription-more-menu-open", onGlobalOpen as any);
    return () => window.removeEventListener("subscription-more-menu-open", onGlobalOpen as any);
  }, [rid]);

  useEffect(() => {
    if (!open) return;

    const updatePos = () => {
      const el = btnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = 320;
      const margin = 8;
      const maxH = Math.min(Math.floor(window.innerHeight * 0.7), 420);
      const left = Math.max(margin, Math.min(r.right - width, window.innerWidth - width - margin));
      const preferredTop = r.bottom + 8;
      const openUp = preferredTop + maxH > window.innerHeight - margin && r.top - 8 - maxH >= margin;
      const top = openUp ? Math.max(margin, r.top - 8 - maxH) : Math.min(preferredTop, window.innerHeight - margin);
      setPos({ left, top });
    };

    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);

    const onDown = (e: MouseEvent | TouchEvent) => {
      const root = rootRef.current;
      if (!root) return;
      const t = e.target as Node | null;
      if (t && root.contains(t)) return;
      setOpen(false);
      setPos(null);
    };

    document.addEventListener("mousedown", onDown, { capture: true });
    document.addEventListener("touchstart", onDown, { capture: true });

    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
      document.removeEventListener("mousedown", onDown, { capture: true } as any);
      document.removeEventListener("touchstart", onDown, { capture: true } as any);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      {buyMoreNonce ? (
        <PayOrTransferFlow
          key={String(buyMoreNonce)}
          locale={String(locale)}
          toTutorId={String(tutorId)}
          toTutorName={String(tutorName || "Репетитор")}
          toRateCents={Number(tutorRateCents || 0) || 0}
          onSuccessHref={`/${locale}/dashboard?tab=subscriptions#schedule`}
          autoSkipMethod={false}
          startOpen
          hideTrigger
          onClose={() => setBuyMoreNonce(0)}
        />
      ) : null}

      {reportOpen ? (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 px-4"
          onMouseDown={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) closeReport();
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-neutral-200 p-4"
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-base font-semibold text-neutral-900">Поскаржитись</div>
              <button
                type="button"
                className="h-8 w-8 rounded-full hover:bg-neutral-100 inline-flex items-center justify-center text-neutral-700"
                aria-label="Close"
                onClick={closeReport}
                disabled={reportLoading}
              >
                ✕
              </button>
            </div>

            {!reportSent ? (
              <>
                <div className="mt-2 text-sm text-neutral-600">Опишіть, що саме сталося. Звернення побачить адміністрація.</div>

                <label className="mt-4 block">
                  <div className="text-sm font-semibold text-neutral-900">Причина</div>
                  <select
                    className="mt-2 w-full h-11 rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:ring-2 focus:ring-neutral-200"
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                  >
                    <option value="TUTOR_NO_SHOW">Викладач не прийшов</option>
                    <option value="STUDENT_COULD_NOT_JOIN">Не вдалося приєднатись</option>
                    <option value="TECHNICAL_PROBLEM">Технічна проблема</option>
                    <option value="QUALITY_NOT_AS_EXPECTED">Якість уроку не відповідала очікуванням</option>
                    <option value="OTHER">Інше</option>
                  </select>
                </label>

                <label className="mt-4 block">
                  <div className="text-sm font-semibold text-neutral-900">Повідомлення</div>
                  <textarea
                    className="mt-2 w-full min-h-[110px] rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-200"
                    value={reportMsg}
                    onChange={(e) => setReportMsg(e.target.value)}
                    placeholder="Напишіть деталі…"
                  />
                </label>

                {reportErr ? <div className="mt-3 text-sm text-red-600">{reportErr}</div> : null}

                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
                    onClick={closeReport}
                    disabled={reportLoading}
                  >
                    Скасувати
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mt-2 text-sm text-neutral-600">Звернення відправлено. Ми розглянемо його якнайшвидше.</div>

                {reportErr ? <div className="mt-3 text-sm text-red-600">{reportErr}</div> : null}

                <div className="mt-4 space-y-2">
                  <button
                    type="button"
                    className="w-full h-11 rounded-xl bg-black px-5 text-sm font-semibold text-white hover:bg-neutral-800"
                    onClick={() => {
                      if (!reportBookingId) return;
                      closeReport();
                      window.location.href = `/${locale}/chat/${encodeURIComponent(String(reportBookingId))}`;
                    }}
                  >
                    Відкрити чат звернення
                  </button>

                  {Math.max(0, Math.floor(Number(credits) || 0)) > 0 ? (
                    <Link
                      href={`/${locale}/catalog?transferFrom=${encodeURIComponent(String(tutorId))}`}
                      className="w-full h-11 rounded-xl border border-neutral-200 bg-white px-5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 inline-flex items-center justify-center"
                      onClick={() => closeReport()}
                    >
                      Перевести уроки до іншого викладача
                    </Link>
                  ) : null}

                  <button
                    type="button"
                    className="w-full h-11 rounded-xl bg-neutral-100 px-5 text-sm font-semibold text-neutral-700 hover:bg-neutral-200"
                    onClick={closeReport}
                    disabled={reportLoading}
                  >
                    Закрити
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      <button
        ref={btnRef}
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-100 transition"
        aria-label="Меню"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const next = !open;
          if (next) {
            window.dispatchEvent(new CustomEvent("subscription-more-menu-open", { detail: { id: rid } }));
          }
          setOpen(next);
          if (!next) setPos(null);
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <span className="text-[18px] leading-none" aria-hidden="true">
          ⋯
        </span>
      </button>

      {open ? (
        <div
          className="fixed w-80 max-h-[70vh] rounded-2xl border border-neutral-200 bg-white shadow-xl overflow-hidden overflow-y-auto z-[9999]"
          style={{ left: pos?.left ?? 0, top: pos?.top ?? 0 }}
        >
          {items.map((it: any, idx) => {
            const rowBase = "flex items-center gap-3 px-4 py-3 text-sm";
            const withDivider = idx < items.length - 1 ? " border-b border-neutral-100" : "";
            if (it.type === "link") {
              return (
                <Link
                  key={`${it.label}:${idx}`}
                  href={it.href}
                  className={`${rowBase}${withDivider} hover:bg-neutral-50`}
                  onClick={(e) => {
                    e.stopPropagation();
                    close();
                  }}
                >
                  {it.icon}
                  <span className="min-w-0 truncate">{it.label}</span>
                </Link>
              );
            }
            if (it.type === "button") {
              return (
                <button
                  key={`${it.label}:${idx}`}
                  type="button"
                  className={`${rowBase}${withDivider} hover:bg-neutral-50 w-full text-left disabled:opacity-60 disabled:cursor-not-allowed`}
                  disabled={pauseLoading || reportLoading}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    it.onClick?.();
                  }}
                >
                  {it.icon}
                  <span className="min-w-0 truncate">{it.label}</span>
                </button>
              );
            }
            return (
              <div
                key={`${it.label}:${idx}`}
                className={`${rowBase}${withDivider} text-neutral-500 opacity-60 cursor-not-allowed`}
              >
                {it.icon}
                <span className="min-w-0 truncate">{it.label}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
