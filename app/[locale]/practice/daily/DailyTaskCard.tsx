"use client";
import React, { useMemo, useState } from "react";
import TaskTypeIcon from "./TaskTypeIcon";
import type { DailyTask } from "./mockDailyTasks";

export default function DailyTaskCard({ task, completed, onComplete }: { task: DailyTask; completed: boolean; onComplete: (xp: number) => void }) {
  const [answer, setAnswer] = useState<string | string[] | null>(null);
  const disabled = completed;
  const reward = useMemo(() => (task.type === "word" ? 10 : task.type === "video" ? 20 : task.type === "practice" ? 25 : 15), [task.type]);

  const submit = () => {
    if (disabled) return;
    if (task.type === "practice" || task.type === "theory" || task.type === "word" || task.type === "video") {
      // If options exist, validate; for practice steps we accept any submission for MVP
      if (task.options && typeof answer === "string") {
        if (answer !== task.answer) return;
      }
      onComplete(reward);
    }
  };

  return (
    <div className={`rounded-2xl border p-4 bg-white ${completed ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-2 mb-2">
        <TaskTypeIcon type={task.type} />
        <div className="font-medium">{task.title}</div>
        <div className="ml-auto text-xs text-neutral-500">+{reward} XP</div>
      </div>
      {task.image && <img src={task.image} alt="" className="w-full rounded mb-2" />}
      {task.video?.src && (
        <video className="w-full rounded mb-2" controls poster={task.video.poster}>
          <source src={task.video.src} />
        </video>
      )}
      {task.prompt && <div className="mb-2 text-sm">{task.prompt}</div>}
      {task.options && (
        <div className="flex flex-wrap gap-2 mb-2">
          {task.options.map((opt) => (
            <button key={opt} onClick={() => setAnswer(opt)} className={`px-3 py-1 rounded border ${answer===opt?"bg-neutral-900 text-white":""}`}>{opt}</button>
          ))}
        </div>
      )}
      {task.steps && (
        <div className="mb-2 text-sm text-neutral-600">Шаги: {task.steps.join(" → ")}</div>
      )}
      <button onClick={submit} disabled={disabled} className="px-3 py-1 rounded bg-emerald-600 text-white disabled:opacity-50">Проверить</button>
    </div>
  );
}
