"use client";
import { mockTutors } from "@/lib/mock";
import { useState } from "react";

export default function AdminPage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  async function toggleBan(tutorId: string, active: boolean) {
    setBusy(tutorId);
    setResult(null);
    try {
      const res = await fetch("/api/admin/ban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tutorId, active }),
      });
      const data = await res.json();
      setResult(data);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="container mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold mb-6">Admin • Tutors moderation</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mockTutors.map((t) => (
          <div key={t.id} className="border rounded p-4">
            <div className="font-medium">{t.name}</div>
            <div className="text-sm text-muted-foreground mb-3">{t.subjects.join(", ")}</div>
            <div className="flex gap-2">
              <button
                disabled={busy === t.id}
                onClick={() => toggleBan(t.id, true)}
                className="px-3 py-1 rounded border"
              >
                Ban
              </button>
              <button
                disabled={busy === t.id}
                onClick={() => toggleBan(t.id, false)}
                className="px-3 py-1 rounded border"
              >
                Unban
              </button>
            </div>
          </div>
        ))}
      </div>

      {result && (
        <div className="mt-6 p-4 border rounded bg-neutral-50">
          <div className="font-medium mb-2">Response</div>
          <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </main>
  );
}
