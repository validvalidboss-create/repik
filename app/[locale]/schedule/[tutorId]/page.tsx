"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";

type Slot = { start: string; end: string };

type WeeklyPick = { weekday: number; time: string };

type Mode = "weekly" | "one_time";

function toDateLocale(appLocale: string) {
  const l = String(appLocale || "").toLowerCase();
  if (l === "uk") return "uk-UA";
  if (l === "ru") return "ru-RU";
  if (l === "en") return "en-US";
  return "uk-UA";
}

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

function isoDayKeyUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

function localDayKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtTimeLocal(iso: string) {
  const dt = new Date(iso);
  const hh = dt.getHours().toString().padStart(2, "0");
  const mm = dt.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function isWithinTimeWindowLocal(iso: string, startMin: number, endMin: number) {
  return isWithinTimeWindowTz(iso, "Europe/Kyiv", startMin, endMin);
}

function isWithinTimeWindowTz(iso: string, timeZone: string, startMin: number, endMin: number) {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return false;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(dt);
    const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "NaN");
    const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "NaN");
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return false;
    const mins = hh * 60 + mm;
    return mins >= startMin && mins <= endMin;
  } catch {
    return false;
  }
}

export default function ScheduleLessonsPage() {
  const params = useParams<{ locale: string; tutorId: string }>();
  const sp = useSearchParams();

  const locale = String(params?.locale || "uk");
  const tutorId = String(params?.tutorId || "");
  const dateLocale = toDateLocale(locale);

  const planPerWeek = Math.max(1, Math.min(5, Number(sp?.get("planPerWeek") || "") || 1));
  const planLessonsParam = sp?.get("planLessons");
  const hasPlanLessonsParam = planLessonsParam != null && String(planLessonsParam).trim() !== "";
  const planLessons = Math.max(1, Number(planLessonsParam || "") || planPerWeek * 4);
  const planWeeks = Math.max(1, Math.min(12, Number(sp?.get("planWeeks") || "") || 4));
  const rescheduleId = String(sp?.get("reschedule") || "");
  const transferKey = String(sp?.get("transferKey") || "").trim();

  const [mode, setMode] = useState<Mode>("weekly");
  const [weekStartISO, setWeekStartISO] = useState<string>(startOfWeekUTC(new Date()).toISOString());
  const [loading, setLoading] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [booked, setBooked] = useState<Slot[]>([]);
  const [myBooked, setMyBooked] = useState<Slot[]>([]);
  const [weeklyPicks, setWeeklyPicks] = useState<WeeklyPick[]>([]);
  const [oneTimePicks, setOneTimePicks] = useState<Slot[]>([]);
  const [tutor, setTutor] = useState<{ id: string; name: string; avatarUrl: string | null } | null>(null);
  const [tutorErr, setTutorErr] = useState<string>("");
  const [lessonCredits, setLessonCredits] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmErr, setConfirmErr] = useState<string>("");
  const [rescheduleBooking, setRescheduleBooking] = useState<{ id: string; startsAt: string; durationMinutes: number } | null>(null);
  const [doneMsg, setDoneMsg] = useState<string>("");
  const [doneRedirect, setDoneRedirect] = useState<string>("");
  const [doneTutor, setDoneTutor] = useState<{ name: string; avatarUrl: string | null } | null>(null);

  const TIME_WINDOW_START_MIN = 7 * 60;
  const TIME_WINDOW_END_MIN = 23 * 60;

  const RESCHEDULE_CUTOFF_HOURS = 12;
  const BOOKING_LEAD_HOURS = 24;
  const minStartTs = Date.now() + (rescheduleId ? RESCHEDULE_CUTOFF_HOURS : BOOKING_LEAD_HOURS) * 60 * 60 * 1000;
  const leadHoursUi = rescheduleId ? RESCHEDULE_CUTOFF_HOURS : BOOKING_LEAD_HOURS;

  const allowWeekly = !rescheduleId && (Number(lessonCredits ?? 0) || 0) >= 4;

  useEffect(() => {
    if (!tutorId) return;
    if (rescheduleId) return;
    if (transferKey) return;
    if (lessonCredits == null) return;
    const credits = Math.max(0, Math.floor(Number(lessonCredits) || 0));
    if (credits > 0) return;
    window.location.href = `/${locale}/book/${encodeURIComponent(String(tutorId))}`;
  }, [lessonCredits, locale, rescheduleId, transferKey, tutorId]);

  useEffect(() => {
    if (!allowWeekly && mode === "weekly") {
      setMode("one_time");
    }
  }, [allowWeekly, mode]);

  const weekLabel = useMemo(() => {
    const ws = new Date(weekStartISO);
    if (Number.isNaN(ws.getTime())) return "";
    const we = addDaysUTC(ws, 6);
    const fmt = new Intl.DateTimeFormat(dateLocale, { day: "2-digit", month: "2-digit" });
    return String(fmt.format(ws)) + "–" + String(fmt.format(we));
  }, [dateLocale, weekStartISO]);

  const currentWeekStartISO = useMemo(() => startOfWeekUTC(new Date()).toISOString(), []);
  const canGoPrevWeek = useMemo(() => {
    const cur = new Date(currentWeekStartISO).getTime();
    const ws = new Date(weekStartISO).getTime();
    if (!Number.isFinite(cur) || !Number.isFinite(ws)) return false;
    return ws > cur;
  }, [currentWeekStartISO, weekStartISO]);

  const effectivePlanLessons = useMemo(() => {
    if (rescheduleId) return 1;
    const raw = Math.max(1, Number(planLessons || 1) || 1);
    const cap = lessonCredits == null ? raw : Math.max(0, Math.floor(Number(lessonCredits) || 0));

    // If user comes to one-time booking without explicit planLessons in URL,
    // default to booking up to the available credits (but no more than 4 at once).
    if (mode === "one_time" && !hasPlanLessonsParam && lessonCredits != null) {
      if (cap <= 0) return 0;
      return Math.max(1, Math.min(4, cap));
    }

    const v = lessonCredits == null ? raw : Math.min(raw, cap);
    if (lessonCredits != null && cap <= 0) return 0;
    return Math.max(1, Number.isFinite(v) ? v : raw);
  }, [hasPlanLessonsParam, lessonCredits, mode, planLessons, rescheduleId]);

  const requiredCount = rescheduleId ? 1 : mode === "weekly" ? planPerWeek : Math.min(effectivePlanLessons, 4);

  const displayRequiredCount = useMemo(() => {
    if (rescheduleId) return 1;
    if (mode === "weekly") return planPerWeek;
    return Math.min(effectivePlanLessons, 4);
  }, [effectivePlanLessons, mode, planPerWeek, rescheduleId]);

  const canPickSlots = useMemo(() => {
    if (rescheduleId) return true;
    if (lessonCredits == null) return true;
    return Math.max(0, Math.floor(Number(lessonCredits) || 0)) > 0;
  }, [lessonCredits, rescheduleId]);

  const selectedCount = mode === "weekly" ? weeklyPicks.length : oneTimePicks.length;

  useEffect(() => {
    if (!rescheduleId) return;
    setMode("one_time");
    setWeeklyPicks([]);
    setOneTimePicks([]);
  }, [rescheduleId]);

  useEffect(() => {
    async function loadRescheduleBooking() {
      if (!rescheduleId) {
        setRescheduleBooking(null);
        return;
      }
      try {
        const res = await fetch(`/api/bookings/${encodeURIComponent(rescheduleId)}`);
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(String(data?.error || "Failed to load lesson"));
        const b = data?.booking;
        setRescheduleBooking({
          id: String(b.id),
          startsAt: String(b.startsAt),
          durationMinutes: Number(b.durationMinutes || 60) || 60,
        });
        setConfirmErr("");
      } catch (e) {
        setRescheduleBooking(null);
        setConfirmErr(e instanceof Error ? e.message : "Failed to load lesson");
      }
    }
    loadRescheduleBooking();
  }, [rescheduleId]);

  useEffect(() => {
    async function loadTutor() {
      if (!tutorId) return;
      try {
        const res = await fetch(`/api/tutors/${encodeURIComponent(String(tutorId))}`);
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(String(data?.error || "Failed to load tutor"));
        const media0 = Array.isArray((data as any)?.media) ? String((data as any).media?.[0] || "") : "";
        const userImg = String((data as any)?.user?.image || "");
        const avatarUrl = (media0 || userImg || "").trim();
        setTutor({ id: String(data.id), name: String(data.name || ""), avatarUrl: avatarUrl ? avatarUrl : null });
        setTutorErr("");
      } catch (e) {
        setTutor(null);
        setTutorErr(e instanceof Error ? e.message : "Failed to load tutor");
      }
    }
    loadTutor();
  }, [tutorId]);

  useEffect(() => {
    let cancelled = false;
    async function loadCredits() {
      if (!tutorId) {
        setLessonCredits(null);
        return;
      }
      try {
        const res = await fetch(`/api/lesson-balance?tutorId=${encodeURIComponent(String(tutorId))}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !data?.ok) {
          setLessonCredits(0);
          return;
        }
        setLessonCredits(Number(data?.credits ?? 0) || 0);
      } catch {
        if (!cancelled) setLessonCredits(0);
      }
    }
    loadCredits();
    return () => {
      cancelled = true;
    };
  }, [weekStartISO]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!tutorId) return;
      setLoading(true);
      try {
        const q = new URLSearchParams({ tutorId, weekStart: weekStartISO, durationMin: "60" });
        const res = await fetch(`/api/tutor/slots?${q.toString()}`);
        const data = await res.json().catch(() => null);
        const s = (data?.slots || []) as Slot[];
        const b = (data?.booked || []) as Slot[];

        const fetched = (Array.isArray(s) ? s : []).filter((x) => {
          const ts = new Date(x.start).getTime();
          return Number.isFinite(ts) && ts >= minStartTs;
        });
        const bookedFiltered = (Array.isArray(b) ? b : []).filter((x) => {
          const ts = new Date(x.start).getTime();
          return Number.isFinite(ts) && ts >= minStartTs;
        });

        setBooked(bookedFiltered);

        // If there's nothing bookable this week (after lead time), auto-advance to next week.
        if (!cancelled && fetched.length === 0) {
          const ws = new Date(weekStartISO);
          if (!Number.isNaN(ws.getTime())) {
            const next = new Date(ws);
            next.setUTCDate(next.getUTCDate() + 7);
            const max = new Date();
            max.setUTCDate(max.getUTCDate() + 7 * 6); // up to 6 weeks ahead
            if (next.getTime() <= max.getTime()) {
              setWeekStartISO(next.toISOString());
              return;
            }
          }
        }

        if (fetched.length) {
          const stepMs = 30 * 60 * 1000;
          const normalized = fetched
            .map((slot) => {
              const startMs = new Date(slot.start).getTime();
              const endMs = new Date(slot.end).getTime();
              if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return slot;
              const durationMs = endMs - startMs;
              const roundedStartMs = Math.round(startMs / stepMs) * stepMs;
              const roundedEndMs = roundedStartMs + durationMs;
              return {
                start: new Date(roundedStartMs).toISOString(),
                end: new Date(roundedEndMs).toISOString(),
              };
            })
            .filter((slot) => isWithinTimeWindowLocal(slot.start, TIME_WINDOW_START_MIN, TIME_WINDOW_END_MIN))
            .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
          setSlots(normalized);
          // Safety: if user already picked a slot that became too-soon, drop it.
          setOneTimePicks((prev) => prev.filter((p) => {
            const ts = new Date(p.start).getTime();
            return Number.isFinite(ts) && ts >= minStartTs;
          }));
          return;
        }

        // Dev fallback: generate demo slots for the week (any time)
        const ws = new Date(weekStartISO);
        if (Number.isNaN(ws.getTime())) {
          setSlots([]);
          return;
        }
        const demo: Slot[] = [];
        for (let i = 0; i < 7; i += 1) {
          const d = addDaysUTC(ws, i);
          for (let h = 7; h < 22; h += 1) {
            if (h % 2 !== 0) continue;
            const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, 0, 0));
            const end = new Date(start);
            end.setUTCMinutes(end.getUTCMinutes() + 60);
            demo.push({ start: start.toISOString(), end: end.toISOString() });
          }
        }

        setSlots(
          demo
            .filter((x) => {
              const ts = new Date(x.start).getTime();
              return Number.isFinite(ts) && ts >= minStartTs;
            })
            .filter((x) => isWithinTimeWindowLocal(x.start, TIME_WINDOW_START_MIN, TIME_WINDOW_END_MIN)),
        );
        setOneTimePicks((prev) =>
          prev.filter((p) => {
            const ts = new Date(p.start).getTime();
            return Number.isFinite(ts) && ts >= minStartTs;
          }),
        );
      } catch {
        setSlots([]);
        setBooked([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tutorId, weekStartISO]);

  useEffect(() => {
    let cancelled = false;
    async function loadMy() {
      try {
        const meRes = await fetch("/api/me", { cache: "no-store" });
        const me = await meRes.json().catch(() => null);
        const uid = String(me?.user?.id || "").trim();
        if (!uid) {
          if (!cancelled) setMyBooked([]);
          return;
        }
        const res = await fetch(`/api/bookings/me?role=student&userId=${encodeURIComponent(uid)}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        const rows = Array.isArray(data?.bookings) ? data.bookings : [];
        const intervals: Slot[] = rows
          .filter((b: any) => {
            const st = String(b?.status || "").toUpperCase();
            if (st === "CANCELED" || st === "REFUNDED") return false;
            return true;
          })
          .map((b: any) => ({
            start: new Date(b.startsAt).toISOString(),
            end: new Date(b.endsAt).toISOString(),
          }))
          .filter((x: Slot) => !!x.start && !!x.end);
        if (!cancelled) setMyBooked(intervals);
      } catch {
        if (!cancelled) setMyBooked([]);
      }
    }
    loadMy();
    return () => {
      cancelled = true;
    };
  }, [weekStartISO]);

  const blockedKeys = useMemo(() => {
    const set = new Set<string>();
    const stepMs = 30 * 60 * 1000;
    for (const it of booked) {
      const startMs = new Date(it.start).getTime();
      if (!Number.isFinite(startMs)) continue;
      // block the booked start and neighbors +/- 30min
      for (const off of [-stepMs, 0, stepMs]) {
        const t = new Date(startMs + off);
        if (Number.isNaN(t.getTime())) continue;
        set.add(`${localDayKey(t)}|${fmtTimeLocal(t.toISOString())}`);
      }
    }
    return set;
  }, [booked]);

  const myBlockedKeys = useMemo(() => {
    const set = new Set<string>();
    const stepMs = 30 * 60 * 1000;
    for (const it of myBooked) {
      const startMs = new Date(it.start).getTime();
      if (!Number.isFinite(startMs)) continue;
      if (startMs < minStartTs) continue;
      for (const off of [-stepMs, 0, stepMs]) {
        const t = new Date(startMs + off);
        if (Number.isNaN(t.getTime())) continue;
        set.add(`${localDayKey(t)}|${fmtTimeLocal(t.toISOString())}`);
      }
    }
    return set;
  }, [myBooked]);

  const selectedBlockedKeys = useMemo(() => {
    const set = new Set<string>();
    const stepMs = 30 * 60 * 1000;

    if (mode === "weekly") {
      for (const p of weeklyPicks) {
        const weekday = Number(p.weekday);
        const time = String(p.time || "");
        if (!Number.isFinite(weekday)) continue;
        const [hh, mm] = time.split(":");
        const h = Number(hh);
        const m = Number(mm);
        if (!Number.isFinite(h) || !Number.isFinite(m)) continue;
        const baseMin = h * 60 + m;
        for (const offMin of [-30, 0, 30]) {
          const tMin = baseMin + offMin;
          if (tMin < 0 || tMin >= 24 * 60) continue;
          const oh = String(Math.floor(tMin / 60)).padStart(2, "0");
          const om = String(tMin % 60).padStart(2, "0");
          set.add(`${weekday}|${oh}:${om}`);
        }
      }
      return set;
    }

    for (const s of oneTimePicks) {
      const startMs = new Date(s.start).getTime();
      if (!Number.isFinite(startMs)) continue;
      for (const off of [-stepMs, 0, stepMs]) {
        const t = new Date(startMs + off);
        if (Number.isNaN(t.getTime())) continue;
        set.add(`${localDayKey(t)}|${fmtTimeLocal(t.toISOString())}`);
      }
    }
    return set;
  }, [mode, weeklyPicks, oneTimePicks]);

  const days = useMemo(() => {
    const ws = new Date(weekStartISO);
    const fmt = new Intl.DateTimeFormat(dateLocale, { weekday: "short" });
    const out: { key: string; label: string; date: Date }[] = [];
    for (let i = 0; i < 7; i += 1) {
      const d = addDaysUTC(ws, i);
      const key = localDayKey(d);
      const label = fmt.format(d);
      out.push({ key, label, date: d });
    }
    return out;
  }, [weekStartISO, dateLocale]);

  const slotsByDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const k = localDayKey(new Date(s.start));
      const arr = map.get(k) || [];
      arr.push(s);
      map.set(k, arr);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      map.set(k, arr);
    }
    return map;
  }, [slots]);

  const timeRows = useMemo(() => {
    const set = new Set<string>();
    for (const s of slots) set.add(fmtTimeLocal(s.start));
    for (const key of blockedKeys) {
      const t = key.split("|")[1] || "";
      if (t) set.add(t);
    }
    for (const key of myBlockedKeys) {
      const t = key.split("|")[1] || "";
      if (t) set.add(t);
    }
    const times = Array.from(set);
    times.sort();
    return times;
  }, [slots, blockedKeys, myBlockedKeys]);

  function toggleWeeklyPick(pick: WeeklyPick) {
    setWeeklyPicks((prev) => {
      const exists = prev.some((p) => p.weekday === pick.weekday && p.time === pick.time);
      if (exists) return prev.filter((p) => !(p.weekday === pick.weekday && p.time === pick.time));

      const [hh, mm] = String(pick.time || "").split(":");
      const h = Number(hh);
      const m = Number(mm);
      if (Number.isFinite(h) && Number.isFinite(m)) {
        const baseMin = h * 60 + m;
        const neighborTimes = new Set<string>();
        for (const offMin of [-30, 30]) {
          const tMin = baseMin + offMin;
          if (tMin < 0 || tMin >= 24 * 60) continue;
          const oh = String(Math.floor(tMin / 60)).padStart(2, "0");
          const om = String(tMin % 60).padStart(2, "0");
          neighborTimes.add(`${oh}:${om}`);
        }
        const conflict = prev.some((p) => p.weekday === pick.weekday && (p.time === pick.time || neighborTimes.has(p.time)));
        if (conflict) return prev;
      }

      if (prev.length >= requiredCount) return prev;
      return [...prev, pick];
    });
  }

  function toggleOneTimePick(s: Slot) {
    if (rescheduleId) {
      setOneTimePicks((prev) => {
        const exists = prev.length === 1 && prev[0]?.start === s.start;
        if (exists) return [];
        return [s];
      });
      return;
    }

    if (!canPickSlots) return;

    const startMs = new Date(s.start).getTime();
    if (Number.isFinite(startMs) && startMs < minStartTs) return;

    setOneTimePicks((prev) => {
      const exists = prev.some((x) => x.start === s.start);
      if (exists) return prev.filter((x) => x.start !== s.start);

      const stepMs = 30 * 60 * 1000;
      if (Number.isFinite(startMs)) {
        const conflict = prev.some((x) => {
          const ms = new Date(x.start).getTime();
          if (!Number.isFinite(ms)) return false;
          return Math.abs(ms - startMs) <= stepMs;
        });
        if (conflict) return prev;
      }

      if (prev.length >= requiredCount) return prev;
      return [...prev, s].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    });
  }

  function canConfirm() {
    if (requiredCount <= 0) return false;
    return selectedCount === requiredCount;
  }

  function canConfirmPartial() {
    if (rescheduleId) return false;
    if (mode !== "one_time") return false;
    if (requiredCount <= 0) return false;
    return selectedCount >= 1;
  }

  async function confirmSchedule(opts?: { partial?: boolean }) {
    const partial = Boolean(opts?.partial);
    if (confirming) return;
    if (rescheduleId) {
      if (!canConfirm()) return;
    } else {
      if (partial) {
        if (!canConfirmPartial()) return;
      } else {
        if (!canConfirm()) return;
      }
    }
    setConfirming(true);
    setConfirmErr("");
    setDoneMsg("");
    setDoneRedirect("");
    setDoneTutor(null);
    try {
      if (rescheduleId) {
        const picked = oneTimePicks[0];
        if (!picked) throw new Error("Оберіть новий час для переносу");
        const ctrl = new AbortController();
        const timeoutId = window.setTimeout(() => ctrl.abort(), 30000);
        try {
          const res = await fetch(`/api/bookings/${encodeURIComponent(rescheduleId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ startsAtISO: picked.start }),
            signal: ctrl.signal,
          });
          const data = await res.json().catch(() => null);
          if (!res.ok || !data?.ok) throw new Error(String(data?.error || "Не вдалося перенести урок"));

          const when = new Date(String(data?.booking?.startsAt || picked.start)).toLocaleString(dateLocale);
          setDoneMsg("Супер! Урок перенесено на " + String(when) + ". Вчителя оповіщено.");
          setConfirming(false);
          return;
        } catch (e) {
          const msg = (() => {
            if (e && typeof e === "object" && "name" in e && (e as any).name === "AbortError") {
              return "Сервер не відповідає. Спробуйте ще раз (можливо треба перезапустити dev-сервер).";
            }
            return e instanceof Error ? e.message : "Не вдалося перенести урок";
          })();
          setConfirmErr(msg);
          setConfirming(false);
          return;
        } finally {
          window.clearTimeout(timeoutId);
        }
      }

      const toBook: Slot[] = [];
      if (mode === "one_time") {
        const cap =
          lessonCredits == null
            ? effectivePlanLessons
            : Math.min(effectivePlanLessons, Math.max(0, Math.floor(Number(lessonCredits) || 0)));
        toBook.push(
          ...oneTimePicks
            .filter((p) => {
              const ts = new Date(p.start).getTime();
              return Number.isFinite(ts) && ts >= minStartTs;
            })
            .slice(0, cap),
        );
      } else {
        const targetLessons = Math.max(1, Math.min(effectivePlanLessons, planPerWeek * planWeeks));
        for (let w = 0; w < planWeeks && toBook.length < targetLessons; w += 1) {
          const ws = new Date(weekStartISO);
          ws.setUTCDate(ws.getUTCDate() + w * 7);
          const q = new URLSearchParams({ tutorId, weekStart: ws.toISOString(), durationMin: "60" });
          const res = await fetch(`/api/tutor/slots?${q.toString()}`);
          const data = await res.json().catch(() => null);
          const weekSlotsRaw = Array.isArray(data?.slots) ? (data.slots as Slot[]) : [];
          const weekSlots = weekSlotsRaw
            .filter((x) => {
              const ts = new Date(x.start).getTime();
              return Number.isFinite(ts) && ts >= minStartTs;
            })
            .filter((x) => isWithinTimeWindowLocal(x.start, TIME_WINDOW_START_MIN, TIME_WINDOW_END_MIN));

          if (!weekSlots.length) {
            const when = ws.toLocaleDateString(dateLocale);
            throw new Error(`Немає доступних слотів на тиждень ${when}`);
          }

          for (const p of weeklyPicks) {
            const weekday = Number(p.weekday);
            const time = String(p.time || "");
            if (!Number.isFinite(weekday)) continue;
            const dt = addDaysUTC(ws, weekday);
            const [hh, mm] = time.split(":");
            const h = Number(hh);
            const m = Number(mm);
            if (!Number.isFinite(h) || !Number.isFinite(m)) continue;
            dt.setUTCHours(h, m, 0, 0);
            const startISO = dt.toISOString();
            const match = weekSlots.find((x) => x.start === startISO || fmtTimeLocal(x.start) === time);
            if (match) toBook.push(match);
          }
        }

        if (toBook.length === 0) throw new Error("Немає доступних слотів для плану уроків");
      }

      if (!rescheduleId && lessonCredits != null) {
        const cap = Math.max(0, Math.floor(Number(lessonCredits) || 0));
        if (toBook.length > cap) {
          throw new Error("Недостатньо кредитів для бронювання цього уроку");
        }
      }

      const createdBookingIds: string[] = [];
      for (const s of toBook) {
        const res = await fetch("/api/bookings/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tutorId,
            startsAtISO: s.start,
            durationMin: 60,
            useCredits: true,
            transferKey: transferKey || undefined,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          throw new Error(String(data?.error || "Не вдалося створити урок"));
        }
        const id = String(data?.booking?.id || "").trim();
        if (id) createdBookingIds.push(id);
      }

      try {
        window.dispatchEvent(new Event("lesson-balance-changed"));
      } catch {
        // ignore
      }

      const firstBookingId = createdBookingIds[0] || "";
      const redirectHref = `/${locale}/dashboard?tab=lessons#schedule`;

      const fmt = new Intl.DateTimeFormat(dateLocale, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      const first = toBook[0]?.start ? fmt.format(new Date(toBook[0].start)) : "";
      const count = toBook.length;
      const msg = (() => {
        if (count <= 1) {
          return "Ваш урок успішно заброньовано" + (first ? " на " + String(first) : "") + ". Вчителя оповіщено.";
        }
        return "Ваші уроки (" + String(count) + ") успішно заброньовано" + (first ? ". Перший — " + String(first) : "") + ". Вчителя оповіщено.";
      })();
      setDoneMsg(msg);
      setDoneRedirect(redirectHref);
      setDoneTutor(tutor?.name ? { name: String(tutor.name), avatarUrl: tutor.avatarUrl ?? null } : null);
      setConfirming(false);
      return;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Не вдалося запланувати уроки";
      setConfirmErr(msg);
      setConfirming(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {doneMsg ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => {
              window.location.href = doneRedirect || `/${locale}/dashboard?tab=lessons#schedule`;
            }}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl">
            <div className="text-lg font-semibold text-neutral-900">Супер!</div>

            {doneTutor?.name ? (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                {doneTutor.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={doneTutor.avatarUrl} alt={doneTutor.name} className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-neutral-200" />
                )}
                <div className="min-w-0">
                  <div className="text-xs text-neutral-500">Ви забронювали з</div>
                  <div className="truncate text-sm font-semibold text-neutral-900">{doneTutor.name}</div>
                </div>
              </div>
            ) : null}

            <div className="mt-3 text-sm text-neutral-700">{doneMsg}</div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  window.location.href = doneRedirect || `/${locale}/dashboard?tab=lessons#schedule`;
                }}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white hover:bg-neutral-800"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/${locale}/dashboard?tab=lessons#schedule`} className="h-9 w-9 rounded-full hover:bg-neutral-100 inline-flex items-center justify-center text-neutral-700">
            ←
          </Link>
          <div>
            <div className="text-2xl font-semibold">Заплануйте уроки</div>
            <div className="mt-1 text-sm text-neutral-600">Оберіть слоти та підтвердьте план.</div>
          </div>
        </div>
      </div>

      {tutorErr ? <div className="mt-4 text-sm text-red-700">{tutorErr}</div> : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
          <div className="border-b border-neutral-200 px-5 pt-4">
            <div className="flex items-end justify-between gap-4">
              <div className="flex gap-6">
                {allowWeekly ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("weekly");
                    }}
                    className={`pb-3 text-sm font-semibold ${mode === "weekly" ? "text-neutral-900 border-b-2 border-pink-500" : "text-neutral-500"}`}
                  >
                    Щотижневі уроки
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setMode("one_time");
                  }}
                  className={`pb-3 text-sm font-semibold ${mode === "one_time" ? "text-neutral-900 border-b-2 border-pink-500" : "text-neutral-500"}`}
                >
                  Разові уроки
                </button>
              </div>

              <div className="hidden sm:flex items-center gap-2 pb-3">
                <div className="mr-2 text-xs text-neutral-500 tabular-nums">{weekLabel}</div>
                <button
                  type="button"
                  className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                  disabled={!canGoPrevWeek}
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
          </div>

          <div className="p-5">
            {loading ? <div className="text-sm text-neutral-600">Завантаження слотів…</div> : null}
            {!loading && slots.length === 0 ? <div className="text-sm text-neutral-600">Немає доступних слотів на цей тиждень.</div> : null}

            <div className="mt-4 overflow-auto">
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
                        const daySlots = slotsByDay.get(d.key) || [];
                        const s = daySlots.find((x) => fmtTimeLocal(x.start) === t);
                        const blocked = blockedKeys.has(`${d.key}|${t}`) || myBlockedKeys.has(`${d.key}|${t}`);
                        const tooSoon = s ? new Date(s.start).getTime() < minStartTs : false;
                        if (!s) {
                          if (!blocked) return <div key={`${d.key}-${t}`} className="h-10" />;
                          return (
                            <button
                              key={`${d.key}-${t}`}
                              type="button"
                              disabled
                              className="h-10 rounded-xl border border-neutral-200 bg-neutral-100 text-xs font-semibold text-neutral-400"
                            >
                              {t}
                            </button>
                          );
                        }

                        if (tooSoon) {
                          return <div key={`${d.key}-${t}`} className="h-10" />;
                        }
                        const weekday = d.date.getDay();
                        const active =
                          mode === "weekly"
                            ? weeklyPicks.some((p) => p.weekday === weekday && p.time === t)
                            : oneTimePicks.some((x) => x.start === s.start);
                        const selectedConflict =
                          mode === "weekly" ? selectedBlockedKeys.has(`${weekday}|${t}`) : selectedBlockedKeys.has(`${d.key}|${t}`);
                        const noCreditsDisabled = !rescheduleId && !canPickSlots;
                        const disabled = noCreditsDisabled || blocked || (!active && (selectedConflict || selectedCount >= requiredCount));
                        return (
                          <button
                            key={`${d.key}-${t}`}
                            type="button"
                            disabled={disabled}
                            onClick={() => {
                              if (blocked) return;
                              if (noCreditsDisabled) return;
                              if (!active && selectedConflict) return;
                              if (mode === "weekly") toggleWeeklyPick({ weekday, time: t });
                              else toggleOneTimePick(s);
                            }}
                            className={
                              active
                                ? "h-10 rounded-xl border border-neutral-900 bg-neutral-900 text-xs font-semibold text-white"
                                : disabled
                                  ? "h-10 rounded-xl border border-neutral-200 bg-neutral-100 text-xs font-semibold text-neutral-400"
                                  : "h-10 rounded-xl border border-neutral-200 bg-white text-xs font-semibold text-neutral-900 hover:bg-neutral-50"
                            }
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="rounded-2xl border border-neutral-200 bg-white p-5 h-fit">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-neutral-900">План</div>
            <div className="text-xs text-neutral-500">60 хв</div>
          </div>

          <div className="mt-3 -mx-5 border-t border-neutral-200 px-5 py-4">
            {tutor ? (
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-neutral-600">Ваш репетитор</div>
                  <div className="mt-1 text-sm font-semibold text-neutral-900 truncate">{tutor.name}</div>
                  <div className="mt-1 text-xs text-neutral-600">
                    Баланс з цим репетитором: {lessonCredits == null ? "…" : `${Math.max(0, Math.floor(Number(lessonCredits) || 0))} уроків`}
                  </div>
                </div>
                {tutor.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tutor.avatarUrl}
                    alt=""
                    className="h-12 w-12 rounded-2xl object-cover bg-neutral-100 ring-1 ring-neutral-300"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-600 font-semibold ring-1 ring-neutral-300">
                    {(tutor.name || "R").slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
            ) : null}

            <div className="text-sm font-semibold text-neutral-900">
              {displayRequiredCount <= 0
                ? "Немає кредитів для планування уроків"
                : `Треба запланувати ${displayRequiredCount} урок${
                    displayRequiredCount === 1 ? "" : displayRequiredCount >= 2 && displayRequiredCount <= 4 ? "и" : "ів"
                  }`}
            </div>
            <div className="mt-1 text-xs text-neutral-600">Оберіть слоти для разових уроків.</div>

            {displayRequiredCount > 0 ? (
              <div className="mt-4 space-y-2">
                {Array.from({ length: displayRequiredCount }).map((_, idx) => {
                  const weekly = weeklyPicks[idx];
                  const oneTime = oneTimePicks[idx];
                  return (
                    <div key={idx} className="h-10 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-3 flex items-center text-sm text-neutral-700">
                      {mode === "weekly"
                        ? weekly
                          ? `${days.find((d) => d.date.getUTCDay() === weekly.weekday)?.label || ""} ${weekly.time}`
                          : `Щотижневий урок ${idx + 1}`
                        : oneTime
                          ? new Date(oneTime.start).toLocaleString(dateLocale)
                          : `Урок ${idx + 1}`}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4">
                <Link
                  href={`/${locale}/tutors/${encodeURIComponent(String(tutorId))}`}
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-pink-500 px-5 text-sm font-semibold text-white hover:bg-pink-600"
                >
                  Купити ще уроки
                </Link>
              </div>
            )}

            <button
              type="button"
              disabled={rescheduleId ? !canConfirm() : !(canConfirm() || canConfirmPartial())}
              onClick={() => {
                if (rescheduleId) {
                  confirmSchedule();
                  return;
                }
                if (mode === "one_time" && canConfirmPartial() && !canConfirm()) {
                  confirmSchedule({ partial: true });
                  return;
                }
                confirmSchedule();
              }}
              className={
                rescheduleId
                  ? canConfirm()
                    ? "mt-4 w-full h-11 rounded-xl bg-black px-5 text-sm font-semibold text-white hover:bg-neutral-800"
                    : "mt-4 w-full h-11 rounded-xl bg-neutral-200 px-5 text-sm font-semibold text-neutral-500"
                  : canConfirm() || canConfirmPartial()
                    ? "mt-4 w-full h-11 rounded-xl bg-black px-5 text-sm font-semibold text-white hover:bg-neutral-800"
                    : "mt-4 w-full h-11 rounded-xl bg-neutral-200 px-5 text-sm font-semibold text-neutral-500"
              }
            >
              {confirming
                ? "Опрацьовуємо…"
                : rescheduleId
                  ? "Перенести урок"
                  : mode === "weekly"
                    ? "Запланувати щотижневий урок"
                    : canConfirm()
                      ? "Запланувати уроки"
                      : `Запланувати вибрані (${selectedCount})`}
            </button>
            {confirmErr ? <div className="mt-3 text-sm text-red-700">{confirmErr}</div> : null}

            <div className="mt-3 text-xs text-neutral-500">
              {rescheduleId
                ? "Перенесення доступне щонайменше за " + String(leadHoursUi) + " год до нового часу уроку."
                : "Найближчі доступні слоти показуємо щонайменше за " + String(leadHoursUi) + " год до початку."}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
