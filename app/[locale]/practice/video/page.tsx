"use client";
import Link from "next/link";

const CEFR = [
  { code: "A1", title: "A1 — Beginner" },
  { code: "A2", title: "A2 — Elementary" },
  { code: "B1", title: "B1 — Intermediate" },
  { code: "B2", title: "B2 — Upper-Intermediate" },
  { code: "C1", title: "C1 — Advanced" },
  { code: "C2", title: "C2 — Proficient" },
];

export default function VideoCefrGatePage() {
  return (
    <main className="container mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold mb-2">Відео‑практика</h1>
      <p className="text-sm text-neutral-600 mb-6">Оберіть свій рівень A1–C2, потім переглядайте відео з субтитрами та вправами.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-4">
        {CEFR.map((l) => (
          <Link key={l.code} href={`./video/${l.code}`} className="rounded-2xl border p-6 bg-white hover:shadow flex items-center justify-center text-lg font-medium">
            {l.title}
          </Link>
        ))}
      </div>
    </main>
  );
}
