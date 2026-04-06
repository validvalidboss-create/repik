"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type BookingRow = {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number | null;
  student: { id: string; name: string | null; email: string | null; image?: string | null } | null;
};

function startOfWeekUTC(d: Date) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay();
  const diff = (day + 6) % 7;
  date.setUTCDate(date.getUTCDate() - diff);
  return date;
}

function addDaysUTC(d: Date, days: number) {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function fmtTimeLocal(iso: string) {
  const dt = new Date(iso);
  const hh = dt.getHours().toString().padStart(2, "0");
  const mm = dt.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function isoDayKeyUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

export default function TutorWeekScheduleGrid({ locale }: { locale: string }) {
  const [weekStartISO, setWeekStartISO] = useState<string>(() => startOfWeekUTC(new Date()).toISOString());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [mutatingId, setMutatingId] = useState<string>("");
  const [menuOpenId, setMenuOpenId] = useState<string>("");
  const menuRootRef = useRef<HTMLDivElement | null>(null);

  const currentWeekStartISO = useMemo(() => startOfWeekUTC(new Date()).toISOString(), []);
  const canGoPrevWeek = useMemo(() => {
    const cur = new Date(currentWeekStartISO).getTime();
    const ws = new Date(weekStartISO).getTime();
    if (!Number.isFinite(cur) || !Number.isFinite(ws)) return false;
    return ws > cur;
  }, [currentWeekStartISO, weekStartISO]);

  const weekLabel = useMemo(() => {
    const ws = new Date(weekStartISO);
    if (Number.isNaN(ws.getTime())) return "";
    const we = addDaysUTC(ws, 6);
    const fmt = new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit" });
    return `${fmt.format(ws)}–${fmt.format(we)}`;
  }, [weekStartISO]);

  const days = useMemo(() => {
    const ws = new Date(weekStartISO);
    const out: { key: string; date: Date; label: string }[] = [];
    const names: Record<number, string> = { 1: "пн", 2: "вт", 3: "ср", 4: "чт", 5: "пт", 6: "сб", 0: "нд" };
    for (let i = 0; i < 7; i += 1) {
      const d = addDaysUTC(ws, i);
      out.push({ key: isoDayKeyUTC(d), date: d, label: names[d.getUTCDay()] || "" });
    }
    return out;
  }, [weekStartISO]);

  const timeRows = useMemo(() => {
    const out: string[] = [];
    for (let m = 7 * 60; m <= 23 * 60; m += 30) {
      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      out.push(`${hh}:${mm}`);
    }
    return out;
  }, []);

  const bookingsByDay = useMemo(() => {
    const map = new Map<string, BookingRow[]>();
    for (const d of days) map.set(d.key, []);
    for (const b of bookings) {
      const dt = new Date(b.startsAt);
      const key = isoDayKeyUTC(dt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
      map.set(k, arr);
    }
    return map;
  }, [bookings, days]);

  const occupiedKey = useMemo(() => {
    const set = new Set<string>();
    for (const b of bookings) {
      const start = new Date(b.startsAt).getTime();
      const end = new Date(b.endsAt).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
      for (let t = start; t < end; t += 30 * 60 * 1000) {
        const dt = new Date(t);
        const key = `${isoDayKeyUTC(dt)}|${fmtTimeLocal(dt.toISOString())}`;
        set.add(key);
      }
    }
    return set;
  }, [bookings]);

  const bookingStartMap = useMemo(() => {
    const map = new Map<string, BookingRow>();
    for (const b of bookings) {
      const dt = new Date(b.startsAt);
      const k = `${isoDayKeyUTC(dt)}|${fmtTimeLocal(b.startsAt)}`;
      map.set(k, b);
    }
    return map;
  }, [bookings]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const res = await fetch(`/api/tutor/schedule-week?weekStart=${encodeURIComponent(weekStartISO)}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) throw new Error(String(data?.error || "Failed to load"));
        if (cancelled) return;
        setBookings(Array.isArray(data.bookings) ? data.bookings : []);
      } catch (e) {
        if (cancelled) return;
        setBookings([]);
        setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [weekStartISO]);

  useEffect(() => {
    if (!menuOpenId) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const root = menuRootRef.current;
      const t = (e as any)?.target as Node | null;
      if (root && t && root.contains(t)) return;
      setMenuOpenId("");
      menuRootRef.current = null;
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown as any);
      document.removeEventListener("touchstart", onDown as any);
    };
  }, [menuOpenId]);

  async function requestReschedule(bookingId: string, redirectToChatHref?: string) {
    setMutatingId(bookingId);
    setErr("");
    try {
      const msg =
        "Вітаю! Чи могли б ви перенести урок на інший час? Напишіть, будь ласка, кілька зручних вам варіантів — я підлаштуюся.";
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bookingId, content: msg, attachments: [] }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(String(data?.error || "Не вдалося надіслати"));
      if (!data?.message?.id) throw new Error("Не вдалося надіслати");
      if (redirectToChatHref) window.location.href = redirectToChatHref;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не вдалося надіслати");
    } finally {
      setMutatingId("");
    }
  }

  async function cancelLesson(bookingId: string) {
    const reason = window.prompt("Причина скасування (обов’язково):", "");
    if (reason === null) return;
    const r = String(reason || "").trim();
    if (!r) {
      setErr("Вкажіть причину скасування");
      return;
    }

    setMutatingId(bookingId);
    setErr("");
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: r }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(String(data?.error || "Не вдалося скасувати"));
      window.location.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не вдалося скасувати");
    } finally {
      setMutatingId("");
    }
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-neutral-900">Розклад</div>
          <div className="mt-1 text-xs text-neutral-500">{weekLabel}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canGoPrevWeek}
            className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-900 disabled:opacity-50 hover:bg-neutral-50"
            onClick={() => {
              const prev = new Date(weekStartISO);
              prev.setUTCDate(prev.getUTCDate() - 7);
              if (new Date(prev.toISOString()).getTime() < new Date(currentWeekStartISO).getTime()) return;
              setWeekStartISO(prev.toISOString());
            }}
          >
            ◀
          </button>
          <button
            type="button"
            className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            onClick={() => {
              const next = new Date(weekStartISO);
              next.setUTCDate(next.getUTCDate() + 7);
              setWeekStartISO(next.toISOString());
            }}
          >
            ▶
          </button>
        </div>
      </div>

      {err ? <div className="mt-3 text-sm text-red-700">{err}</div> : null}

      <div className="mt-4 rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        <div className="border-b border-neutral-200 px-5 py-3 flex items-center justify-between">
          <div className="text-xs text-neutral-500">07:00–23:00</div>
          {loading ? <div className="text-xs text-neutral-500">Завантаження…</div> : null}
        </div>

        <div className="p-5 overflow-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[88px_repeat(7,1fr)] gap-2">
              <div />
              {days.map((d) => (
                <div key={d.key} className="text-xs font-semibold text-neutral-700 text-center">
                  {d.label}
                </div>
              ))}

              {timeRows.map((t) => (
                <div key={t} className="contents">
                  <div className="text-xs text-neutral-500 flex items-center justify-end pr-2 h-10">{t}</div>
                  {days.map((d) => {
                    const cellKey = `${d.key}|${t}`;
                    const isOcc = occupiedKey.has(cellKey);
                    const startB = bookingStartMap.get(cellKey);

                    if (!isOcc) {
                      return <div key={cellKey} className="h-10 rounded-xl border border-dashed border-neutral-200 bg-white" />;
                    }

                    if (!startB) {
                      return <div key={cellKey} className="h-10 rounded-xl bg-neutral-100" />;
                    }

                    const studentName = String(startB.student?.name || startB.student?.email || "Студент");
                    const endLabel = fmtTimeLocal(startB.endsAt);
                    const hrefChat = `/${encodeURIComponent(locale)}/chat/${encodeURIComponent(startB.id)}`;

                    return (
                      <div key={cellKey} className="h-10 rounded-xl bg-neutral-900 text-white text-[11px] font-semibold px-2 flex items-center justify-between gap-2">
                        <div className="min-w-0 truncate">
                          {studentName} {t}–{endLabel}
                        </div>
                        <Link href={hrefChat} className="flex-shrink-0 text-white/80 hover:text-white underline underline-offset-2">
                          чат
                        </Link>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-neutral-200 px-5 py-4">
          <div className="text-xs text-neutral-500">
            Показано лише заброньовані уроки (PENDING/CONFIRMED).
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="text-sm font-semibold text-neutral-900">Список на тиждень</div>
        {bookings.length === 0 ? (
          <div className="mt-2 text-sm text-neutral-600">Немає заброньованих уроків на цей тиждень.</div>
        ) : (
          <div className="mt-3 divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
            {days.map((d) => {
              const rows = bookingsByDay.get(d.key) || [];
              if (!rows.length) return null;
              return (
                <div key={`list:${d.key}`} className="p-4">
                  <div className="text-xs font-semibold text-neutral-700 mb-2">{d.label}</div>
                  <div className="space-y-2">
                    {rows.map((b) => {
                      const studentName = String(b.student?.name || b.student?.email || "Студент");
                      const studentAvatar = String((b.student as any)?.image || "");
                      const s = fmtTimeLocal(b.startsAt);
                      const e = fmtTimeLocal(b.endsAt);
                      const hrefChat = `/${encodeURIComponent(locale)}/chat/${encodeURIComponent(b.id)}`;
                      const open = menuOpenId === b.id;
                      return (
                        <div key={b.id} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 px-3 py-2">
                          <div className="min-w-0 flex items-center gap-3">
                            <div className="h-10 w-10 overflow-hidden rounded-xl ring-1 ring-neutral-200 bg-neutral-100 text-neutral-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                              {studentAvatar ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={studentAvatar} alt="" className="h-full w-full object-cover" />
                              ) : (
                                (studentName || "S").slice(0, 1).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-neutral-900 truncate">{studentName}</div>
                              <div className="text-xs text-neutral-600">{s}–{e}</div>
                            </div>
                          </div>
                          <div
                            ref={(el) => {
                              if (open) menuRootRef.current = el;
                            }}
                            className="relative flex-shrink-0"
                          >
                            <button
                              type="button"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50"
                              onClick={() => {
                                setMenuOpenId((v) => {
                                  const next = v === b.id ? "" : b.id;
                                  if (!next) menuRootRef.current = null;
                                  return next;
                                });
                              }}
                              aria-label="Меню"
                            >
                              ⋯
                            </button>

                            {open ? (
                              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-neutral-200 bg-white shadow-lg overflow-hidden z-20">
                                <Link
                                  href={hrefChat}
                                  className="block px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                                  onClick={() => setMenuOpenId("")}
                                >
                                  Чат
                                </Link>
                                <button
                                  type="button"
                                  disabled={!!mutatingId}
                                  onClick={async () => {
                                    setMenuOpenId("");
                                    await requestReschedule(b.id, hrefChat);
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-50"
                                >
                                  Попросити перенести урок
                                </button>
                                <button
                                  type="button"
                                  disabled={!!mutatingId}
                                  onClick={async () => {
                                    setMenuOpenId("");
                                    await cancelLesson(b.id);
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                                >
                                  Скасувати урок
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
