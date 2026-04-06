"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type BookingRow = {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number | null;
  tutor: {
    id: string;
    headline: string | null;
    subjects?: string[] | null;
    media: string[] | null;
    user: { id: string; name: string | null; email: string | null; image?: string | null } | null;
  } | null;
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

function initials(name: string) {
  const s = String(name || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "?";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return `${a}${b}`.toUpperCase();
}

export default function StudentWeekScheduleGrid({ locale }: { locale: string }) {
  const [weekStartISO, setWeekStartISO] = useState<string>(() => startOfWeekUTC(new Date()).toISOString());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");
  const [bookings, setBookings] = useState<BookingRow[]>([]);

  const gridStartMin = 7 * 60;
  const gridEndMin = 23 * 60;
  const rowHeightPx = 34;

  const weekLabel = useMemo(() => {
    const ws = new Date(weekStartISO);
    if (Number.isNaN(ws.getTime())) return "";
    const we = addDaysUTC(ws, 6);
    const fmtA = new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "short" });
    const fmtB = new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "short", year: "numeric" });
    return `${fmtA.format(ws)} – ${fmtB.format(we)}`;
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

  const bookingsByDayKey = useMemo(() => {
    const map = new Map<string, BookingRow[]>();
    for (const b of bookings) {
      const s = new Date(b.startsAt);
      if (Number.isNaN(s.getTime())) continue;
      const dayKey = isoDayKeyUTC(s);
      const list = map.get(dayKey) || [];
      list.push(b);
      map.set(dayKey, list);
    }
    for (const [k, list] of map.entries()) {
      list.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
      map.set(k, list);
    }
    return map;
  }, [bookings]);

  const todayKey = useMemo(() => isoDayKeyUTC(new Date()), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const res = await fetch(`/api/student/schedule-week?weekStart=${encodeURIComponent(weekStartISO)}`, {
          cache: "no-store",
          credentials: "include",
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) throw new Error(String(data?.error || `Failed to load (${res.status})`));
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

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            onClick={() => setWeekStartISO(startOfWeekUTC(new Date()).toISOString())}
          >
            Сьогодні
          </button>
          <div className="flex items-center overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <button
              type="button"
              className="h-9 px-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
              onClick={() => {
                const prev = new Date(weekStartISO);
                prev.setUTCDate(prev.getUTCDate() - 7);
                setWeekStartISO(prev.toISOString());
              }}
              aria-label="Попередній тиждень"
            >
              ←
            </button>
            <div className="h-9 w-px bg-neutral-200" />
            <button
              type="button"
              className="h-9 px-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
              onClick={() => {
                const next = new Date(weekStartISO);
                next.setUTCDate(next.getUTCDate() + 7);
                setWeekStartISO(next.toISOString());
              }}
              aria-label="Наступний тиждень"
            >
              →
            </button>
          </div>
        </div>

        <div className="min-w-[220px] text-sm font-semibold text-neutral-900">{weekLabel}</div>
      </div>

      {err ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{err}</div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div
          className="grid"
          style={{
            gridTemplateColumns: "72px repeat(7, minmax(0, 1fr))",
            gridTemplateRows: `52px repeat(${timeRows.length}, ${rowHeightPx}px)`,
          }}
        >
          <div className="border-b border-neutral-200 p-2 text-xs text-neutral-500">GMT+3</div>
          {days.map((d, idx) => {
            const fmt = new Intl.DateTimeFormat("uk-UA", { day: "2-digit" });
            const isToday = d.key === todayKey;
            return (
              <div
                key={d.key}
                className={
                  isToday
                    ? "border-b border-l border-neutral-200 p-2 bg-blue-50/40"
                    : "border-b border-l border-neutral-200 p-2"
                }
                style={{ gridColumn: idx + 2, gridRow: 1 }}
              >
                <div className={isToday ? "text-xs text-blue-700" : "text-xs text-neutral-500"}>{d.label}</div>
                <div className={isToday ? "text-sm font-semibold text-blue-900" : "text-sm font-semibold text-neutral-900"}>
                  {fmt.format(d.date)}
                </div>
              </div>
            );
          })}

          {timeRows.map((t, i) => (
            <div
              key={`time-${t}`}
              className="border-t border-neutral-100 p-2 text-xs text-neutral-500"
              style={{ gridColumn: 1, gridRow: i + 2 }}
            >
              {t.endsWith(":00") ? t : ""}
            </div>
          ))}

          {days.map((d, dayIdx) => {
            return timeRows.map((t, i) => (
              <div
                key={`cell-${d.key}-${t}`}
                className="border-l border-t border-neutral-100"
                style={{ gridColumn: dayIdx + 2, gridRow: i + 2 }}
              />
            ));
          })}

          {!loading && bookings.length === 0 ? (
            <div className="col-span-8 p-4 text-sm text-neutral-600" style={{ gridColumn: "1 / span 8", gridRow: 2 }}>
              Немає запланованих уроків.
            </div>
          ) : null}

          {loading ? (
            <div className="col-span-8 p-4 text-sm text-neutral-600" style={{ gridColumn: "1 / span 8", gridRow: 2 }}>
              Завантаження…
            </div>
          ) : null}

          {!loading
            ? days.flatMap((d, dayIdx) => {
                const list = bookingsByDayKey.get(d.key) || [];
                return list.map((b) => {
                  const s = new Date(b.startsAt);
                  const e = new Date(b.endsAt);
                  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;

                  const startMin = s.getHours() * 60 + s.getMinutes();
                  const endMin = e.getHours() * 60 + e.getMinutes();
                  const clampedStart = Math.max(gridStartMin, Math.min(gridEndMin, startMin));
                  const clampedEnd = Math.max(gridStartMin, Math.min(gridEndMin, Math.max(endMin, clampedStart + 1)));
                  const startIdx = Math.floor((clampedStart - gridStartMin) / 30);
                  const endIdx = Math.ceil((clampedEnd - gridStartMin) / 30);

                  const tutorName = String(b?.tutor?.user?.name || "Репетитор");
                  const media0 = Array.isArray(b?.tutor?.media) ? String(b?.tutor?.media?.[0] || "") : "";
                  const avatarUrl = String(media0 || b?.tutor?.user?.image || "");
                  const subj =
                    (Array.isArray(b?.tutor?.subjects) && String(b?.tutor?.subjects?.[0] || "")) ||
                    String(b?.tutor?.headline || "") ||
                    "Урок";

                  const status = String(b?.status || "").toUpperCase();
                  const tone =
                    status === "CONFIRMED"
                      ? "border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
                      : status === "PENDING"
                        ? "border-amber-200 bg-amber-50 hover:bg-amber-100"
                        : status === "CANCELED" || status === "REFUNDED"
                          ? "border-rose-200 bg-rose-50 hover:bg-rose-100"
                          : status === "COMPLETED"
                            ? "border-neutral-200 bg-neutral-50 hover:bg-neutral-100"
                            : "border-blue-200 bg-blue-50 hover:bg-blue-100";

                  const timeRange = `${fmtTimeLocal(b.startsAt)}–${fmtTimeLocal(b.endsAt)}`;

                  return (
                    <Link
                      key={`evt-${String(b.id)}`}
                      href={`/${locale}/lesson/${encodeURIComponent(String(b.id))}`}
                      className={`m-1 block rounded-xl border px-2 py-1 text-[11px] text-neutral-900 shadow-sm ${tone}`}
                      style={{
                        gridColumn: dayIdx + 2,
                        gridRowStart: startIdx + 2,
                        gridRowEnd: endIdx + 2,
                        minHeight: rowHeightPx - 4,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 overflow-hidden rounded-md ring-1 ring-neutral-200 bg-white text-[10px] font-semibold text-neutral-700 flex items-center justify-center">
                          {avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            initials(tutorName)
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{tutorName}</div>
                          <div className="text-neutral-700/80 truncate">{subj}</div>
                          <div className="text-[10px] text-neutral-600 mt-0.5">{timeRange}</div>
                        </div>
                      </div>
                    </Link>
                  );
                });
              })
            : null}
        </div>
      </div>
    </div>
  );
}
