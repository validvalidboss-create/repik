"use client";

import { useEffect, useMemo, useState } from "react";

type AvailWindow = {
  id?: string;
  tutorId?: string;
  weekday: number;
  startMin: number;
  endMin: number;
  timezone: string;
};

type DayRow = { enabled: boolean; start: string; end: string };

function toMinutes(hhmm: string) {
  const [h, m] = String(hhmm || "").split(":").map((x) => Number(x));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function fromMinutes(min: number) {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.floor(min)));
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function TutorQuickSettings({ locale }: { locale: string }) {
  const [loading, setLoading] = useState(true);
  const [savingRate, setSavingRate] = useState(false);
  const [savingAvail, setSavingAvail] = useState(false);
  const [err, setErr] = useState<string>("");
  const [okMsg, setOkMsg] = useState<string>("");

  const [rateUAH, setRateUAH] = useState<number>(300);
  const [currency, setCurrency] = useState<string>("UAH");
  const [tz, setTz] = useState<string>(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Kyiv";
    } catch {
      return "Europe/Kyiv";
    }
  });

  const [avail, setAvail] = useState<DayRow[]>(() =>
    Array.from({ length: 7 }, () => ({ enabled: false, start: "09:00", end: "18:00" }))
  );

  const dayLabels = useMemo(() => ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"], []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const [tutorRes, availRes] = await Promise.all([
          fetch("/api/tutor/me", { cache: "no-store" }),
          fetch("/api/tutor/availability/me", { cache: "no-store" }),
        ]);

        const tutorData = await tutorRes.json().catch(() => null);
        const availData = await availRes.json().catch(() => null);

        if (!tutorRes.ok) throw new Error(String(tutorData?.error || "Failed to load tutor"));
        if (!availRes.ok) throw new Error(String(availData?.error || "Failed to load availability"));

        const t = tutorData?.tutor;
        const rc = Number(t?.rateCents || 0) || 0;
        const cur = String(t?.currency || "UAH");

        const windows: AvailWindow[] = Array.isArray(availData?.availability) ? availData.availability : [];

        if (cancelled) return;

        setRateUAH(Math.max(1, Math.round(rc / 100)));
        setCurrency(cur);

        if (windows.length) {
          const next: DayRow[] = Array.from({ length: 7 }, () => ({ enabled: false, start: "09:00", end: "18:00" }));
          for (const w of windows) {
            const wd = Number(w.weekday);
            if (Number.isNaN(wd) || wd < 0 || wd > 6) continue;
            next[wd] = {
              enabled: true,
              start: fromMinutes(Number(w.startMin) || 0),
              end: fromMinutes(Number(w.endMin) || 0),
            };
            if (w.timezone) setTz(String(w.timezone));
          }
          setAvail(next);
        }
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function saveRate() {
    if (savingRate) return;
    setErr("");
    setOkMsg("");

    const uah = Number(rateUAH);
    if (!Number.isFinite(uah) || uah <= 0) {
      setErr("Вкажіть коректну ціну");
      return;
    }

    setSavingRate(true);
    try {
      const res = await fetch("/api/tutor/profile/quick", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rateUAH: uah, currency }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(String(data?.error || "Не вдалося зберегти"));
      setOkMsg("Збережено");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не вдалося зберегти");
    } finally {
      setSavingRate(false);
    }
  }

  async function saveAvailability() {
    if (savingAvail) return;
    setErr("");
    setOkMsg("");

    const windows = avail
      .map((d, idx) => ({ idx, ...d }))
      .filter((d) => d.enabled)
      .map((d) => ({
        weekday: d.idx,
        startMin: toMinutes(d.start),
        endMin: toMinutes(d.end),
        timezone: tz,
      }))
      .filter((w) => w.endMin > w.startMin);

    setSavingAvail(true);
    try {
      const res = await fetch("/api/tutor/availability/upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ windows }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(String(data?.error || "Не вдалося зберегти"));
      setOkMsg("Збережено");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не вдалося зберегти");
    } finally {
      setSavingAvail(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm font-semibold text-neutral-900">Швидкі налаштування</div>
        <div className="text-xs text-neutral-500">{loading ? "Завантаження…" : ""}</div>
      </div>

      {err ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</div> : null}
      {okMsg ? <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{okMsg}</div> : null}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
        <div>
          <div className="text-xs font-semibold text-neutral-700">Ціна (₴ за годину)</div>
          <input
            type="number"
            inputMode="numeric"
            className="mt-1 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900"
            value={rateUAH}
            onChange={(e) => setRateUAH(Number(e.target.value))}
            disabled={loading || savingRate}
          />
        </div>

        <div>
          <div className="text-xs font-semibold text-neutral-700">Валюта</div>
          <input
            className="mt-1 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            disabled={loading || savingRate}
          />
        </div>

        <button
          type="button"
          onClick={saveRate}
          disabled={loading || savingRate}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {savingRate ? "Збереження…" : "Зберегти ціну"}
        </button>
      </div>

      <div className="mt-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-neutral-900">Графік</div>
            <div className="mt-1 text-xs text-neutral-600">Вкажи години, коли ти доступний для бронювання.</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs font-semibold text-neutral-700">Timezone</div>
            <input
              className="h-9 w-44 rounded-xl border border-neutral-200 bg-white px-3 text-xs text-neutral-900"
              value={tz}
              onChange={(e) => setTz(e.target.value)}
              disabled={loading || savingAvail}
            />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2">
          {avail.map((d, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2">
              <div className="w-10 text-xs font-semibold text-neutral-700">{dayLabels[i]}</div>
              <label className="inline-flex items-center gap-2 text-xs text-neutral-700">
                <input
                  type="checkbox"
                  checked={d.enabled}
                  onChange={(e) =>
                    setAvail((a) => a.map((x, idx) => (idx === i ? { ...x, enabled: e.target.checked } : x)))
                  }
                  disabled={loading || savingAvail}
                />
                Доступний
              </label>
              <input
                type="time"
                className="h-9 rounded-xl border border-neutral-200 bg-white px-2 text-xs"
                value={d.start}
                onChange={(e) => setAvail((a) => a.map((x, idx) => (idx === i ? { ...x, start: e.target.value } : x)))}
                disabled={loading || savingAvail || !d.enabled}
              />
              <span className="text-xs text-neutral-400">—</span>
              <input
                type="time"
                className="h-9 rounded-xl border border-neutral-200 bg-white px-2 text-xs"
                value={d.end}
                onChange={(e) => setAvail((a) => a.map((x, idx) => (idx === i ? { ...x, end: e.target.value } : x)))}
                disabled={loading || savingAvail || !d.enabled}
              />
            </div>
          ))}
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={saveAvailability}
            disabled={loading || savingAvail}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-50"
          >
            {savingAvail ? "Збереження…" : "Зберегти графік"}
          </button>
        </div>

        <div className="mt-2 text-xs text-neutral-500">
          Після збереження графіка він буде використаний для майбутніх бронювань. Поточні підтверджені уроки не змінюються.
        </div>
      </div>
    </div>
  );
}
