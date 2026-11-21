"use client";

import { useEffect } from "react";
import { useApp } from "@/components/layout/Providers";
import type { McqPhase } from "@/lib/mcqDomain";
import { startMusic, stopMusic } from "@/lib/sound";

export function McqBackgroundMusic({
  phase,
  paused,
  roundIndex,
}: {
  phase: McqPhase;
  paused: boolean;
  roundIndex: number;
}) {
  const { musicEnabled } = useApp();

  useEffect(() => {
    if (!musicEnabled) {
      stopMusic();
      return;
    }
    if (phase === "lobby" || phase === "contestant") {
      startMusic("lobby", true);
      return;
    }
    if (phase === "question" && !paused) {
      startMusic("question", true);
      return;
    }
    stopMusic();
  }, [phase, paused, roundIndex, musicEnabled]);

  useEffect(() => () => stopMusic(), []);

  return null;
}
