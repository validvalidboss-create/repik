"use client";
import React from "react";

export default function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = Math.min(100, Math.round((done / Math.max(1, total)) * 100));
  return (
    <div className="w-full h-3 rounded bg-neutral-200 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full bg-green-500 transition-all" style={{ width: pct + "%" }} />
    </div>
  );
}
