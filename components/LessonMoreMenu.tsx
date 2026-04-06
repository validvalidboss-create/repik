"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";

function MenuIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
      <span className="h-4 w-4" aria-hidden="true">
        {children}
      </span>
    </span>
  );
}

function IconMessage() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    </svg>
  );
}

function IconShare() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
      <path d="M12 3v13" />
      <path d="M7 8l5-5 5 5" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
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

function IconBan() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M5.5 5.5l13 13" />
    </svg>
  );
}

export default function LessonMoreMenu({
  locale,
  bookingId,
  tutorId,
}: {
  locale: string;
  bookingId: string;
  tutorId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [isTutor, setIsTutor] = useState<boolean | null>(null);
  const [tutorCredits, setTutorCredits] = useState<number | null>(null);
  const [startsAtISO, setStartsAtISO] = useState<string>("");
  const [endsAtISO, setEndsAtISO] = useState<string>("");
  const [bookingStatus, setBookingStatus] = useState<string>("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [absentOpen, setAbsentOpen] = useState(false);
  const [absentMsg, setAbsentMsg] = useState("");
  const [absentLoading, setAbsentLoading] = useState(false);
  const [absentError, setAbsentError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const rid = useId();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json().catch(() => null);
        const v = !!json?.isTutor;
        if (!cancelled) {
          setIsTutor(v);
          const sa = String(json?.booking?.startsAt || "");
          setStartsAtISO(sa);
          const ea = String(json?.booking?.endsAt || "");
          setEndsAtISO(ea);
          setBookingStatus(String(json?.booking?.status || ""));
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!tutorId) return;
        if (isTutor !== false) return;
        const res = await fetch(`/api/lesson-balance?tutorId=${encodeURIComponent(String(tutorId))}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !json?.ok) {
          setTutorCredits(0);
          return;
        }
        setTutorCredits(Number(json?.credits ?? 0) || 0);
      } catch {
        if (!cancelled) setTutorCredits(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tutorId, isTutor]);

  const items = useMemo(() => {
    const out: Array<{
      type: "link" | "button" | "disabled";
      href?: string;
      label: string;
      onClick?: () => void;
      icon: React.ReactNode;
      danger?: boolean;
    }>
      = [];

    const CANCEL_LESSON_CUTOFF_HOURS = 12;
    const canCancel = (() => {
      if (!startsAtISO) return true;
      const ms = new Date(startsAtISO).getTime();
      if (!Number.isFinite(ms)) return true;
      return ms - Date.now() >= CANCEL_LESSON_CUTOFF_HOURS * 60 * 60 * 1000;
    })();

    const canReportAbsent = (() => {
      if (!endsAtISO) return false;
      if (String(bookingStatus || "") !== "CONFIRMED") return false;
      const ms = new Date(endsAtISO).getTime();
      if (!Number.isFinite(ms)) return false;
      return Date.now() >= ms;
    })();

    const isFutureConfirmed = (() => {
      if (String(bookingStatus || "") !== "CONFIRMED") return false;
      if (!startsAtISO) return false;
      const ms = new Date(startsAtISO).getTime();
      if (!Number.isFinite(ms)) return false;
      return ms > Date.now();
    })();

    out.push({
      type: "link",
      href: `/${locale}/chat/${encodeURIComponent(bookingId)}`,
      label: "Написати",
      icon: <MenuIcon><IconMessage /></MenuIcon>,
    });

    out.push({
      type: "button",
      label: "Поділитися",
      icon: <MenuIcon><IconShare /></MenuIcon>,
      onClick: () => {
        const url = `${window.location.origin}/${locale}/lesson/${encodeURIComponent(bookingId)}`;
        (async () => {
          try {
            if (navigator.share) {
              await navigator.share({ url });
              return;
            }
          } catch {
            // ignore
          }
          try {
            await navigator.clipboard.writeText(url);
          } catch {
            // ignore
          }
        })();
      },
    });

    out.push({
      type: "link",
      href: tutorId ? `/${locale}/tutors/${encodeURIComponent(tutorId)}` : `/${locale}/tutors`,
      label: "Переглянути профіль",
      icon: <MenuIcon><IconUser /></MenuIcon>,
    });

    if (isTutor === true) {
      out.push({
        type: "button",
        label: "Попросити перенести",
        icon: <MenuIcon><IconCalendar /></MenuIcon>,
        onClick: () => {
          const msg =
            "Вітаю! Чи могли б ви перенести урок на інший час? Напишіть, будь ласка, кілька зручних вам варіантів — я підлаштуюся.";
          (async () => {
            try {
              await fetch("/api/messages", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ bookingId, content: msg, attachments: [] }),
              });
            } catch {
              // ignore
            }
          })();
        },
      });

      if (canReportAbsent) {
        out.push({
          type: "button",
          label: "Студент не прийшов",
          icon: <MenuIcon><IconBan /></MenuIcon>,
          onClick: () => {
            setAbsentError(null);
            setAbsentMsg("");
            setAbsentOpen(true);
          },
        });
      }

      if (canCancel) {
        out.push({
          type: "button",
          label: "Скасувати урок",
          icon: (
            <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <span className="h-4 w-4" aria-hidden="true">
                <IconBan />
              </span>
            </span>
          ),
          danger: true,
          onClick: () => {
            setCancelError(null);
            setCancelReason("");
            setCancelOpen(true);
          },
        });
      } else {
        out.push({
          type: "disabled",
          label: "Скасування доступне лише за 12+ год до початку",
          icon: (
            <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400">
              <span className="h-4 w-4" aria-hidden="true">
                <IconBan />
              </span>
            </span>
          ),
          danger: true,
        });
      }
    } else if (isTutor === false) {
      const credits = typeof tutorCredits === "number" && Number.isFinite(tutorCredits) ? tutorCredits : null;
      if (tutorId && credits !== null && credits > 0) {
        out.push({
          type: "link",
          href: `/${locale}/schedule/${encodeURIComponent(tutorId)}`,
          label: "Запланувати урок",
          icon: <MenuIcon><IconCalendar /></MenuIcon>,
        });
      }

      if (tutorId && credits !== null && credits <= 0) {
        out.push({
          type: "disabled",
          label: "У вас розплановані всі куплені уроки з цим викладачем",
          icon: (
            <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400">
              <span className="h-4 w-4" aria-hidden="true">
                <IconCalendar />
              </span>
            </span>
          ),
        });

        out.push({
          type: "link",
          href: `/${locale}/tutors/${encodeURIComponent(tutorId)}`,
          label: "Купити ще уроки",
          icon: <MenuIcon><IconUser /></MenuIcon>,
        });
      }

      if (isFutureConfirmed) {
        out.push({
          type: "link",
          href: tutorId
            ? `/${locale}/schedule/${encodeURIComponent(tutorId)}?reschedule=${encodeURIComponent(bookingId)}`
            : `/${locale}/dashboard#schedule`,
          label: "Перенести",
          icon: <MenuIcon><IconCalendar /></MenuIcon>,
        });

        if (canCancel) {
          out.push({
            type: "button",
            label: "Скасувати урок",
            icon: (
              <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                <span className="h-4 w-4" aria-hidden="true">
                  <IconBan />
                </span>
              </span>
            ),
            danger: true,
            onClick: () => {
              setCancelError(null);
              setCancelReason("");
              setCancelOpen(true);
            },
          });
        } else {
          out.push({
            type: "disabled",
            label: "Скасування доступне лише за 12+ год до початку",
            icon: (
              <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400">
                <span className="h-4 w-4" aria-hidden="true">
                  <IconBan />
                </span>
              </span>
            ),
            danger: true,
          });
        }
      }
    }

    return out;
  }, [bookingId, bookingStatus, endsAtISO, isTutor, locale, startsAtISO, tutorId, tutorCredits]);

  useEffect(() => {
    const onGlobalOpen = (e: Event) => {
      const ev = e as CustomEvent<{ id: string }>;
      if (ev?.detail?.id && ev.detail.id !== rid) setOpen(false);
    };
    window.addEventListener("lesson-more-menu-open", onGlobalOpen as any);
    return () => window.removeEventListener("lesson-more-menu-open", onGlobalOpen as any);
  }, [rid]);

  useEffect(() => {
    if (!open) return;

    const updatePos = () => {
      const el = btnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = 256;
      const margin = 8;
      const left = Math.max(margin, Math.min(r.right - width, window.innerWidth - width - margin));
      const top = Math.min(r.bottom + 8, window.innerHeight - margin);
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
      {absentOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onMouseDown={(e) => {
            e.stopPropagation();
            if (absentLoading) return;
            if (e.target === e.currentTarget) setAbsentOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-neutral-200 p-4"
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
          >
            <div className="text-base font-semibold text-neutral-900">Студент не прийшов</div>
            <div className="mt-1 text-sm text-neutral-600">Додайте коментар (необов’язково). Повідомлення буде надіслано в чат.</div>

            <textarea
              className="mt-3 w-full min-h-[96px] rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-200"
              autoFocus
              value={absentMsg}
              onChange={(e) => setAbsentMsg(e.target.value)}
              placeholder="Коментар…"
            />

            {absentError ? <div className="mt-2 text-sm text-red-600">{absentError}</div> : null}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
                onClick={() => {
                  if (absentLoading) return;
                  setAbsentOpen(false);
                }}
              >
                Закрити
              </button>
              <button
                type="button"
                className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold text-white ${
                  absentLoading ? "bg-black/40 cursor-not-allowed" : "bg-black hover:bg-neutral-800"
                }`}
                disabled={absentLoading}
                onClick={() => {
                  setAbsentLoading(true);
                  setAbsentError(null);
                  (async () => {
                    try {
                      const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/report-student-absence`, {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ message: absentMsg.trim() }),
                      });
                      const json = await res.json().catch(() => null);
                      if (!res.ok) {
                        setAbsentError(json?.error || "Не вдалося надіслати");
                        return;
                      }
                      setAbsentOpen(false);
                      window.location.reload();
                    } catch {
                      setAbsentError("Не вдалося надіслати");
                    } finally {
                      setAbsentLoading(false);
                    }
                  })();
                }}
              >
                {absentLoading ? "Надсилаємо…" : "Підтвердити"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cancelOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onMouseDown={(e) => {
            e.stopPropagation();
            if (cancelLoading) return;
            if (e.target === e.currentTarget) setCancelOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-neutral-200 p-4"
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
          >
            <div className="text-base font-semibold text-neutral-900">Скасувати урок</div>
            <div className="mt-1 text-sm text-neutral-600">Коментар обов’язковий. Він буде надісланий у чат.</div>

            <textarea
              className="mt-3 w-full min-h-[96px] rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-200"
              autoFocus
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Напишіть причину скасування…"
            />

            {cancelError ? <div className="mt-2 text-sm text-red-600">{cancelError}</div> : null}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
                onClick={() => {
                  if (cancelLoading) return;
                  setCancelOpen(false);
                }}
              >
                Закрити
              </button>
              <button
                type="button"
                className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold text-white ${
                  cancelLoading || !cancelReason.trim() ? "bg-red-300 cursor-not-allowed" : "bg-red-600 hover:bg-red-700"
                }`}
                disabled={cancelLoading || !cancelReason.trim()}
                onClick={() => {
                  const reason = cancelReason.trim();
                  if (!reason) return;
                  setCancelLoading(true);
                  setCancelError(null);
                  (async () => {
                    try {
                      const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/cancel`, {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ reason }),
                      });
                      const json = await res.json().catch(() => null);
                      if (!res.ok) {
                        setCancelError(json?.error || "Не вдалося скасувати урок");
                        return;
                      }
                      setCancelOpen(false);
                      window.location.reload();
                    } catch {
                      setCancelError("Не вдалося скасувати урок");
                    } finally {
                      setCancelLoading(false);
                    }
                  })();
                }}
              >
                {cancelLoading ? "Скасування…" : "Скасувати"}
              </button>
            </div>
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
            window.dispatchEvent(new CustomEvent("lesson-more-menu-open", { detail: { id: rid } }));
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
          className="fixed w-64 rounded-2xl border border-neutral-200 bg-white shadow-xl overflow-hidden z-[9999]"
          style={{ left: pos?.left ?? 0, top: pos?.top ?? 0 }}
        >
          {items.map((it, idx) => {
            const rowBase = "flex items-center gap-3 px-4 py-3 text-sm";
            const withDivider = idx < items.length - 1 ? " border-b border-neutral-100" : "";
            if (it.type === "link") {
              return (
                <Link
                  key={`${it.label}:${idx}`}
                  href={it.href || "#"}
                  className={`${rowBase}${withDivider} hover:bg-neutral-50`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    setPos(null);
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
                  className={`w-full text-left ${rowBase}${withDivider} hover:bg-neutral-50`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    it.onClick?.();
                    setOpen(false);
                    setPos(null);
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
                className={`${rowBase}${withDivider} ${it.danger ? "text-red-600" : "text-neutral-700"} opacity-60 cursor-not-allowed`}
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
