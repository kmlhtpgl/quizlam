"use client";

import { useEffect } from "react";

export function Confetti({ active, duration = 2600 }: { active: boolean; duration?: number }) {
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timer: number | undefined;
    void import("canvas-confetti").then(({ default: confetti }) => {
      if (cancelled) return;
      const end = Date.now() + duration;
      const colors = ["#F5C451", "#009B77", "#FFF8E7", "#14C49A"];
      const frame = () => {
        confetti({
          particleCount: 5,
          spread: 80,
          startVelocity: 28,
          origin: { y: 0.65, x: Math.random() },
          colors,
          disableForReducedMotion: true,
        });
        if (Date.now() < end) timer = window.requestAnimationFrame(frame);
      };
      frame();
    });
    return () => {
      cancelled = true;
      if (timer) window.cancelAnimationFrame(timer);
    };
  }, [active, duration]);
  return null;
}
