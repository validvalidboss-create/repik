"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type Tutor = {
  id: string;
  subjects: string[];
  tracks?: string[];
};

type DirectionOption = { key: string; label: string };

const LANGUAGE_SUBJECT_KEYS = new Set([
  "english",
  "french",
  "german",
  "italian",
  "spanish",
  "polish",
  "ukrainian",
  "czech",
  "korean",
]);

const SUBJECT_LABEL: Record<string, string> = {
  english: "Англійська",
  french: "Французька",
  german: "Німецька",
  italian: "Італійська",
  spanish: "Іспанська",
  polish: "Польська",
  czech: "Чеська",
  korean: "Корейська мова",
  ukrainian: "Українська мова",
  math: "Математика",
  geometry: "Геометрія",
  physics: "Фізика",
  chemistry: "Хімія",
  biology: "Біологія",
  history: "Історія",
  geography: "Географія",
  literature: "Література",
  computer_science: "Інформатика",
  programming: "Програмування",
  management: "Менеджмент",
  economics: "Економіка",
  psychology: "Психологія",
  pedagogy_psychology: "Педагогіка та психологія",
  accounting_finance: "Облік та фінанси",
  political_science: "Політологія",
  tznk: "ТЗНК",
  law: "Право",
  linguistics: "Мовознавство",
  research_methodology: "Методологія досліджень",
  primary_school: "Початкові класи 1–4",
  junior_classes: "Молодші класи",
};

const LANG_PRIMARY: DirectionOption[] = [
  { key: "native", label: "Рідна мова" },
  { key: "c2", label: "C2" },
  { key: "c1", label: "C1" },
  { key: "b2", label: "B2" },
  { key: "b1", label: "B1" },
];

const COMMON_OTHER: DirectionOption[] = [
  { key: "conversation", label: "Розмовна мова" },
  { key: "kids", label: "Репетитор для дітей" },
  { key: "primary_1_4", label: "Початкові класи 1–4" },
  { key: "grade_5_9", label: "5–9 клас" },
  { key: "grade_10_11", label: "10–11 клас" },
  { key: "preschool", label: "Підготовка до школи" },
  { key: "dpa", label: "Підготовка до ДПА" },
  { key: "nmt", label: "Підготовка НМТ/ЗНО" },
  { key: "olympiads", label: "Підготовка до олімпіад" },
];

const NON_LANG_PRIMARY: DirectionOption[] = [
  { key: "school", label: "Шкільна програма" },
  { key: "primary_1_4", label: "Початкові класи 1–4" },
  { key: "grade_5_9", label: "5–9 клас" },
  { key: "grade_10_11", label: "10–11 клас" },
  { key: "preschool", label: "Підготовка до школи" },
];

const NON_LANG_EXAMS: DirectionOption[] = [
  { key: "dpa", label: "Підготовка до ДПА" },
  { key: "nmt", label: "Підготовка НМТ/ЗНО" },
  { key: "olympiads", label: "Підготовка до олімпіад" },
];

const NON_LANG_OTHER: DirectionOption[] = [{ key: "kids", label: "Репетитор для дітей" }];

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

