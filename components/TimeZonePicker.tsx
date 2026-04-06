"use client";

import { useEffect, useMemo, useState } from "react";

function tzToCity(tz: string) {
  const last = String(tz || "").split("/").pop() || "";
  return last.replace(/_/g, " ");
}

function getTimeInTimeZone(timeZone: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date());
  } catch {
    return "";
  }
}

function getGmtOffsetLabelForTimeZone(timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" }).formatToParts(new Date());
    const tzName = parts.find((p) => p.type === "timeZoneName")?.value || "";
    const cleaned = tzName.replace("UTC", "GMT").replace("GMT", "GMT");
    const m = cleaned.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
    if (!m) return tzName;
    const sign = m[1];
    const hh = String(m[2]).padStart(2, "0");
    const mm = String(m[3] || "00");
    return `GMT${sign}${hh}:${mm}`;
  } catch {
    return "";
  }
}

function getTimeZoneOptions(): string[] {
  const popular = [
    "Europe/Kyiv",
    "Europe/Warsaw",
    "Europe/Berlin",
    "Europe/Paris",
    "Europe/London",
    "Europe/Istanbul",
    "America/New_York",
    "America/Chicago",
    "America/Los_Angeles",
    "America/Toronto",
    "Asia/Dubai",
    "Asia/Tokyo",
  ];

  let all: string[] = [];
  try {
    const anyIntl: any = Intl as any;
    all = Array.isArray(anyIntl?.supportedValuesOf) ? anyIntl.supportedValuesOf("timeZone") : [];
  } catch {
    all = [];
  }

  if (!all.length) all = popular;

  const uniq = new Set<string>();
  const out: string[] = [];
  for (const z of popular) {
    if (!uniq.has(z)) {
      uniq.add(z);
      out.push(z);
    }
  }
  const rest = all.filter((z) => !uniq.has(z)).sort((a, b) => a.localeCompare(b));
  return [...out, ...rest];
}

export default function TimeZonePicker({
  value,
  onChange,
  disabled,
  locale,
  label = "Timezone",
}: {
  value: string;
  onChange: (tz: string) => void;
  disabled?: boolean;
  locale: string;
  label?: string;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const options = useMemo(() => getTimeZoneOptions(), []);

  const currentTime = useMemo(() => {
    if (!value) return "";
    try {
      return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: value }).format(now);
    } catch {
      return "";
    }
  }, [locale, now, value]);

  const currentGmt = useMemo(() => (value ? getGmtOffsetLabelForTimeZone(value) : ""), [value]);

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="text-xs font-semibold text-neutral-700 shrink-0">{label}</div>
        {value ? (
          <div className="text-xs text-neutral-500 whitespace-nowrap">
            {currentTime ? `${currentTime} ` : ""}
            {currentGmt ? `(${currentGmt})` : ""}
          </div>
        ) : null}
      </div>

      <div className="mt-2">
        <div className="relative">
          <select
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={!!disabled}
            className="w-full max-w-full min-w-0 h-9 rounded-xl border border-neutral-200 bg-white px-3 pr-10 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 appearance-none overflow-hidden text-ellipsis whitespace-nowrap"
          >
            {options.map((z) => {
              const time = getTimeInTimeZone(z, locale);
              const gmt = getGmtOffsetLabelForTimeZone(z);
              const tail = [gmt, z, tzToCity(z)].filter(Boolean).join(" · ");
              return (
                <option key={z} value={z}>
                  {time ? `${time} — ` : ""}
                  {tail}
                </option>
              );
            })}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-neutral-400">▾</div>
        </div>
      </div>
    </div>
  );
}
