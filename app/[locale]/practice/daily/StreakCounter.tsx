"use client";
import React from "react";

export default function StreakCounter({ days }: { days: number }) {
  return <div className="text-sm">Streak: 🔥 <span className="font-medium">{days}</span> дней</div>;
}
