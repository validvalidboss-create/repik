"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

export default function BookPage() {
  const params = useParams<{ locale: string; tutorId: string }>();
  const sp = useSearchParams();
  const embed = (sp?.get("embed") || "") === "1";
  const MIN_LEAD_HOURS = 24;
  const TRIAL_LEAD_HOURS = 1;
  const [canBook, setCanBook] = useState<boolean>(true);
  const [studentOnlyOpen, setStudentOnlyOpen] = useState(false);
  const [tutor, setTutor] = useState<{
    id: string;
    name: string;
    rateCents: number;
    rate30Cents?: number | null;
    currency: string;
    media?: string[];
  } | null>(null);
  const [tutorErr, setTutorErr] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<string>("");// ISO string
  const [slots, setSlots] = useState<{ start: string; end: string }[]>([]);
  const [myBooked, setMyBooked] = useState<{ start: string; end: string }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [durationMin, setDurationMin] = useState<number>(60);
  const [activeDayKey, setActiveDayKey] = useState<string>("");
  const [selected, setSelected] = useState<{ start: string; end: string } | null>(null);
  const [prevWeekHasBookable, setPrevWeekHasBookable] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("Apple Pay");
  const [paymentOpen, setPaymentOpen] = useState<boolean>(false);
  const [methodOpen, setMethodOpen] = useState<boolean>(false);
  const [methodStep, setMethodStep] = useState<"method" | "pickFrom" | "confirm" | "success">("method");
  const [methodErr, setMethodErr] = useState<string>("");
  const [methodLoading, setMethodLoading] = useState<boolean>(false);
  const [byTutor, setByTutor] = useState<Array<{ tutorId: string; tutorName: string; tutorImage: string | null; valueCents: number; credits: number; rateCents: number }>>([]);
  const [fromTutor, setFromTutor] = useState<null | { tutorId: string; tutorName: string; tutorImage: string | null; valueCents: number; credits: number; rateCents: number }>(null);
  const [tutorCredits, setTutorCredits] = useState<number>(0);
  const freeFirstFlow = (sp?.get("freeFirst") || "") === "1";

  async function fetchJsonWithTimeout(url: string, init?: RequestInit, timeoutMs = 15000) {
    const ctrl = new AbortController();
    const id = window.setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...(init || {}), signal: ctrl.signal });
      const data = await res.json().catch(() => null);
      return { res, data };
    } finally {
      window.clearTimeout(id);
    }
  }

  function localDayKey(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
    const as = new Date(aStart).getTime();
    const ae = new Date(aEnd).getTime();
    const bs = new Date(bStart).getTime();
    const be = new Date(bEnd).getTime();
    if (!Number.isFinite(as) || !Number.isFinite(ae) || !Number.isFinite(bs) || !Number.isFinite(be)) return false;
    return as < be && ae > bs;
  }

  useEffect(() => {
    // Prefill from schedule picker if provided
    const qStarts = sp?.get("startsAtISO") || "";
    const qDur = Number(sp?.get("durationMin") || "");
    if (freeFirstFlow) {
      setDurationMin(30);
    } else if (qDur && Number.isFinite(qDur)) {
      const normalized = qDur === 30 || qDur === 60 ? qDur : 60;
      setDurationMin(normalized);
    }
    if (qStarts) {
      const start = new Date(qStarts);
      if (!Number.isNaN(start.getTime())) {
        const lead = freeFirstFlow ? TRIAL_LEAD_HOURS : MIN_LEAD_HOURS;
        const minStartTs = Date.now() + lead * 60 * 60 * 1000;
        if (start.getTime() < minStartTs) return;
        const dur = freeFirstFlow ? 30 : qDur && Number.isFinite(qDur) ? (qDur === 30 || qDur === 60 ? qDur : 60) : durationMin;
        const end = new Date(start.getTime() + dur * 60000);
        setSelected({ start: start.toISOString(), end: end.toISOString() });
        setActiveDayKey(localDayKey(start));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp, freeFirstFlow]);

  useEffect(() => {
    if (!redirectTo) return;
    window.location.href = redirectTo;
  }, [redirectTo]);

  useEffect(() => {
    async function load() {
      try {
        const me = await fetch("/api/me", { cache: "no-store" });
        const mj = await me.json().catch(() => null);
        const role = String(mj?.user?.role || "").toUpperCase();
        if (role === "TUTOR") {
          setCanBook(false);
          setStudentOnlyOpen(true);
        }
      } catch {
        // ignore
      }
      try {
        const res = await fetch(`/api/tutors/${params.tutorId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load tutor");
        setTutor({
          id: data.id,
          name: data.name,
          rateCents: data.rateCents,
          rate30Cents: data.rate30Cents ?? null,
          currency: data.currency,
          media: Array.isArray(data?.media) ? data.media : [],
        });
      } catch (e) {
        setTutorErr((e as Error).message);
      }
    }
    load();
  }, [params.tutorId]);

  useEffect(() => {
    if (!methodOpen) return;
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
  }, [methodOpen]);

  async function loadSlots(base?: string) {
    setLoadingSlots(true);
    try {
      const lead = freeFirstFlow && durationMin === 30 ? TRIAL_LEAD_HOURS : MIN_LEAD_HOURS;
      const minStartTs = Date.now() + lead * 60 * 60 * 1000;

      async function fetchWeekSlots(ws: string) {
        const q = new URLSearchParams({ tutorId: tutor?.id || "", weekStart: ws, durationMin: String(durationMin) });
        let data: any = { slots: [] };
        try {
          const out = await fetchJsonWithTimeout(`/api/tutor/slots?${q.toString()}`, { cache: "no-store" });
          if (out?.res?.ok && out.data) data = out.data;
        } catch {}
        let slotsArr: { start: string; end: string }[] = data.slots || [];
        if (!slotsArr.length) {
          // Fallback: try availability endpoint
          try {
            const from = new Date(ws);
            const to = new Date(from);
            to.setUTCDate(to.getUTCDate() + 7);
            const out = await fetchJsonWithTimeout(
              `/api/tutors/${tutor?.id}/availability?from=${from.toISOString()}&to=${to.toISOString()}&duration=${durationMin}`,
              { cache: "no-store" },
            );
            if (out?.res?.ok) slotsArr = out?.data?.slots || [];
          } catch {}
        }
        if (!slotsArr.length) {
          // Final fallback: generate mock availability next 7 days every :00 and :30 from 09:00-12:00
          const baseDate = new Date(ws);
          const tmp: { start: string; end: string }[] = [];
          for (let d = 0; d < 7; d++) {
            const day = new Date(baseDate);
            day.setUTCDate(day.getUTCDate() + d);
            for (let h = 7; h <= 10; h++) {
              for (const m of [0, 30]) {
                const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h, m));
                const end = new Date(start);
                end.setUTCMinutes(end.getUTCMinutes() + durationMin);
                tmp.push({ start: start.toISOString(), end: end.toISOString() });
              }
            }
          }
          slotsArr = tmp;
        }
        return slotsArr;
      }

      const startWs = base || getWeekStart();
      let chosenWeekStart = startWs;
      let chosenSlots: { start: string; end: string }[] = [];

      if (base) {
        chosenSlots = await fetchWeekSlots(startWs);
      } else {
        // Auto-skip empty weeks only on initial load (no explicit base)
        for (let w = 0; w < 8; w += 1) {
          const wsDate = new Date(startWs);
          wsDate.setUTCDate(wsDate.getUTCDate() + w * 7);
          const wsISO = wsDate.toISOString();
          const weekSlots = await fetchWeekSlots(wsISO);

          const hasBookable = weekSlots.some((s) => {
            const startTs = new Date(s.start).getTime();
            return Number.isFinite(startTs) && startTs >= minStartTs;
          });
          if (hasBookable) {
            chosenWeekStart = wsISO;
            chosenSlots = weekSlots;
            break;
          }

          // Keep last fetched so UI still shows something if none found.
          chosenWeekStart = wsISO;
          chosenSlots = weekSlots;
        }
      }

      setWeekStart(chosenWeekStart);

      // Fetch student's own bookings for the chosen week and filter conflicting slots
      let bookedIntervals: { start: string; end: string }[] = [];
      try {
        const meOut = await fetchJsonWithTimeout("/api/me", { cache: "no-store" }, 12000);
        const mj = meOut?.data;
        const uid = String(mj?.user?.id || "");
        if (uid) {
          const out = await fetchJsonWithTimeout(
            `/api/bookings/me?role=student&userId=${encodeURIComponent(uid)}`,
            { cache: "no-store" },
            12000,
          );
          const data = out?.data;
          const rows = Array.isArray(data?.bookings) ? data.bookings : [];
          bookedIntervals = rows
            .filter((b: any) => {
              const st = String(b?.status || "").toUpperCase();
              if (st === "CANCELED" || st === "REFUNDED") return false;
              return true;
            })
            .map((b: any) => ({
              start: new Date(b.startsAt).toISOString(),
              end: new Date(b.endsAt).toISOString(),
            }));
        }
      } catch {
        bookedIntervals = [];
      }

      setMyBooked(bookedIntervals);
      setSlots(chosenSlots);
      // Keep active day within selected week to avoid UI jumping
      const wsDate = new Date(chosenWeekStart);
      const weekDays: string[] = [];
      for (let i = 0; i < 7; i += 1) {
        const d = new Date(wsDate);
        d.setDate(d.getDate() + i);
        weekDays.push(localDayKey(d));
      }
      const bookableDays = new Set<string>();
      for (const s of chosenSlots) {
        const startTs = new Date(s.start).getTime();
        if (!Number.isFinite(startTs) || startTs < minStartTs) continue;
        bookableDays.add(localDayKey(new Date(s.start)));
      }

      setActiveDayKey((prev) => {
        const prevKey = String(prev || "");
        if (weekDays.includes(prevKey) && bookableDays.has(prevKey)) return prevKey;
        const todayKey = localDayKey(new Date());
        if (weekDays.includes(todayKey) && bookableDays.has(todayKey)) return todayKey;
        const firstBookable = weekDays.find((k) => bookableDays.has(k));
        return firstBookable || weekDays[0] || todayKey;
      });
      setSelected((prev) => {
        if (!prev) return null;
        const exists = chosenSlots.some((s) => s?.start === prev.start);
        if (!exists) return null;
        const ts = new Date(prev.start).getTime();
        if (!Number.isFinite(ts) || ts < minStartTs) return null;
        if (bookedIntervals.some((b) => overlaps(prev.start, prev.end, b.start, b.end))) return null;
        return prev;
      });
    } finally {
      setLoadingSlots(false);
    }
  }

  useEffect(() => {
    if (tutor?.id) loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutor?.id, durationMin]);

  async function createBooking(opts?: { useCredits?: boolean; transferKey?: string }) {
    if (!selected) throw new Error("NO_SLOT");
    const startsAtISO = selected.start;
    const createRes = await fetch("/api/bookings/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tutorId: tutor?.id,
        startsAtISO,
        durationMin,
        freeFirst: freeFirstFlow,
        useCredits: !!opts?.useCredits,
        transferKey: String(opts?.transferKey || "").trim() || undefined,
      }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) {
      const msg = String(createData?.error || "Booking create failed");
      if (msg.toUpperCase().includes("CONFLICT") || msg.toUpperCase().includes("У ВАС ВЖЕ Є") || msg.toUpperCase().includes("ОБЕРІТЬ ІНШИЙ")) {
        try {
          setSelected(null);
          await loadSlots();
        } catch {
          // ignore
        }
      }
      throw new Error(msg);
    }
    const booking = createData.booking as { id: string; paymentId?: string | null; status?: string | null };
    return booking;
  }

  async function handlePay() {
    if (!canBook) {
      setResult({ error: "Бронювання доступне лише для учнів" });
      setStudentOnlyOpen(true);
      return;
    }
    if (!selected) return;

    if (!freeFirstFlow) {
      setMethodErr("");
      setMethodLoading(false);
      setFromTutor(null);
      setMethodStep("method");
      setMethodOpen(true);
      try {
        const [balRes, listRes] = await Promise.all([
          fetch(`/api/lesson-balance?tutorId=${encodeURIComponent(String(tutor?.id || ""))}`, { cache: "no-store" }),
          fetch("/api/lesson-balance", { cache: "no-store" }),
        ]);
        const balJson = await balRes.json().catch(() => null);
        const listJson = await listRes.json().catch(() => null);
        const tutorCreditsNext = Math.max(0, Math.floor(Number(balJson?.credits ?? 0) || 0));
        const byTutorNext = Array.isArray(listJson?.byTutor) ? listJson.byTutor : [];
        setTutorCredits(tutorCreditsNext);
        setByTutor(byTutorNext);

        const hasAnyCredits =
          tutorCreditsNext > 0 ||
          (Array.isArray(byTutorNext)
            ? byTutorNext.some((x: any) => Math.max(0, Math.floor(Number(x?.credits ?? 0) || 0)) > 0)
            : false);

        if (!hasAnyCredits) {
          setMethodOpen(false);
          await startPayFlow();
          return;
        }
      } catch {
        setTutorCredits(0);
        setByTutor([]);
      }
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const booking = await createBooking();
      const locale = params.locale;

      const paymentId = String((booking as any)?.paymentId || "");
      const status = String((booking as any)?.status || "");
      const isFree = paymentId === "free_first" || paymentId.startsWith("credits") || status === "CONFIRMED";
      if (isFree) {
        setResult({ ok: true, bookingId: booking.id, startsAtISO: selected?.start, durationMin });
        try {
          window.dispatchEvent(new Event("lesson-balance-changed"));
        } catch {}
        setRedirectTo(`/${locale}/dashboard?tab=lessons#schedule`);
        return;
      }

      setRedirectTo(`/${locale}/pay/${booking.id}`);
    } catch (e) {
      setResult({ error: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  // Derived: days for current week and slots per active day
  const days: { key: string; label: string; date: Date }[] = (() => {
    if (!weekStart) return [] as any;
    const out: any[] = [];
    const base = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      const key = localDayKey(d);
      const label = `${d.toLocaleDateString(undefined, { weekday: "short" })} ${d.getUTCDate()}`;
      out.push({ key, label, date: d });
    }
    return out;
  })();
  const leadForUi = freeFirstFlow && durationMin === 30 ? TRIAL_LEAD_HOURS : MIN_LEAD_HOURS;
  const minStartTs = Date.now() + leadForUi * 60 * 60 * 1000;
  const slotsForActiveDay = slots.filter((s) => {
    if (!activeDayKey) return false;
    return localDayKey(new Date(s.start)) === activeDayKey;
  });

  const dayHasBookableAfterLead = (dayKey: string) => {
    if (!dayKey) return false;
    return slots.some((s) => {
      if (localDayKey(new Date(s.start)) !== dayKey) return false;
      const ts = new Date(s.start).getTime();
      return Number.isFinite(ts) && ts >= minStartTs;
    });
  };

  const basePriceCents = (() => {
    if (!tutor) return 0;
    if (durationMin === 30) {
      const r30 = tutor.rate30Cents;
      if (typeof r30 === "number" && Number.isFinite(r30) && r30 >= 0) return r30;
      return Math.round((Number(tutor.rateCents || 0) || 0) / 2);
    }
    return Number(tutor.rateCents || 0) || 0;
  })();
  const studentFeeCents = Math.round(basePriceCents * 0.02);
  const totalPriceCents = basePriceCents + studentFeeCents;
  const tutorRegular60PriceCents = Number(tutor?.rateCents || 0) || 0;

  const creditValueCents = basePriceCents;

  const transferPreview = useMemo(() => {
    if (!fromTutor) return null;
    const fromValueCents = Math.max(0, Math.floor(Number((fromTutor as any)?.valueCents ?? 0) || 0));
    const needValueCents = Math.max(0, Math.floor(Number(creditValueCents || 0) || 0));
    const shortageCents = Math.max(0, needValueCents - fromValueCents);
    return {
      ok: shortageCents <= 0,
      fromValueCents,
      needValueCents,
      shortageCents,
    };
  }, [fromTutor, creditValueCents]);

  async function startPayFlow() {
    setMethodOpen(false);
    setLoading(true);
    setResult(null);
    try {
      const booking = await createBooking();
      setRedirectTo(`/${params.locale}/pay/${booking.id}`);
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : "Booking create failed" });
    } finally {
      setLoading(false);
    }
  }

  async function confirmWithCredits() {
    if (methodLoading) return;
    setMethodLoading(true);
    setMethodErr("");
    try {
      const booking = await createBooking({ useCredits: true });
      setMethodStep("success");
      setResult({ ok: true, bookingId: booking.id });
      try {
        window.dispatchEvent(new Event("lesson-balance-changed"));
      } catch {}
    } catch (e) {
      setMethodErr(e instanceof Error ? e.message : "Не вдалося забронювати");
    } finally {
      setMethodLoading(false);
    }
  }

  async function confirmTransferAndBook() {
    if (!fromTutor) return;
    if (methodLoading) return;
    setMethodLoading(true);
    setMethodErr("");
    try {
      const transferKey = `book-transfer:${String(fromTutor.tutorId)}:${String(tutor?.id || "")}?:${Date.now()}`;
      const res = await fetch("/api/credits/transfer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "money",
          fromTutorId: String(fromTutor.tutorId),
          toTutorId: String(tutor?.id || ""),
          valueCents: Number(creditValueCents),
          transferKey,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(String(json?.error || "Не вдалося виконати переказ"));

      try {
        window.dispatchEvent(new Event("lesson-balance-changed"));
      } catch {}

      const booking = await createBooking({ useCredits: true, transferKey });
      setMethodStep("success");
      setResult({ ok: true, bookingId: booking.id });
    } catch (e) {
      setMethodErr(e instanceof Error ? e.message : "Не вдалося виконати переказ");
    } finally {
      setMethodLoading(false);
    }
  }

  const slotLabel = selected ? new Date(selected.start).toLocaleString() : "";

  function getWeekStart(d = new Date()) {
    const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = copy.getUTCDay();
    const diff = (day + 6) % 7; // Monday=0
    copy.setUTCDate(copy.getUTCDate() - diff);
    return copy.toISOString();
  }

  const currentWeekStart = getWeekStart(new Date());
  const maxWeekStart = (() => {
    const d = new Date(currentWeekStart);
    d.setUTCDate(d.getUTCDate() + 28);
    return d.toISOString();
  })();

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    (async () => {
      try {
        if (!tutor?.id || !weekStart) {
          if (!cancelled) setPrevWeekHasBookable(false);
          return;
        }
        const wsTs = new Date(weekStart).getTime();
        const curTs = new Date(currentWeekStart).getTime();
        if (!Number.isFinite(wsTs) || wsTs <= curTs) {
          if (!cancelled) setPrevWeekHasBookable(false);
          return;
        }

        const prev = new Date(weekStart);
        prev.setUTCDate(prev.getUTCDate() - 7);
        const prevISO = prev.toISOString();
        if (new Date(prevISO).getTime() < curTs) {
          if (!cancelled) setPrevWeekHasBookable(false);
          return;
        }

        const minStartTs = Date.now() + MIN_LEAD_HOURS * 60 * 60 * 1000;
        const q = new URLSearchParams({ tutorId: tutor.id, weekStart: prevISO, durationMin: String(durationMin) });
        const res = await fetch(`/api/tutor/slots?${q.toString()}`, { signal: ctrl.signal });
        const data = await res.json().catch(() => null);
        const arr: { start: string; end: string }[] = Array.isArray(data?.slots) ? data.slots : [];
        const has = arr.some((s) => {
          const ts = new Date(s.start).getTime();
          return Number.isFinite(ts) && ts >= minStartTs;
        });
        if (!cancelled) setPrevWeekHasBookable(has);
      } catch {
        if (!cancelled) setPrevWeekHasBookable(false);
      }
    })();
    return () => {
      cancelled = true;
      try {
        ctrl.abort();
      } catch {
        // ignore
      }
    };
  }, [tutor?.id, weekStart, durationMin, currentWeekStart]);

  return (
    <div className={embed ? "px-0 py-0" : "container mx-auto px-4 py-6"}>
      {methodOpen ? (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setMethodOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-neutral-200 p-5">
            <div className="relative flex items-center justify-between gap-3">
              {methodStep === "method" ? <div className="h-10 w-10" /> : (
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-neutral-100 text-neutral-800"
                  onClick={() => {
                    if (methodStep === "pickFrom") setMethodStep("method");
                    else if (methodStep === "confirm") setMethodStep("pickFrom");
                    else if (methodStep === "success") setMethodOpen(false);
                  }}
                  aria-label="Back"
                >
                  ←
                </button>
              )}

              <div className="absolute left-0 right-0 text-center pointer-events-none">
                <div className="text-base font-semibold text-neutral-900">
                  {methodStep === "method"
                    ? "Як ви хочете сплатити?"
                    : methodStep === "pickFrom"
                      ? "Які уроки перевести?"
                      : methodStep === "confirm"
                        ? "Перевірте деталі переказу"
                        : "Успішно"}
                </div>
              </div>

              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-neutral-100 text-neutral-800"
                onClick={() => setMethodOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-4">
              {methodStep === "method" ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    className="w-full rounded-2xl border border-neutral-200 bg-white p-4 text-left hover:bg-neutral-50"
                    onClick={() => {
                      if (tutorCredits > 0) {
                        confirmWithCredits();
                        return;
                      }
                      setMethodStep("pickFrom");
                    }}
                  >
                    <div className="text-sm font-semibold text-neutral-900">Скористатися своїм балансом</div>
                    <div className="mt-1 text-xs text-neutral-600">Переведіть або використайте баланс, щоб забронювати урок</div>
                  </button>

                  <button
                    type="button"
                    className="w-full rounded-2xl border border-neutral-200 bg-white p-4 text-left hover:bg-neutral-50"
                    onClick={async () => {
                      setMethodOpen(false);
                      setLoading(true);
                      setResult(null);
                      try {
                        const booking = await createBooking();
                        setRedirectTo(`/${params.locale}/pay/${booking.id}`);
                      } catch (e) {
                        setResult({ error: e instanceof Error ? e.message : "Booking create failed" });
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    <div className="text-sm font-semibold text-neutral-900">Сплатити зі свого способу оплати</div>
                    <div className="mt-1 text-xs text-neutral-600">Перейдіть до оформлення та оплатіть урок</div>
                  </button>

                  {methodErr ? <div className="text-sm text-red-600">{methodErr}</div> : null}
                </div>
              ) : null}

              {methodStep === "pickFrom" ? (
                <div>
                  <div className="text-sm text-neutral-600">Оберіть баланс, який хочете перевести</div>
                  <div className="mt-3 space-y-2">
                    {byTutor
                      .filter((t) => String(t?.tutorId || "") && String(t?.tutorId || "") !== String(tutor?.id || ""))
                      .map((t) => {
                        const img = t.tutorImage;
                        const name = String(t.tutorName || "Викладач");
                        const uah = Math.max(0, Math.round((Number(t.valueCents || 0) || 0) / 100));
                        return (
                          <button
                            key={String(t.tutorId)}
                            type="button"
                            className="w-full flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-3 hover:bg-neutral-50"
                            onClick={() => {
                              setFromTutor(t);
                              setMethodStep("confirm");
                            }}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="h-10 w-10 overflow-hidden rounded-2xl ring-1 ring-neutral-200 bg-white text-neutral-700 flex items-center justify-center text-xs font-semibold">
                                {img ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={img} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  name.slice(0, 2).toUpperCase()
                                )}
                              </div>
                              <div className="min-w-0 text-left">
                                <div className="truncate text-sm font-semibold text-neutral-900">{name}</div>
                                <div className="mt-0.5 text-xs text-neutral-600">перевести ₴{uah}</div>
                              </div>
                            </div>
                            <div className="text-neutral-400">›</div>
                          </button>
                        );
                      })}
                  </div>

                  {methodErr ? <div className="mt-3 text-sm text-red-600">{methodErr}</div> : null}
                </div>
              ) : null}

              {methodStep === "confirm" ? (
                <div>
                  {fromTutor ? (
                    <>
                      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                        <div className="flex items-center justify-between text-sm">
                          <div className="text-neutral-600">Баланс з {fromTutor.tutorName}</div>
                          <div className="font-semibold text-neutral-900">₴{Math.max(0, Math.round((Number(fromTutor.valueCents || 0) || 0) / 100))}</div>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-sm">
                          <div className="text-neutral-600">Урок</div>
                          <div className="font-semibold text-neutral-900">₴{Math.max(0, Math.round((Number(creditValueCents || 0) || 0) / 100))}</div>
                        </div>
                      </div>

                      {transferPreview && !transferPreview.ok ? (
                        <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                          <div className="text-sm font-semibold text-neutral-900">Недостатньо балансу</div>
                          <div className="mt-2 text-sm text-neutral-700">
                            Доступно: <span className="font-semibold text-neutral-900">₴{Math.max(0, Math.round(transferPreview.fromValueCents / 100))}</span>
                            {" "}
                            · потрібно: <span className="font-semibold text-neutral-900">₴{Math.max(0, Math.round(transferPreview.needValueCents / 100))}</span>
                          </div>
                          <div className="mt-2 text-sm text-neutral-700">
                            Не вистачає: <span className="font-semibold text-neutral-900">₴{Math.max(0, Math.round(transferPreview.shortageCents / 100))}</span>
                          </div>

                          <button
                            type="button"
                            onClick={startPayFlow}
                            className="mt-4 inline-flex w-full h-12 items-center justify-center rounded-2xl bg-black px-5 text-sm font-semibold text-white hover:bg-neutral-800"
                          >
                            Оплатити
                          </button>
                        </div>
                      ) : null}

                      {methodErr ? <div className="mt-3 text-sm text-red-600">{methodErr}</div> : null}

                      <button
                        type="button"
                        disabled={methodLoading || (transferPreview ? !transferPreview.ok : false)}
                        onClick={confirmTransferAndBook}
                        className={
                          !methodLoading && (transferPreview ? transferPreview.ok : true)
                            ? "mt-5 w-full h-12 rounded-2xl bg-pink-500 px-5 text-sm font-semibold text-white hover:bg-pink-600"
                            : "mt-5 w-full h-12 rounded-2xl bg-pink-200 px-5 text-sm font-semibold text-white cursor-not-allowed"
                        }
                      >
                        {methodLoading ? "Переказуємо…" : "Підтвердити переказ"}
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}

              {methodStep === "success" ? (
                <div>
                  <div className="rounded-2xl bg-pink-50 border border-pink-200 p-4">
                    <div className="text-sm font-semibold text-neutral-900">Успішно заброньовано</div>
                    <div className="mt-2 text-sm text-neutral-800">Урок з’явиться у розкладі.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = `/${params.locale}/dashboard`;
                    }}
                    className="mt-5 inline-flex w-full h-12 items-center justify-center rounded-2xl bg-black px-5 text-sm font-semibold text-white hover:bg-neutral-800"
                  >
                    Окей
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {freeFirstFlow && result?.ok && result?.bookingId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => {}}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <div className="text-lg font-semibold text-neutral-900">✅ Успішно заброньовано</div>
            <div className="mt-3 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-neutral-100 border border-neutral-200 overflow-hidden flex items-center justify-center flex-none">
                {tutor?.media?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={tutor.media[0]} alt={tutor?.name || "Tutor"} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-sm font-semibold text-neutral-500">{String(tutor?.name || "T").slice(0, 1).toUpperCase()}</div>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-neutral-900 truncate">{tutor?.name || "Tutor"}</div>
                <div className="text-xs text-neutral-600">
                  Звичайна ціна: {(Number(tutor?.rateCents || 0) / 100).toFixed(0)} {tutor?.currency || "UAH"} / 60 хв
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800">
              <div>
                <span className="text-neutral-600">Дата і час:</span> {new Date(String(result?.startsAtISO || "")).toLocaleString()}
              </div>
              <div className="mt-1">
                <span className="text-neutral-600">Тривалість:</span> {Number(result?.durationMin || 30)} хв
              </div>
              <div className="mt-1">
                <span className="text-neutral-600">До оплати:</span> 0 {tutor?.currency || "UAH"}
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  window.location.href = `/${params.locale}/dashboard`;
                }}
                className="flex-1 h-10 rounded-xl bg-black px-4 text-sm font-semibold text-white"
              >
                Перейти к графіку
              </button>
            </div>
            <div className="mt-3 text-xs text-neutral-500">Урок з’явиться у розкладі.</div>
          </div>
        </div>
      ) : null}
      {!canBook ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Бронювання доступне лише для учнів. Перемкніть акаунт на учня, щоб забронювати урок.
        </div>
      ) : null}

      {studentOnlyOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setStudentOnlyOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-lg font-semibold text-neutral-900">Зайдіть як учень</div>
            <div className="mt-2 text-sm text-neutral-700">
              Бронювання уроків доступне лише для учнів. Вийдіть з акаунта викладача та увійдіть як учень.
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setStudentOnlyOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
              >
                Закрити
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {tutorErr && <div className="py-16">{tutorErr}</div>}
      {!tutor && !tutorErr && <div className="py-16">Loading...</div>}
      {tutor && (
        <>
          <div className="mx-auto w-full max-w-[920px]">
            <h1 className="text-xl font-semibold mb-2">Урок {durationMin} хв</h1>
            <p className="text-muted-foreground mb-4">Оберіть зручний час, потім перейдіть до оплати.</p>

          {/* Duration tabs */}
          {freeFirstFlow ? (
            <div className="inline-flex rounded-full border p-1 gap-1 mb-3 bg-white">
              <div className="px-3 py-1 rounded-full text-sm bg-black text-white">30 хв</div>
            </div>
          ) : (
            <div className="inline-flex rounded-full border p-1 gap-1 mb-3 bg-white">
              {[30, 60].map((d) => (
                <button
                  key={d}
                  onClick={() => setDurationMin(d)}
                  className={`px-3 py-1 rounded-full text-sm ${durationMin === d ? "bg-black text-white" : "bg-transparent"}`}
                >
                  {d} хв
                </button>
              ))}
            </div>
          )}

          <section className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="space-y-4">
              {/* Week pager and day strip */}
              <div className="flex items-center justify-between">
                <div className="min-w-[180px] h-[34px] flex items-center">
                  {weekStart && new Date(weekStart).getTime() > new Date(currentWeekStart).getTime() && prevWeekHasBookable ? (
                    <button
                      className="border border-neutral-200 rounded px-3 py-1 hover:bg-neutral-50"
                      onClick={() => {
                        if (!weekStart) return;
                        const prev = new Date(weekStart);
                        prev.setUTCDate(prev.getUTCDate() - 7);
                        const prevISO = prev.toISOString();
                        if (new Date(prevISO).getTime() < new Date(currentWeekStart).getTime()) return;
                        loadSlots(prevISO);
                      }}
                    >
                      ◀ Попередній тиждень
                    </button>
                  ) : null}
                </div>
                <div className="text-sm text-muted-foreground">
                  Тиждень {weekStart ? new Date(weekStart).toLocaleDateString() : ""}
                </div>
                <button
                  className="border border-neutral-200 rounded px-3 py-1 hover:bg-neutral-50"
                  onClick={() => {
                    if (!weekStart) return;
                    const next = new Date(weekStart);
                    next.setUTCDate(next.getUTCDate() + 7);
                    const nextISO = next.toISOString();
                    if (new Date(nextISO).getTime() > new Date(maxWeekStart).getTime()) return;
                    loadSlots(nextISO);
                  }}
                  disabled={!!weekStart && new Date(weekStart).getTime() >= new Date(maxWeekStart).getTime()}
                >
                  Наступний тиждень ▶
                </button>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {days.map((d) => {
                  const isActive = d.key === activeDayKey;
                  const dayEnabled = dayHasBookableAfterLead(d.key);
                  return (
                    <button
                      key={d.key}
                      onClick={() => setActiveDayKey(d.key)}
                      disabled={!dayEnabled}
                      title={!dayEnabled ? `Немає слотів доступних щонайменше за ${leadForUi} год` : ""}
                      className={`min-w-[58px] px-2.5 py-1.5 rounded-lg border text-sm ${
                        !dayEnabled
                          ? "bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed"
                          : isActive
                            ? "bg-black text-white border-black"
                            : "bg-white border-neutral-200"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 min-h-[120px] items-start content-start">
                {loadingSlots && <div className="col-span-full text-sm">Завантаження слотів...</div>}
                {!loadingSlots && slotsForActiveDay.length === 0 && (
                  <div className="col-span-full text-sm">Немає доступних слотів у цей день.</div>
                )}
                {slotsForActiveDay.map((s) => {
                  const dt = new Date(s.start);
                  const hh = dt.getHours().toString().padStart(2, "0");
                  const mm = dt.getMinutes().toString().padStart(2, "0");
                  const label = `${hh}:${mm}`;
                  const active = selected?.start === s.start;
                  const startTs = new Date(s.start).getTime();
                  const tooSoon = !Number.isFinite(startTs) || startTs < minStartTs;
                  const blocked = myBooked.some((b) => overlaps(s.start, s.end, b.start, b.end));
                  const neighborBlocked = (() => {
                    if (blocked) return false;
                    if (!selected) return false;
                    if (durationMin !== 30) return false;
                    const a = new Date(s.start).getTime();
                    const b = new Date(selected.start).getTime();
                    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
                    if (a === b) return false;
                    return Math.abs(a - b) === 30 * 60 * 1000;
                  })();
                  const disabled = tooSoon || blocked || neighborBlocked;
                  return (
                    <button
                      key={s.start}
                      type="button"
                      disabled={disabled}
                      title={
                        tooSoon
                          ? `Можна бронювати щонайменше за ${leadForUi} год до початку`
                          : blocked
                            ? "У вас уже є заброньований урок на цей час"
                            : neighborBlocked
                              ? "Сусідній слот до вибраного часу"
                              : ""
                      }
                      className={`w-full h-10 px-3 text-sm rounded-xl border transition-colors ${
                        disabled
                          ? "bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed"
                          : active
                            ? "bg-black text-white border-black"
                            : "bg-white border-neutral-200 hover:bg-neutral-50"
                      }`}
                      onClick={() => {
                        if (active) {
                          setSelected(null);
                          return;
                        }
                        if (disabled) return;
                        setSelected(s);
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between mt-2">
                <div className="text-sm text-muted-foreground">{slotLabel ? `Selected: ${slotLabel}` : ""}</div>
              </div>

              <div className="text-xs text-neutral-500">
                Бронювання доступне щонайменше за {leadForUi} годин до початку.
              </div>
            </div>
          </section>

          {/* Payment summary & methods (placeholder) */}
          <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="grid md:grid-cols-2 gap-6 md:divide-x md:divide-neutral-200">
              <div className="md:pr-6">
                <div className="text-lg font-medium mb-3">Інформація про оплату</div>
                {freeFirstFlow ? (
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between gap-4"><span className="text-neutral-600">Пробний урок 30 хв</span><span className="font-medium">0 {tutor.currency}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-neutral-600">Звичайна ціна викладача (60 хв)</span><span className="font-medium">{(tutorRegular60PriceCents/100).toFixed(0)} {tutor.currency}</span></div>
                    <div className="flex justify-between gap-4 pt-2 border-t border-neutral-200"><span className="font-semibold">До оплати</span><span className="font-semibold">0 {tutor.currency}</span></div>
                  </div>
                ) : (
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between gap-4"><span className="text-neutral-600">Урок {durationMin} хв</span><span className="font-medium">{(basePriceCents/100).toFixed(0)} {tutor.currency}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-neutral-600">Комісія за обробку</span><span className="font-medium">{(studentFeeCents/100).toFixed(0)} {tutor.currency}</span></div>
                    <div className="flex justify-between gap-4 pt-2 border-t border-neutral-200"><span className="font-semibold">Всього</span><span className="font-semibold">{(totalPriceCents/100).toFixed(0)} {tutor.currency}</span></div>
                  </div>
                )}
              </div>

              <div className="relative md:pl-6">
                {freeFirstFlow ? (
                  <>
                    <div className="text-lg font-medium mb-3">Пробний урок</div>
                    <div className="text-sm text-neutral-600">Перший урок безкоштовно (30 хв). Оберіть час і підтвердьте бронювання.</div>
                    <button
                      type="button"
                      onClick={handlePay}
                      disabled={!selected || loading}
                      className="mt-4 w-full h-11 rounded-xl bg-black px-6 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {loading ? "Processing..." : "Підтвердити безкоштовний урок"}
                    </button>
                    {result?.error ? (
                      <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                        <div className="font-semibold">Не вдалося забронювати</div>
                        <div className="mt-1">{String(result.error || "Помилка")}</div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div className="text-lg font-medium mb-3">Спосіб оплати</div>
                    <div className="relative">
                      <div className="block text-xs text-neutral-500 mb-2">Виберіть спосіб оплати</div>
                      <button
                        type="button"
                        onClick={() => setPaymentOpen((v) => !v)}
                        className="w-full h-11 rounded-xl border border-neutral-200 bg-white px-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 text-left"
                      >
                        {paymentMethod}
                        <span className="pointer-events-none absolute right-3 top-[38px] -translate-y-1/2 text-neutral-400">▾</span>
                      </button>
                      {paymentOpen ? (
                        <div className="absolute left-0 right-0 top-[74px] z-20 rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
                          {(["Apple Pay", "Нова платіжна карта", "PayPal", "Google Pay"] as const).map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => {
                                setPaymentMethod(m);
                                setPaymentOpen(false);
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-50"
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={handlePay}
                      disabled={!selected || loading}
                      className="mt-4 w-full h-11 rounded-xl bg-black px-6 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {loading ? "Processing..." : `Pay ${(totalPriceCents / 100).toFixed(0)} ${tutor.currency}`}
                    </button>
                  </>
                )}

                {!freeFirstFlow && result && (
                  <div className="mt-4 p-3 border rounded bg-neutral-50">
                    <div className="font-medium mb-2">Fondy init response</div>
                    <pre className="text-xs overflow-auto whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          </section>
          </div>
        </>
      )}

    </div>
  );
}
