"use client";
import React from "react";

export default function XPTracker({ xp }: { xp: number }) {
  return <div className="text-sm">XP: <span className="font-medium">{xp}</span></div>;
}