export default function TeacherDirectionsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = pathname.split("/").filter(Boolean)[0] || "uk";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tutor, setTutor] = useState<Tutor | null>(null);
  const [directionsBySubject, setDirectionsBySubject] = useState<Record<string, string[]>>({});

  const subjects = useMemo(() => {
    const list = Array.isArray(tutor?.subjects) ? tutor!.subjects : [];
    return uniq(list.map((s) => String(s || "").trim()).filter(Boolean));
  }, [tutor]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/teacher/onboarding", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(String(data?.error || "Не вдалося завантажити профіль"));
        const t = data?.tutor as Tutor;
        if (cancelled) return;
        setTutor(t);

        const tracks = Array.isArray(t?.tracks) ? (t.tracks as string[]) : [];
        const map: Record<string, string[]> = {};
        for (const tr of tracks) {
          if (typeof tr !== "string") continue;
          if (!tr.startsWith("dir:")) continue;
          const rest = tr.slice("dir:".length);
          const [subj, dir] = rest.split(":");
          const s = String(subj || "").trim();
          const d = String(dir || "").trim();
          if (!s || !d) continue;
          map[s] = Array.isArray(map[s]) ? map[s] : [];
          if (!map[s].includes(d)) map[s].push(d);
        }

        setDirectionsBySubject(map);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Помилка завантаження");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(subjectKey: string, optionKey: string) {
    const isLang = LANGUAGE_SUBJECT_KEYS.has(subjectKey);
    const langPrimaryKeys = new Set(LANG_PRIMARY.map((x) => x.key));
    const primaryKeys = isLang ? langPrimaryKeys : new Set(NON_LANG_PRIMARY.map((x) => x.key));
    const isExclusivePrimary = isLang && langPrimaryKeys.has(optionKey);
    const defaultPrimary = isLang ? "b2" : "school";

    setDirectionsBySubject((prev) => {
      const next: Record<string, string[]> = { ...(prev || {}) };
      const cur = Array.isArray(next[subjectKey]) ? next[subjectKey] : [];
      const active = cur.includes(optionKey);
      let arr = active ? cur.filter((x) => x !== optionKey) : Array.from(new Set([...cur, optionKey]));

      if (isExclusivePrimary && !active) {
        arr = arr.filter((x) => !langPrimaryKeys.has(x) || x === optionKey);
      }

      if (!arr.some((x) => primaryKeys.has(x))) {
        arr = Array.from(new Set([...arr, defaultPrimary]));
      }

      next[subjectKey] = arr;
      return next;
    });
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, string[]> = {};
      for (const s of subjects) {
        const cur = Array.isArray(directionsBySubject?.[s]) ? directionsBySubject[s] : [];
        payload[s] = uniq(cur.map((x) => String(x || "").trim()).filter(Boolean));
      }

      const res = await fetch("/api/teacher/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directionsBySubject: payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || "Не вдалося зберегти"));
      router.push(`/${encodeURIComponent(locale)}/profile`);
    } catch (e: any) {
      setError(e?.message || "Помилка збереження");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-10">
        <div className="text-sm text-neutral-600">Завантаження…</div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Напрямки</h1>
          <p className="text-sm text-neutral-600">Швидке редагування напрямків навчання без проходження всієї анкети.</p>
        </div>
        <Link href={`/${encodeURIComponent(locale)}/profile`} className="text-sm underline text-neutral-700 hover:text-neutral-900">
          Назад
        </Link>
      </div>

      {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div> : null}

      {subjects.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
          Спочатку оберіть предмети в анкеті.
        </div>
      ) : (
        <div className="space-y-6">
          {subjects.map((s) => {
            const isLang = LANGUAGE_SUBJECT_KEYS.has(s);
            const selected = Array.isArray(directionsBySubject?.[s]) ? directionsBySubject[s] : [];

            const chipClass = (active: boolean) =>
              active
                ? "inline-flex items-center gap-2 h-9 rounded-full bg-black px-3 text-sm font-semibold text-white"
                : "inline-flex items-center gap-2 h-9 rounded-full border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-900 hover:bg-neutral-50";

            const renderChip = (o: DirectionOption) => {
              const active = selected.includes(o.key);
              return (
                <button key={o.key} type="button" onClick={() => toggle(s, o.key)} className={chipClass(active)}>
                  {active ? <span className="text-xs leading-none">✓</span> : null}
                  <span>{o.label}</span>
                </button>
              );
            };

            return (
              <section key={s} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold text-neutral-900">{SUBJECT_LABEL[s] || s}</div>

                {isLang ? (
                  <div className="mt-4 space-y-4">
                    <div>
                      <div className="text-xs font-medium text-neutral-600">Рівень мови</div>
                      <div className="mt-2 flex flex-wrap gap-2">{LANG_PRIMARY.map(renderChip)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-neutral-600">Для кого / ціль</div>
                      <div className="mt-2 flex flex-wrap gap-2">{COMMON_OTHER.map(renderChip)}</div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    <div>
                      <div className="text-xs font-medium text-neutral-600">Класи / програма</div>
                      <div className="mt-2 flex flex-wrap gap-2">{NON_LANG_PRIMARY.map(renderChip)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-neutral-600">Підготовка</div>
                      <div className="mt-2 flex flex-wrap gap-2">{NON_LANG_EXAMS.map(renderChip)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-neutral-600">Додатково</div>
                      <div className="mt-2 flex flex-wrap gap-2">{NON_LANG_OTHER.map(renderChip)}</div>
                    </div>
                  </div>
                )}
              </section>
            );
          })}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="h-11 rounded-xl bg-black px-6 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
            >
              {saving ? "Збереження…" : "Зберегти"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
