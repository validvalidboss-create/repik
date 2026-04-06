"use client";

import { useEffect, useMemo, useState } from "react";

type ScheduleDay = {
  weekday: number;
  label: string;
  windows: string[]; // ["HH:MM–HH:MM"]
};

function getWeekdayIndexInTz(timeZone: string, date: Date) {
  const label = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[label] ?? 0;
}

function getYMDHMInTz(timeZone: string, date: Date) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour"), mi: get("minute") };
}

function toISOInTz(timeZone: string, y: number, mo: number, d: number, h: number, mi: number) {
  // First guess: treat local time as if it were UTC.
  const guess = Date.UTC(y, mo - 1, d, h, mi, 0);
  const off = getTimezoneOffsetMinutes(timeZone, new Date(guess));
  // Convert local time to UTC by subtracting offset.
  return new Date(guess - off * 60000).toISOString();
}

function timeToMinutes(t: string) {
  const [h, m] = String(t || "")
    .split(":")
    .map((x) => Number(x) || 0);
  return h * 60 + m;
}

function minutesToTime(m: number) {
  const hh = Math.floor((Number(m) || 0) / 60);
  const mm = (Number(m) || 0) % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function parseWindow(w: string) {
  const parts = String(w || "").split("–");
  if (parts.length !== 2) return null;
  const start = timeToMinutes(parts[0]);
  const end = timeToMinutes(parts[1]);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return { start, end };
}

function getTimezoneOffsetMinutes(timeZone: string, date: Date) {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = dtf.formatToParts(date);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
    const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    return Math.round((asUTC - date.getTime()) / 60000);
  } catch {
    return 0;
  }
}

function shiftWeekdayAndMinutes(weekday: number, minutes: number) {
  let wd = Number(weekday);
  let m = Number(minutes);
  while (m < 0) {
    m += 1440;
    wd = (wd + 6) % 7;
  }
  while (m >= 1440) {
    m -= 1440;
    wd = (wd + 1) % 7;
  }
  return { weekday: wd, minutes: m };
}

