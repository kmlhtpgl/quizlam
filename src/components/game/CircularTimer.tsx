"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

export function CircularTimer({
  endsAt,
  remainingMs,
  paused,
  totalSeconds,
  size = 180,
}: {
  endsAt: number | null;
  remainingMs: number | null;
  paused: boolean;
  totalSeconds: number;
  size?: number;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, []);

  const duration = totalSeconds * 1000;
  const remaining = paused
    ? Math.max(0, remainingMs ?? 0)
    : endsAt
      ? Math.max(0, endsAt - now)
      : duration;
  const ratio = Math.min(1, Math.max(0, remaining / duration));
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const seconds = Math.ceil(remaining / 1000);
  const urgent = seconds <= 5 && remaining > 0;

  return (
    <div
      className={clsx("relative inline-flex items-center justify-center", urgent && "timer-urgent")}
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`${seconds} seconds remaining`}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,248,231,0.12)" strokeWidth="7" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={urgent ? "#FF6B6B" : ratio < 0.35 ? "#F5C451" : "#14C49A"}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          style={{ transition: "stroke-dashoffset 0.12s linear, stroke 0.3s ease" }}
        />
      </svg>
      <div className="relative text-center">
        <div className={clsx("font-black leading-none", urgent ? "text-rose-300" : "text-cream")} style={{ fontSize: size * 0.25 }}>
          {seconds}
        </div>
        <div className="mt-1 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-cream/50">sec</div>
      </div>
    </div>
  );
}
