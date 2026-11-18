"use client";

import { useEffect } from "react";
import type { EngineEvent } from "@/lib/domain";
import { useApp } from "@/components/layout/Providers";
import { playSound, type SoundKind } from "@/lib/sound";

export function GameEventSounds({ event }: { event: EngineEvent | null }) {
  const { soundEnabled } = useApp();
  useEffect(() => {
    if (!event) return;
    const map: Partial<Record<EngineEvent["type"], SoundKind>> = {
      "player:buzzed": "buzz",
      "letter:revealed": "reveal",
      "turn:timeout": "wrong",
      "answer:result": "wrong",
      "game:finished": "win",
    };
    let kind = map[event.type];
    if (event.type === "answer:result" && event.payload?.result) {
      const result = event.payload.result as { correct?: boolean };
      kind = result.correct ? "correct" : "wrong";
    }
    if (kind) playSound(kind, soundEnabled);
  }, [event, soundEnabled]);
  return null;
}
