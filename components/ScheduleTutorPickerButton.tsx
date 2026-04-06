"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type TutorBalanceRow = {
  tutorId: string;
  tutorName: string;
  tutorImage: string | null;
  credits: number;
  valueCents?: number;
  rateCents?: number;
};

type NextUpcoming = {
  id: string;
  startsAt: string;
};

export default function ScheduleTutorPickerButton({
  locale,
  className,
  buttonText,
  nextUpcomingByTutorId,
  upcomingCountByTutorId,
}: {
  locale: string;
  className?: string;
  buttonText?: string;
  nextUpcomingByTutorId?: Record<string, NextUpcoming | null | undefined>;
  upcomingCountByTutorId?: Record<string, number | null | undefined>;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<TutorBalanceRow[]>([]);
  const [err, setErr] = useState("");
  const [step, setStep] = useState<"pick" | "action">("pick");
  const [picked, setPicked] = useState<TutorBalanceRow | null>(null);

  const hasRows = useMemo(() => rows.some((r) => String(r?.tutorId || "").trim() && (Number(r?.credits) || 0) > 0), [rows]);

  useEffect(() => {
    if (!open) return;
    const y = window.scrollY || 0;
    const prev = {
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overflowY: document.body.style.overflowY,
    };
    document.body.style.position = "fixed";
    document.body.style.top = `-${y}px`;
    document.body.style.width = "100%";
    document.body.style.overflowY = "scroll";
    return () => {
      const top = document.body.style.top;
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.width = prev.width;
      document.body.style.overflowY = prev.overflowY;
      const restoreY = Math.abs(parseInt(top || "0", 10)) || y;
      window.scrollTo(0, restoreY);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const res = await fetch("/api/lesson-balance", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) throw new Error(String(json?.error || "Failed to load balances"));
        const next = (Array.isArray(json?.byTutor) ? json.byTutor : []) as TutorBalanceRow[];
        const filtered = next
          .filter((r) => String(r?.tutorId || "").trim() && Math.max(0, Math.floor(Number(r?.credits ?? 0) || 0)) > 0)
          .map((r) => ({
            tutorId: String(r.tutorId),
            tutorName: String(r.tutorName || "Репетитор"),
            tutorImage: r.tutorImage ? String(r.tutorImage) : null,
            credits: Math.max(0, Math.floor(Number(r.credits ?? 0) || 0)),
            valueCents: Number((r as any).valueCents ?? 0) || 0,
            rateCents: Number((r as any).rateCents ?? 0) || 0,
          }))
          .sort((a, b) => (Number(b.valueCents || 0) || 0) - (Number(a.valueCents || 0) || 0));
        if (mounted) setRows(filtered);
      } catch (e) {
        if (mounted) {
          setRows([]);
          setErr(e instanceof Error ? e.message : "Failed to load balances");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={
          className ||
          "inline-flex h-10 items-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
        }
        onClick={() => setOpen(true)}
      >
        {buttonText || "Запланувати уроки"}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-neutral-200">
              <div className="min-w-0">
                <div className="text-lg font-semibold text-neutral-900">{step === "pick" ? "Оберіть репетитора" : "Що зробити?"}</div>
                <div className="mt-1 text-sm text-neutral-600">
                  {step === "pick" ? "З ким хочете запланувати уроки?" : picked?.tutorName ? `Репетитор: ${picked.tutorName}` : ""}
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-neutral-100 text-neutral-800"
                onClick={() => {
                  setOpen(false);
                  setStep("pick");
                  setPicked(null);
                }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-5">
              {step === "action" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-900 hover:bg-neutral-50"
                      onClick={() => {
                        setStep("pick");
                        setPicked(null);
                      }}
                    >
                      <span className="text-neutral-500">←</span>
                      Назад
                    </button>
                  </div>

                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <div className="flex items-center gap-3">
                      <div className="relative h-11 w-11 overflow-hidden rounded-2xl ring-1 ring-neutral-200 bg-white">
                        {picked?.tutorImage ? (
                          <Image
                            src={String(picked.tutorImage)}
                            alt={String(picked?.tutorName || "")}
                            fill
                            sizes="44px"
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-xs font-semibold text-neutral-700 bg-white">
                            {String(picked?.tutorName || "R").slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-neutral-900">{picked?.tutorName || "Репетитор"}</div>
                        <div className="mt-0.5 text-xs text-neutral-600">
                          {(() => {
                            const tid = String(picked?.tutorId || "");
                            const raw = Math.max(0, Math.floor(Number(picked?.credits) || 0));
                            const booked = Math.max(0, Math.floor(Number(upcomingCountByTutorId?.[tid] ?? 0) || 0));
                            const avail = Math.max(0, raw - booked);
                            return booked > 0 ? `Доступно: ${avail} (всього: ${raw})` : `Баланс: ${raw} уроків`;
                          })()}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 text-sm text-neutral-700">
                      {(() => {
                        const tid = String(picked?.tutorId || "");
                        const next = tid ? nextUpcomingByTutorId?.[tid] || null : null;
                        const when = next?.startsAt ? new Date(String(next.startsAt)).toLocaleString() : "";
                        return next?.id ? (
                          <span>
                            У вас уже є запланований урок{when ? `: ${when}` : ""}. Що зробити?
                          </span>
                        ) : (
                          <span>Що зробити?</span>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <button
                      type="button"
                      className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-pink-500 px-5 text-sm font-semibold text-white shadow-sm hover:bg-pink-600 disabled:opacity-50"
                      disabled={!picked?.tutorId || !nextUpcomingByTutorId?.[String(picked?.tutorId || "")]?.id}
                      onClick={() => {
                        const tid = String(picked?.tutorId || "");
                        const bid = nextUpcomingByTutorId?.[tid]?.id;
                        if (!tid || !bid) return;
                        window.location.href = `/${encodeURIComponent(locale)}/schedule/${encodeURIComponent(tid)}?reschedule=${encodeURIComponent(String(bid))}`;
                      }}
                    >
                      Перенести урок
                    </button>

                    <button
                      type="button"
                      className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-emerald-500 px-5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-50"
                      disabled={!picked?.tutorId}
                      onClick={() => {
                        const tid = String(picked?.tutorId || "");
                        const credits = Math.max(0, Math.floor(Number(picked?.credits) || 0));
                        const booked = Math.max(0, Math.floor(Number(upcomingCountByTutorId?.[tid] ?? 0) || 0));
                        const available = Math.max(0, credits - booked);
                        const planLessons = Math.max(1, Math.min(4, available));
                        if (!tid) return;
                        window.location.href = `/${encodeURIComponent(locale)}/schedule/${encodeURIComponent(tid)}?planPerWeek=1&planLessons=${encodeURIComponent(String(planLessons))}`;
                      }}
                    >
                      Запланувати решту
                    </button>
                  </div>
                </div>
              ) : null}

              {step !== "action" ? (
                <>
              {loading ? <div className="text-sm text-neutral-600">Завантаження…</div> : null}
              {err ? <div className="text-sm text-red-700">{err}</div> : null}

              {!loading && !err && !hasRows ? (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="text-sm text-neutral-700">Немає уроків на балансі.</div>
                  <a
                    href={`/${encodeURIComponent(locale)}/catalog`}
                    className="mt-3 inline-flex h-10 items-center rounded-xl bg-black px-4 text-sm font-semibold text-white hover:bg-neutral-800"
                  >
                    Знайти репетитора
                  </a>
                </div>
              ) : null}

              {!loading && hasRows ? (
                <div className="space-y-2">
                  {rows.map((t) => {
                    const tid = String(t.tutorId || "");
                    const credits = Math.max(0, Math.floor(Number(t.credits) || 0));
                    const booked = Math.max(0, Math.floor(Number(upcomingCountByTutorId?.[tid] ?? 0) || 0));
                    const available = Math.max(0, credits - booked);
                    const planLessons = Math.max(1, Math.min(4, available));
                    return (
                      <button
                        key={tid}
                        type="button"
                        className="w-full flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-3 hover:bg-neutral-50"
                        onClick={() => {
                          const next = nextUpcomingByTutorId?.[tid] || null;
                          if (next?.id) {
                            setPicked(t);
                            setStep("action");
                            return;
                          }
                          window.location.href = `/${encodeURIComponent(locale)}/schedule/${encodeURIComponent(tid)}?planPerWeek=1&planLessons=${encodeURIComponent(String(planLessons))}`;
                        }}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="relative h-10 w-10 overflow-hidden rounded-2xl ring-1 ring-neutral-200 bg-white">
                            {t.tutorImage ? (
                              <Image
                                src={t.tutorImage}
                                alt={t.tutorName}
                                fill
                                sizes="40px"
                                className="object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-xs font-semibold text-neutral-700 bg-neutral-100">
                                {String(t.tutorName || "R").slice(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 text-left">
                            <div className="truncate text-sm font-semibold text-neutral-900">{t.tutorName || "Репетитор"}</div>
                            <div className="mt-0.5 text-xs text-neutral-600">
                              {booked > 0 ? `Доступно: ${available} (всього: ${credits})` : `Баланс: ${credits} уроків`}
                            </div>
                          </div>
                        </div>
                        <div className="text-neutral-400">›</div>
                      </button>
                    );
                  })}
                </div>
              ) : null}
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
