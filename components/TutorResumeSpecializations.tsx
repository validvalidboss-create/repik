"use client";

import { useMemo, useState } from "react";

type Entry = {
  period?: string;
  title: string;
  subtitle?: string;
  note?: string;
};

type Spec = {
  title: string;
  items?: string[];
};

export default function TutorResumeSpecializations({
  headline,
  education,
  experience,
  specializations,
}: {
  headline?: string | null;
  education?: Entry[];
  experience?: Entry[];
  specializations?: Spec[];
}) {
  const [tab, setTab] = useState<"education" | "experience">("education");

  const edu = useMemo(() => (Array.isArray(education) ? education : []), [education]);
  const exp = useMemo(() => (Array.isArray(experience) ? experience : []), [experience]);
  const specs = useMemo(() => (Array.isArray(specializations) ? specializations : []), [specializations]);

  const hasResume = !!String(headline || "").trim() || edu.length > 0 || exp.length > 0;
  const hasSpecs = specs.some((s) => Array.isArray(s.items) && s.items.length > 0);

  if (!hasResume && !hasSpecs) return null;

  return (
    <section className="mt-12">
      {hasResume ? (
        <>
          <h2 className="text-2xl font-semibold mb-4">Резюме</h2>

          {edu.length > 0 || exp.length > 0 ? (
            <div className="border-b border-neutral-200 mb-6">
              <div className="flex gap-6 text-sm">
                {edu.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setTab("education")}
                    className={
                      tab === "education"
                        ? "pb-3 border-b-2 border-neutral-900 text-neutral-900 font-medium"
                        : "pb-3 text-neutral-600 hover:text-neutral-900"
                    }
                  >
                    Освіта
                  </button>
                ) : null}
                {exp.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setTab("experience")}
                    className={
                      tab === "experience"
                        ? "pb-3 border-b-2 border-neutral-900 text-neutral-900 font-medium"
                        : "pb-3 text-neutral-600 hover:text-neutral-900"
                    }
                  >
                    Досвід роботи
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {headline ? <div className="text-sm text-neutral-700 mb-6">{headline}</div> : null}

          {edu.length > 0 || exp.length > 0 ? (
            <div className="space-y-4">
              {(tab === "education" ? edu : exp).map((e, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-[120px_minmax(0,1fr)] gap-2 sm:gap-6">
                  <div className="text-sm text-neutral-500">{e.period || ""}</div>
                  <div>
                    <div className="text-sm font-medium text-neutral-900">{e.title}</div>
                    {e.subtitle ? <div className="text-sm text-neutral-700">{e.subtitle}</div> : null}
                    {e.note ? <div className="mt-1 text-xs text-emerald-700">{e.note}</div> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {hasSpecs ? (
        <>
          <h3 className="text-2xl font-semibold mt-12 mb-4">Мої спеціалізації</h3>
          <div className="divide-y border border-neutral-200 rounded-xl bg-white">
            {specs
              .filter((s) => Array.isArray(s.items) && s.items.length > 0)
              .map((s) => (
                <details key={s.title} className="group">
                  <summary className="cursor-pointer list-none px-4 py-4 flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-900">{s.title}</span>
                    <span className="text-neutral-500 group-open:rotate-180 transition-transform">⌄</span>
                  </summary>
                  <div className="px-4 pb-4">
                    <ul className="text-sm text-neutral-700 space-y-1">
                      {(s.items || []).map((it) => (
                        <li key={it}>{it}</li>
                      ))}
                    </ul>
                  </div>
                </details>
              ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
