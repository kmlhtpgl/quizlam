"use client";

import { useEffect } from "react";
import { useApp } from "@/components/layout/Providers";
import type { Phase } from "@/lib/domain";
import { startMusic, stopMusic } from "@/lib/sound";

export function BackgroundMusic({
  phase,
  paused,
  roundIndex,
}: {
  phase: Phase;
  paused: boolean;
  roundIndex: number;
}) {
  const { musicEnabled } = useApp();

  useEffect(() => {
    if (!musicEnabled) {
      stopMusic();
      return;
    }
    if (phase === "lobby") {
      startMusic("lobby", true);
      return;
    }
    if ((phase === "buzzer_open" || phase === "answering") && !paused) {
      startMusic("question", true);
      return;
    }
    stopMusic();
  }, [phase, paused, roundIndex, musicEnabled]);

  useEffect(() => () => stopMusic(), []);

  return null;
}
