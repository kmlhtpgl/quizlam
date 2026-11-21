"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { Crown, Radio, Trophy } from "lucide-react";
import { useApp } from "@/components/layout/Providers";
import { useGameRoom } from "@/hooks/useGameRoom";
import { Pill } from "@/components/ui/Pill";
import { AvatarIcon } from "@/components/ui/Avatar";
import { CircularTimer } from "@/components/game/CircularTimer";
import { LetterTiles } from "@/components/game/LetterTiles";
import { ResultOverlay } from "@/components/game/ResultOverlay";
import { Scoreboard } from "@/components/game/Scoreboard";
import { GameEventSounds } from "@/components/game/GameEventSounds";
import { BackgroundMusic } from "@/components/game/BackgroundMusic";
import { QRCodeImage } from "@/components/ui/QRCodeImage";

export default function TvPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();
  const { t } = useApp();
  const { snapshot, connected, events } = useGameRoom(code, "viewer");
  const joinUrl = useMemo(
    () => (typeof window === "undefined" ? "" : `${window.location.origin}/join?code=${code}`),
    [code],
  );

  if (!snapshot) {
    return <div className="flex min-h-screen items-center justify-center text-cream/60">{t("common.loading")}</div>;
  }

  const activePlayer = snapshot.players.find((player) => player.id === snapshot.activePlayerId);
  const champion = snapshot.players.find((player) => player.isWinner) ?? [...snapshot.players].sort((a, b) => b.score - a.score)[0];
  const showTimer = snapshot.phase === "answering" || snapshot.phase === "buzzer_open";

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden px-6 py-7 sm:px-10">
      <GameEventSounds events={events} />
      <BackgroundMusic phase={snapshot.phase} paused={snapshot.paused} roundIndex={snapshot.roundIndex} />
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black tracking-[0.18em] text-gold">QUIZLAM</span>
          <Pill tone={connected ? "emerald" : "danger"}>
            <Radio size={12} />
            {code}
          </Pill>
        </div>
        <div className="text-right text-sm font-bold uppercase tracking-[0.18em] text-cream/55">
          {t("tv.round")} {Math.min(snapshot.roundIndex + 1, snapshot.totalRounds)} / {snapshot.totalRounds}
        </div>
      </header>

      <div className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[1fr_320px]">
        <section className="text-center">
          {snapshot.phase === "lobby" && (
            <div className="slide-up">
              <p className="text-lg font-black uppercase tracking-[0.3em] text-gold">{code}</p>
              <h1 className="mt-6 text-5xl font-black text-cream sm:text-7xl">{t("tv.getReady")}</h1>
              <p className="mt-6 text-xl text-cream/60">{t("tv.noQuestion")}</p>
              <div className="mt-10 flex flex-col items-center gap-3">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-cream/60">{t("tv.scanToJoin")}</p>
                <div className="rounded-3xl bg-cream p-3">
                  <QRCodeImage value={joinUrl} size={220} />
                </div>
                <p className="text-lg font-bold text-cream/70">{t("tv.scanHint", { code })}</p>
              </div>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                {snapshot.players.map((player) => (
                  <div key={player.id} className="flex flex-col items-center gap-2">
                    <AvatarIcon avatar={player.avatar} size="lg" active={player.connected} />
                    <span className="text-sm font-bold text-cream/75">{player.nickname}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {snapshot.question && (snapshot.phase === "buzzer_open" || snapshot.phase === "answering") && (
            <div className="slide-up">
              <Pill tone="gold">{snapshot.question.category}</Pill>
              <h1 className="mx-auto mt-6 max-w-5xl text-3xl font-bold leading-snug text-cream sm:text-5xl lg:text-6xl">
                {snapshot.question.prompt}
              </h1>
              <div className="mt-12">
                <LetterTiles tiles={snapshot.question.tiles} size="xl" />
              </div>
              <div className="mt-10 flex flex-col items-center gap-4">
                {activePlayer ? (
                  <div className="flex items-center gap-4 rounded-3xl border border-gold/40 bg-gold/10 px-7 py-4">
                    <AvatarIcon avatar={activePlayer.avatar} size="md" active />
                    <div className="text-left">
                      <p className="text-2xl font-black text-gold">{activePlayer.nickname}</p>
                      <p className="text-sm font-bold uppercase tracking-widest text-cream/60">{t("tv.playerBuzzed")}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-2xl font-black uppercase tracking-[0.18em] text-emerald-light">
                    {t("tv.waitingForBuzz")}
                  </p>
                )}
                {showTimer && (
                  <CircularTimer
                    endsAt={snapshot.turnEndsAt}
                    remainingMs={snapshot.remainingMs}
                    paused={snapshot.paused}
                    totalSeconds={snapshot.config.timerSeconds}
                    size={snapshot.phase === "answering" ? 160 : 110}
                  />
                )}
                {snapshot.paused && <Pill tone="gold">{t("host.pause")}</Pill>}
              </div>
            </div>
          )}

          {snapshot.phase === "round_result" && snapshot.lastResult && (
            <div className="mx-auto max-w-3xl">
              <ResultOverlay result={snapshot.lastResult} />
              <p className="mt-8 text-xl font-bold uppercase tracking-[0.18em] text-cream/60">{t("tv.nextRound")}</p>
            </div>
          )}

          {snapshot.phase === "finished" && (
            <div className="slide-up">
              <Trophy size={72} className="mx-auto text-gold" />
              <h1 className="mt-4 text-5xl font-black text-gold sm:text-7xl">{t("results.champion")}</h1>
              {champion && (
                <div className="mt-8 flex flex-col items-center gap-4">
                  <AvatarIcon avatar={champion.avatar} size="xl" active />
                  <p className="text-3xl font-black text-cream sm:text-5xl">{champion.nickname}</p>
                  <p className="text-2xl font-black text-emerald-light">{champion.score} {t("common.points")}</p>
                  <Crown size={40} className="text-gold" />
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-gold">
            <Trophy size={18} />
            {t("tv.liveScoreboard")}
          </h2>
          <Scoreboard players={snapshot.players} compact groupByTeam={snapshot.config.mode === "team"} />
          {snapshot.lastResult && snapshot.phase === "round_result" && null}
        </aside>
      </div>
    </main>
  );
}
