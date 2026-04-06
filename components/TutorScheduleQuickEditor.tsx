"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TutorScheduleSlotPicker, { slotSetToWindows, windowsToSlotSet } from "@/components/TutorScheduleSlotPicker";
import TimeZonePicker from "@/components/TimeZonePicker";

type AvailWindow = {
  id?: string;
  tutorId?: string;
  weekday: number;
  startMin: number;
  endMin: number;
  timezone: string;
};

async function fetchJsonWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    const data = await res.json().catch(() => null);
    return { res, data };
  } finally {
    clearTimeout(t);
  }
}

export default function TutorScheduleQuickEditor({ locale }: { locale: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string>("");
  const [okMsg, setOkMsg] = useState<string>("");
  const [congratsOpen, setCongratsOpen] = useState(false);
  const [upcomingCount, setUpcomingCount] = useState<number>(0);
  const [upcomingNextISO, setUpcomingNextISO] = useState<string>("");

  const [tz, setTz] = useState<string>(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Kyiv";
    } catch {
      return "Europe/Kyiv";
    }
  });

  const stepMin = 30;
  const startOfDayMin = 6 * 60;
  const endOfDayMin = 24 * 60;
  const blockMinutes = 60;

  const intlLocale = useMemo(() => {
    if (locale === "ru") return "ru-RU";
    if (locale === "en") return "en-US";
    return "uk-UA";
  }, [locale]);

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const initialRef = useRef<{ tz: string; selected: Set<string> } | null>(null);

  const hasUnsavedChanges = useMemo(() => {
    const base = initialRef.current;
    if (!base) return false;
    if (String(base.tz || "") !== String(tz || "")) return true;
    if (base.selected.size !== selected.size) return true;
    for (const k of base.selected) {
      if (!selected.has(k)) return true;
    }
    return false;
  }, [selected, tz]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      setOkMsg("");
      try {
        const [{ res: availRes, data: availData }, { res: upcomingRes, data: upcomingData }] = await Promise.all([
          fetchJsonWithTimeout("/api/tutor/availability/me", 8000),
          fetchJsonWithTimeout("/api/tutor/bookings/upcoming", 8000),
        ]);

        if (!availRes.ok) throw new Error(String(availData?.error || "Failed to load availability"));

        const windows: AvailWindow[] = Array.isArray(availData?.availability) ? availData.availability : [];

        if (cancelled) return;

        const nextSelected = windowsToSlotSet(windows, stepMin, blockMinutes);
        setSelected(nextSelected);
        const anyTz = windows.find((w) => typeof w?.timezone === "string" && String(w.timezone).trim())?.timezone;
        if (anyTz) setTz(String(anyTz));
        initialRef.current = { tz: String(anyTz || tz), selected: new Set(nextSelected) };

        if (upcomingRes.ok) {
          setUpcomingCount(Math.max(0, Number(upcomingData?.count || 0) || 0));
          setUpcomingNextISO(String(upcomingData?.nextStartsAt || ""));
        }
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Failed to load";
        setErr(msg === "The user aborted a request." ? "Не вдалося завантажити дані (timeout)." : msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    if (saving) return;
    setErr("");
    setOkMsg("");

    if (upcomingCount > 0) {
      const ok = window.confirm(
        "У вас є заплановані уроки. Зміни графіка вплинуть лише на майбутні бронювання. Вже заплановані уроки не будуть перенесені. Продовжити?",
      );
      if (!ok) return;
    }

    const windows = slotSetToWindows(selected, tz, stepMin, blockMinutes);

    setSaving(true);
    try {
      const res = await fetch("/api/tutor/availability/upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ windows }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(String(data?.error || "Не вдалося зберегти"));
      setOkMsg("Ваш графік успішно змінено");
      initialRef.current = { tz: String(tz || ""), selected: new Set(selected) };
      setCongratsOpen(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не вдалося зберегти");
    } finally {
      setSaving(false);
    }
  }

  function goBack() {
    if (hasUnsavedChanges) {
      const ok = window.confirm("Ви не зберегли зміни. Вийти без збереження?");
      if (!ok) return;
    }
    window.location.href = `/${locale}/profile`;
  }

  return (
    <div className="mx-auto w-full max-w-full rounded-2xl border border-neutral-200 bg-white p-4 sm:w-max sm:min-w-[720px]">
      {congratsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl">
            <div className="text-lg font-semibold text-neutral-900">Вітаємо!</div>
            <div className="mt-2 text-sm text-neutral-700">Ваш графік успішно змінено.</div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setCongratsOpen(false);
                  window.location.href = `/${locale}/profile`;
                }}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white hover:bg-neutral-800"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm font-semibold text-neutral-900">Графік</div>
        <div className="text-xs text-neutral-500">{loading ? "Завантаження…" : ""}</div>
      </div>

      {err ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</div> : null}
      {okMsg ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{okMsg}</div>
      ) : null}

      {upcomingCount > 0 ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="font-medium">У вас є заплановані уроки</div>
          <div className="mt-1 text-amber-900/90">
            Зміни графіка діють лише для нових бронювань. Вже заплановані уроки не переносяться.
            {upcomingNextISO ? (
              <span className="block mt-1 text-xs text-amber-900/80">Найближчий урок: {new Date(upcomingNextISO).toLocaleString()}</span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
          Зміни графіка впливають лише на майбутні бронювання. Поточні підтверджені уроки не змінюються.
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs text-neutral-600">Вкажи години, коли ти доступний для бронювання.</div>
        </div>
        <div className="w-full sm:w-[280px]">
          <TimeZonePicker value={tz} onChange={setTz} disabled={saving} locale={intlLocale} label="Timezone" />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <TutorScheduleSlotPicker
          selected={selected}
          setSelected={setSelected}
          disabled={saving}
          blockMinutes={blockMinutes}
          stepMin={stepMin}
          startOfDayMin={startOfDayMin}
          endOfDayMin={endOfDayMin}
        />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
        >
          Назад
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {saving ? "Збереження…" : "Зберегти"}
        </button>
      </div>

      <div className="mt-2 text-xs text-neutral-500">
        Після збереження графіка він буде використаний для майбутніх бронювань. Поточні підтверджені уроки не змінюються.
      </div>
    </div>
  );
}
