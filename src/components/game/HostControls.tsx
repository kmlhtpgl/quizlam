"use client";

import { Check, ChevronRight, Eye, Pause, Play, RotateCcw, SkipForward, Trophy } from "lucide-react";
import Link from "next/link";
import type { RoomSnapshot } from "@/lib/domain";
import { useApp } from "@/components/layout/Providers";
import { Button } from "@/components/ui/Button";
import { unlockAudio } from "@/lib/sound";

export function HostControls({
  snapshot,
  hostToken,
  emit,
}: {
  snapshot: RoomSnapshot;
  hostToken: string;
  emit: (event: string, payload: unknown) => Promise<{ ok: boolean; error?: string; [key: string]: unknown }>;
}) {
  const { t } = useApp();
  const base = { code: snapshot.code, hostToken };
  const send = (event: string) => {
    unlockAudio();
    void emit(event, base);
  };
  const active = snapshot.phase === "buzzer_open" || snapshot.phase === "answering";
  return (
    <div className="flex flex-wrap gap-2">
      {snapshot.phase === "lobby" && (
        <Button variant="primary" onClick={() => send("host:start")}>
          <Play size={16} />
          {t("host.startGame")}
        </Button>
      )}
      {snapshot.phase === "answering" && !snapshot.paused && (
        <Button variant="gold" onClick={() => send("host:pause")}>
          <Pause size={16} />
          {t("host.pause")}
        </Button>
      )}
      {snapshot.phase === "answering" && snapshot.paused && (
        <Button variant="primary" onClick={() => send("host:resume")}>
          <Play size={16} />
          {t("host.resume")}
        </Button>
      )}
      {active && (
        <>
          <Button variant="ghost" onClick={() => send("host:skip")}>
            <SkipForward size={16} />
            {t("host.skip")}
          </Button>
          <Button variant="outline" onClick={() => send("host:reveal")}>
            <Eye size={16} />
            {t("host.reveal")}
          </Button>
        </>
      )}
      {snapshot.phase === "round_result" && (
        <>
          <Button variant="primary" onClick={() => send("host:next")}>
            <ChevronRight size={16} />
            {t("host.next")}
          </Button>
          <Button variant="ghost" onClick={() => send("host:dismiss")}>
            <Check size={16} />
            {t("host.dismiss")}
          </Button>
        </>
      )}
      {snapshot.phase === "finished" && (
        <Link href={`/results/${snapshot.code}`}>
          <Button variant="gold">
            <Trophy size={16} />
            {t("host.goResults")}
          </Button>
        </Link>
      )}
      {(snapshot.phase === "finished" || snapshot.phase === "round_result") && (
        <Button variant="ghost" onClick={() => send("host:skip")}>
          <RotateCcw size={16} />
          {t("host.reveal")}
        </Button>
      )}
    </div>
  );
}
