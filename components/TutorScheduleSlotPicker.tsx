"use client";

import { useMemo, useState } from "react";

type AvailWindow = {
  weekday: number;
  startMin: number;
  endMin: number;
  timezone: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function minutesToHHMM(min: number) {
  const m = Math.max(0, Math.min(24 * 60, Math.floor(min)));
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${pad2(hh)}:${pad2(mm)}`;
}

function slotKey(weekday: number, startMin: number) {
  return `${weekday}:${startMin}`;
}

export function windowsToSlotSet(windows: AvailWindow[], stepMin: number): Set<string>;
export function windowsToSlotSet(windows: AvailWindow[], stepMin: number, blockMinutes: number): Set<string>;
export function windowsToSlotSet(windows: AvailWindow[], stepMin: number, blockMinutes?: number): Set<string> {
  const set = new Set<string>();
  const block = Math.max(stepMin, Number(blockMinutes || stepMin) || stepMin);
  for (const w of Array.isArray(windows) ? windows : []) {
    const wd = Number(w.weekday);
    const start = Number(w.startMin);
    const end = Number(w.endMin);
    if (!Number.isFinite(wd) || wd < 0 || wd > 6) continue;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    for (let t = start; t + block <= end; t += stepMin) {
      set.add(slotKey(wd, t));
    }
  }
  return set;
}

export function slotSetToWindows(keys: Set<string>, timezone: string, stepMin: number, blockMinutes?: number): AvailWindow[] {
  const block = Math.max(stepMin, Number(blockMinutes || stepMin) || stepMin);
  const byDay = new Map<number, Array<{ start: number; end: number }>>();

  for (const k of Array.from(keys)) {
    const [a, b] = String(k).split(":");
    const wd = Number(a);
    const startMin = Number(b);
    if (!Number.isFinite(wd) || wd < 0 || wd > 6) continue;
    if (!Number.isFinite(startMin) || startMin < 0 || startMin >= 1440) continue;
    const endMin = startMin + block;
    if (endMin <= startMin || endMin > 24 * 60) continue;
    const list = byDay.get(wd) || [];
    list.push({ start: startMin, end: endMin });
    byDay.set(wd, list);
  }

  const out: AvailWindow[] = [];
  for (const wd of [0, 1, 2, 3, 4, 5, 6]) {
    const segs = (byDay.get(wd) || []).sort((x, y) => x.start - y.start);
    if (!segs.length) continue;
    let curStart = segs[0].start;
    let curEnd = segs[0].end;
    for (let i = 1; i < segs.length; i++) {
      const s = segs[i];
      if (s.start <= curEnd) {
        curEnd = Math.max(curEnd, s.end);
        continue;
      }
      out.push({ weekday: wd, startMin: curStart, endMin: curEnd, timezone });
      curStart = s.start;
      curEnd = s.end;
    }
    out.push({ weekday: wd, startMin: curStart, endMin: curEnd, timezone });
  }
  return out;
}

export default function TutorScheduleSlotPicker({
  selected,
  setSelected,
  disabled,
  blockMinutes = 60,
  stepMin = 30,
  startOfDayMin = 6 * 60,
  endOfDayMin = 24 * 60,
}: {
  selected: Set<string>;
  setSelected: (next: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  disabled?: boolean;
  blockMinutes?: number;
  stepMin?: number;
  startOfDayMin?: number;
  endOfDayMin?: number;
}) {
  const [infoOpen, setInfoOpen] = useState(false);

  const dayLabels = useMemo(() => ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"], []);
  const times = useMemo(() => {
    const out: number[] = [];
    for (let t = startOfDayMin; t < endOfDayMin; t += stepMin) out.push(t);
    return out;
  }, [endOfDayMin, startOfDayMin, stepMin]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-neutral-600">Натискай на час, щоб зробити його доступним.</div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setInfoOpen((v) => !v)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
            aria-label="Info"
            aria-expanded={infoOpen}
          >
            i
          </button>
          {infoOpen ? (
            <div className="absolute right-0 mt-2 w-64 rounded-xl border border-neutral-200 bg-white p-3 text-xs text-neutral-700 shadow-lg z-20">
              <div className="flex items-start gap-2">
                <span className="inline-block h-3 w-3 rounded bg-emerald-600 mt-0.5" />
                <span>Зелений — час доступний для бронювання</span>
              </div>
              <div className="mt-2 flex items-start gap-2">
                <span className="inline-block h-3 w-3 rounded bg-white border border-neutral-200 mt-0.5" />
                <span>Білий — недоступний</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 max-w-full overflow-x-auto overflow-y-hidden">
        <div className="grid w-max min-w-[720px] grid-cols-[44px_repeat(7,96px)] gap-1">
          <div />
          {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
            <div key={wd} className="text-center text-[11px] font-semibold text-neutral-700">
              {dayLabels[wd]}
            </div>
          ))}

          {times.map((t) => {
            const label = minutesToHHMM(t);
            return (
              <div key={t} className="contents">
                <div className="pr-1 text-right text-[11px] text-neutral-500 leading-8 select-none">{label}</div>
                {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
                  const k = slotKey(wd, t);
                  const isOn = selected.has(k);
                  const canFit = t + Math.max(stepMin, Number(blockMinutes || stepMin) || stepMin) <= endOfDayMin;
                  return (
                    <button
                      key={k}
                      type="button"
                      disabled={!!disabled || !canFit}
                      onClick={() => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(k)) next.delete(k);
                          else next.add(k);
                          return next;
                        });
                      }}
                      className={
                        "h-8 rounded-md border text-[11px] transition-colors " +
                        (isOn
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50") +
                        (!canFit ? " opacity-40 cursor-not-allowed" : "")
                      }
                      aria-pressed={isOn}
                    >
                      {isOn ? "✓" : ""}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
