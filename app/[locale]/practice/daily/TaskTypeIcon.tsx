"use client";
import React from "react";
import type { TaskType } from "./mockDailyTasks";

export default function TaskTypeIcon({ type }: { type: TaskType }) {
  const map: Record<TaskType, string> = {
    word: "🔤",
    video: "🎬",
    practice: "🧩",
    theory: "📘",
  };
  return <span aria-hidden>{map[type]}</span>;
}
