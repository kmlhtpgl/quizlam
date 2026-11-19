"use client";

import { useEffect, useRef } from "react";
import { useApp } from "@/components/layout/Providers";
import type { GameEventEnvelope } from "@/hooks/useGameRoom";
import { playSound, soundForEvent } from "@/lib/sound";

export function GameEventSounds({ events }: { events: GameEventEnvelope[] }) {
  const { soundEnabled } = useApp();
  const processedId = useRef(events[events.length - 1]?.id ?? 0);

  useEffect(() => {
    for (const entry of events) {
      if (entry.id <= processedId.current) continue;
      processedId.current = entry.id;
      const kind = soundForEvent(entry.event);
      if (kind) playSound(kind, soundEnabled);
    }
  }, [events, soundEnabled]);

  return null;
}