export default function TutorSchedulePicker({
  days,
  timezone,
  tutorId,
  locale,
}: {
  days: ScheduleDay[];
  timezone?: string;
  tutorId: string;
  locale: string;
}) {
  const MIN_LEAD_HOURS = 24;
  const durations = [30, 60] as const;
  const [duration, setDuration] = useState<(typeof durations)[number]>(60);
  const [selected, setSelected] = useState<null | { dateISO: string; weekday: number; startMin: number }>(null);
  const [expanded, setExpanded] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [viewerTz, setViewerTz] = useState<string>("UTC");

  const tutorTz = String(timezone || "UTC") || "UTC";
  const tzShiftMinutes = useMemo(() => {
    const now = new Date();
    const tutorOff = getTimezoneOffsetMinutes(tutorTz, now);
    const viewerOff = getTimezoneOffsetMinutes(viewerTz, now);
    return viewerOff - tutorOff;
  }, [tutorTz, viewerTz]);

  const tzOptions = useMemo(() => {
    const base = [
      viewerTz,
      tutorTz,
      "Europe/Kyiv",
      "Europe/Warsaw",
      "Europe/Berlin",
      "Europe/London",
      "America/New_York",
      "UTC",
    ].filter(Boolean);
    return Array.from(new Set(base));
  }, [viewerTz, tutorTz]);

  const weekdayFallback: Record<number, string> = {
    1: "Понеділок",
    2: "Вівторок",
    3: "Середа",
    4: "Четвер",
    5: "Пʼятниця",
    6: "Субота",
    0: "Неділя",
  };

  const weekdayShort: Record<number, string> = {
    1: "Пн",
    2: "Вт",
    3: "Ср",
    4: "Чт",
    5: "Пт",
    6: "Сб",
    0: "Нд",
  };

  const byDay = useMemo(() => {
    const map = new Map<number, { label: string; starts: number[] }>();

    for (const wd of [0, 1, 2, 3, 4, 5, 6]) {
      map.set(wd, { label: weekdayFallback[wd] || "", starts: [] });
    }

    for (const d of Array.isArray(days) ? days : []) {
      const srcWeekday = Number(d.weekday);
      for (const winStr of Array.isArray(d.windows) ? d.windows : []) {
        const win = parseWindow(winStr);
        if (!win) continue;

        // step 30 minutes
        for (let s = win.start; s + duration <= win.end; s += 30) {
          const shifted = shiftWeekdayAndMinutes(srcWeekday, s + tzShiftMinutes);
          map.get(shifted.weekday)?.starts.push(shifted.minutes);
        }
      }
      if (map.has(srcWeekday) && d.label) {
        map.set(srcWeekday, { label: d.label, starts: map.get(srcWeekday)?.starts || [] });
      }
    }

    for (const v of map.values()) {
      v.starts.sort((a, b) => a - b);
    }

    // Always show columns Mon..Sun like in UI (1..6 + 0)
    const order = [1, 2, 3, 4, 5, 6, 0];
    return order.map((wd) => ({ weekday: wd, label: map.get(wd)?.label || "", starts: map.get(wd)?.starts || [] }));
  }, [days, duration, tzShiftMinutes]);

  const maxRows = useMemo(() => {
    return Math.max(0, ...byDay.map((d) => d.starts.length));
  }, [byDay]);

  const shownRows = expanded ? maxRows : Math.min(maxRows, 6);

  useEffect(() => {
    try {
      const z = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      setViewerTz(z);
    } catch {
      // ignore
    }
  }, []);

  const weekStartISO = useMemo(() => {
    const now = new Date();
    const nowParts = getYMDHMInTz(viewerTz, now);
    const today00 = toISOInTz(viewerTz, nowParts.y, nowParts.mo, nowParts.d, 0, 0);
    const todayDate = new Date(today00);
    const start = new Date(todayDate);
    start.setUTCDate(start.getUTCDate() + weekOffset * 7);
    const startParts = getYMDHMInTz(viewerTz, start);
    return toISOInTz(viewerTz, startParts.y, startParts.mo, startParts.d, 0, 0);
  }, [viewerTz, weekOffset]);

  const weekDates = useMemo(() => {
    const base = new Date(weekStartISO);
    return Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() + idx);
      const parts = getYMDHMInTz(viewerTz, d);
      const dateISO = toISOInTz(viewerTz, parts.y, parts.mo, parts.d, 0, 0);
      const js = new Date(dateISO);
      const weekday = getWeekdayIndexInTz(viewerTz, js);
      return { date: js, dateISO, weekday, parts };
    });
  }, [viewerTz, weekStartISO]);

  const weekRangeLabel = useMemo(() => {
    if (!weekDates.length) return "";
    const pad2 = (n: number) => String(Number(n) || 0).padStart(2, "0");
    const a = weekDates[0].parts;
    const b = weekDates[6].parts;
    return `${pad2(a.d)}.${pad2(a.mo)}–${pad2(b.d)}.${pad2(b.mo)}`;
  }, [weekDates]);

  const selectedStartsAtISO = useMemo(() => {
    if (!selected) return "";
    const dayParts = getYMDHMInTz(viewerTz, new Date(selected.dateISO));
    const h = Math.floor(selected.startMin / 60);
    const mi = selected.startMin % 60;
    return toISOInTz(viewerTz, dayParts.y, dayParts.mo, dayParts.d, h, mi);
  }, [selected, viewerTz]);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-sm text-neutral-700">
          Оберіть час для першого уроку. Час показано у вашому часовому поясі.
        </div>
        <div className="text-xs text-neutral-500">{viewerTz ? `TZ: ${viewerTz}` : ""}</div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setWeekOffset((v) => Math.max(0, v - 1));
              setSelected(null);
            }}
            disabled={weekOffset <= 0}
            className="h-9 w-9 rounded-lg border border-neutral-200 bg-white text-sm hover:bg-neutral-50 disabled:opacity-40"
            aria-label="Previous week"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={() => {
              setWeekOffset((v) => Math.min(12, v + 1));
              setSelected(null);
            }}
            className="h-9 w-9 rounded-lg border border-neutral-200 bg-white text-sm hover:bg-neutral-50"
            aria-label="Next week"
          >
            ▶
          </button>
        </div>
        <div className="text-xs text-neutral-600">{weekRangeLabel}</div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
          <label className="text-xs text-neutral-600 whitespace-nowrap">Часовий пояс</label>
          <select
            value={viewerTz}
            onChange={(e) => {
              setViewerTz(e.target.value);
              setSelected(null);
            }}
            className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm"
          >
            {tzOptions.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
          {tutorTz && tutorTz !== viewerTz ? (
            <div className="text-xs text-neutral-500">Розклад викладача: {tutorTz}</div>
          ) : null}
        </div>

        <div className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-1 w-fit sm:ml-auto">
          {durations.map((d) => {
            const active = d === duration;
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDuration(d);
                  setSelected(null);
                }}
                className={
                  active
                    ? "px-4 py-2 rounded-md bg-white border border-neutral-200 text-sm font-medium"
                    : "px-4 py-2 rounded-md text-sm text-neutral-700 hover:bg-white/70"
                }
              >
                {d} хв
              </button>
            );
          })}
        </div>
      </div>

      {maxRows === 0 ? (
        <div className="mt-4 text-sm text-neutral-500">Розклад не додано</div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <div className="min-w-0">
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {weekDates.map((wd) => {
                const dayNum = Number(wd.parts.d) || wd.date.getDate();
                const isToday = (() => {
                  const now = new Date();
                  const n = getYMDHMInTz(viewerTz, now);
                  return n.y === wd.parts.y && n.mo === wd.parts.mo && n.d === wd.parts.d;
                })();
                return (
                  <div key={wd.dateISO} className="text-center text-[11px] sm:text-xs font-medium text-neutral-600">
                    <div>{weekdayShort[wd.weekday] || ""}</div>
                    <div className={isToday ? "text-neutral-900" : "text-neutral-500"}>{dayNum}</div>
                  </div>
                );
              })}
            </div>

            <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">
              {weekDates.map((wd) => {
                const d = byDay.find((x) => x.weekday === wd.weekday) || { weekday: wd.weekday, label: "", starts: [] as number[] };
                return (
                <div key={wd.dateISO} className="space-y-1.5">
                  {Array.from({ length: shownRows }).map((_, idx) => {
                    const startMin = d.starts[idx];
                    if (typeof startMin !== "number") {
                      return <div key={`${d.weekday}-${idx}`} className="h-7" />;
                    }

                    const isSelected =
                      selected?.weekday === d.weekday && selected?.startMin === startMin && selected?.dateISO === wd.dateISO;
                    const startLabel = minutesToTime(startMin);
                    const endLabel = minutesToTime(startMin + duration);
                    const tooltip = `⚡ Забронювати доступний час\n${startLabel}–${endLabel} (${duration} хв)`;

                    const slotISO = (() => {
                      const h = Math.floor(startMin / 60);
                      const mi = startMin % 60;
                      return toISOInTz(viewerTz, wd.parts.y, wd.parts.mo, wd.parts.d, h, mi);
                    })();
                    const minStartTs = Date.now() + MIN_LEAD_HOURS * 60 * 60 * 1000;
                    const isBookable = new Date(slotISO).getTime() >= minStartTs;

                    return (
                      <div key={`${d.weekday}-${startMin}`} className="relative flex items-center justify-center">
                        <button
                          type="button"
                          title={tooltip}
                          disabled={!isBookable}
                          onClick={() => {
                            if (!isBookable) return;
                            setSelected({ dateISO: wd.dateISO, weekday: d.weekday, startMin });
                          }}
                          className={
                            isSelected
                              ? "w-full h-7 rounded-md bg-pink-50 text-pink-700 text-xs font-semibold"
                              : "w-full h-7 rounded-md bg-transparent text-xs text-neutral-900 underline underline-offset-4 decoration-neutral-300 hover:decoration-neutral-700 disabled:no-underline disabled:text-neutral-300"
                          }
                        >
                          {startLabel}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
              })}
            </div>

            {selected ? (
              <div className="mt-5 flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-3">
                <div className="text-sm text-neutral-800">
                  Обрано: <span className="font-medium">{byDay.find((d) => d.weekday === selected.weekday)?.label}</span>{" "}
                  {minutesToTime(selected.startMin)}–{minutesToTime(selected.startMin + duration)}
                </div>
                <a
                  href={`/${encodeURIComponent(locale)}/book/${encodeURIComponent(tutorId)}?startsAtISO=${encodeURIComponent(selectedStartsAtISO)}&durationMin=${encodeURIComponent(String(duration))}`}
                  className="px-4 py-2 rounded-xl bg-black text-white text-sm font-medium hover:bg-neutral-800"
                >
                  Продовжити
                </a>
              </div>
            ) : null}

            {maxRows > shownRows ? (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="px-4 py-2 rounded-lg border border-neutral-200 text-sm hover:bg-neutral-50"
                >
                  {expanded ? "Згорнути" : "Подивитися повний розклад"}
                </button>
              </div>
            ) : null}

            {expanded && maxRows > 6 ? (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="px-4 py-2 rounded-lg border border-neutral-200 text-sm hover:bg-neutral-50"
                >
                  Згорнути
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
