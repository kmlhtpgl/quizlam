"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { Crown, Radio, Trophy } from "lucide-react";
import { useApp } from "@/components/layout/Providers";
import { useMcqRoom } from "@/hooks/useMcqRoom";
import { Pill } from "@/components/ui/Pill";
import { AvatarIcon } from "@/components/ui/Avatar";
import { QRCodeImage } from "@/components/ui/QRCodeImage";
import { CircularTimer } from "@/components/game/CircularTimer";
import { Scoreboard } from "@/components/game/Scoreboard";
import { GameEventSounds } from "@/components/game/GameEventSounds";
import { McqBackgroundMusic } from "@/components/mcq/McqBackgroundMusic";
import { McqLadder } from "@/components/mcq/McqLadder";
import { McqOptions } from "@/components/mcq/McqOptions";
import { McqResultCard } from "@/components/mcq/McqResultCard";

export default function McqTvPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();
  const { t } = useApp();
  const { snapshot, connected, events } = useMcqRoom(code, "viewer");
  const joinUrl = useMemo(
    () => (typeof window === "undefined" ? "" : `${window.location.origin}/join?code=${code}&game=mcq`),
    [code],
  );

  if (!snapshot) return <div className="flex min-h-screen items-center justify-center text-cream/60">{t("common.loading")}</div>;

  const contestant = snapshot.players.find((player) => player.id === snapshot.activePlayerId);
  const champion = snapshot.players.find((player) => player.isWinner) ?? [...snapshot.players].sort((a, b) => b.score - a.score)[0];
  const reveal = snapshot.phase === "answer_result" || snapshot.phase === "finished";

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden px-6 py-7 sm:px-10">
      <GameEventSounds events={events} />
      <McqBackgroundMusic phase={snapshot.phase} paused={snapshot.paused} roundIndex={snapshot.roundIndex} />
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black tracking-[0.18em] text-gold">QUIZLAM</span>
          <Pill tone={connected ? "emerald" : "danger"}>
            <Radio size={12} />
            {code}
          </Pill>
        </div>
        <div className="text-right text-sm font-bold uppercase tracking-[0.18em] text-cream/55">
          {t("common.round")} {Math.min(snapshot.roundIndex + 1, snapshot.totalRounds)} / {snapshot.totalRounds}
        </div>
      </header>

      <div className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[1fr_290px]">
        <section className="text-center">
          {snapshot.phase === "lobby" && (
            <div className="slide-up">
              <p className="text-lg font-black uppercase tracking-[0.3em] text-gold">{code}</p>
              <h1 className="mt-6 text-5xl font-black text-cream sm:text-7xl">{t("tv.getReady")}</h1>
              <p className="mt-6 text-xl text-cream/60">{t("mcq.tv.ready")}</p>
              <div className="mt-10 flex flex-col items-center gap-3">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-cream/60">{t("mcq.tv.scanToJoin")}</p>
                <div className="rounded-3xl bg-cream p-3">
                  <QRCodeImage value={joinUrl} size={210} />
                </div>
                <p className="text-base font-bold text-cream/70">{t("mcq.tv.scanHint", { code })}</p>
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

          {snapshot.phase === "contestant" && (
            <div className="slide-up">
              <p className="text-xl font-black uppercase tracking-[0.3em] text-gold">{t("mcq.tv.contestant")}</p>
              {contestant ? (
                <div className="mt-8 flex flex-col items-center gap-5">
                  <AvatarIcon avatar={contestant.avatar} size="xl" active />
                  <h1 className="text-5xl font-black text-cream sm:text-7xl">{contestant.nickname}</h1>
                  <p className="text-lg text-cream/55">{t("mcq.tv.waitingForContestant")}</p>
                </div>
              ) : (
                <h1 className="mt-8 text-3xl font-black text-cream">{t("mcq.tv.waitingForContestant")}</h1>
              )}
            </div>
          )}

          {snapshot.phase === "question" && snapshot.question && (
            <div className="slide-up">
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Pill tone="gold">{snapshot.question.category}</Pill>
                <Pill tone="emerald">
                  {t("mcq.tv.currentValue")} {snapshot.currentValue.toLocaleString("en-US")}
                </Pill>
                {snapshot.fiftyFiftyUsed && <Pill tone="neutral">{t("mcq.tv.fiftyFiftyUsed")}</Pill>}
              </div>
              <h1 className="mx-auto mt-6 max-w-6xl text-3xl font-bold leading-snug text-cream sm:text-5xl">
                {snapshot.question.prompt}
              </h1>
              <div className="mx-auto mt-8 max-w-4xl text-left">
                <McqOptions options={snapshot.question.options} />
              </div>
              <div className="mt-8 flex flex-col items-center gap-4">
                {contestant && (
                  <div className="flex items-center gap-4 rounded-3xl border border-gold/40 bg-gold/10 px-7 py-3">
                    <AvatarIcon avatar={contestant.avatar} size="md" active />
                    <div className="text-left">
                      <p className="text-2xl font-black text-gold">{contestant.nickname}</p>
                      <p className="text-xs font-bold uppercase tracking-widest text-cream/60">{t("mcq.tv.contestant")}</p>
                    </div>
                  </div>
                )}
                <CircularTimer
                  endsAt={snapshot.turnEndsAt}
                  remainingMs={snapshot.remainingMs}
                  paused={snapshot.paused}
                  totalSeconds={snapshot.config.timerSeconds}
                  size={130}
                />
                {snapshot.paused && <Pill tone="gold">{t("host.pause")}</Pill>}
              </div>
            </div>
          )}

          {(snapshot.phase === "answer_result" || reveal) && snapshot.lastResult && (
            <div className="mx-auto max-w-3xl">
              <McqResultCard result={snapshot.lastResult} />
              {snapshot.question && (
                <div className="mt-6 text-left">
                  <McqOptions options={snapshot.question.options} correctIndex={snapshot.question.correctIndex} selectedIndex={snapshot.lastResult.selectedIndex} compact />
                </div>
              )}
              {snapshot.phase === "answer_result" && (
                <p className="mt-7 text-xl font-bold uppercase tracking-[0.18em] text-cream/60">{t("mcq.tv.nextQuestion")}</p>
              )}
            </div>
          )}

          {snapshot.phase === "finished" && (
            <div className="slide-up">
              <Trophy size={68} className="mx-auto text-gold" />
              <h1 className="mt-4 text-4xl font-black text-gold sm:text-6xl">{t("results.champion")}</h1>
              {champion && (
                <div className="mt-8 flex flex-col items-center gap-3">
                  <AvatarIcon avatar={champion.avatar} size="xl" active />
                  <p className="text-3xl font-black text-cream sm:text-5xl">{champion.nickname}</p>
                  <p className="text-2xl font-black text-emerald-light">{champion.score.toLocaleString("en-US")}</p>
                  <Crown size={38} className="text-gold" />
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <McqLadder roundIndex={snapshot.roundIndex} bankedPoints={snapshot.bankedPoints} safeValue={snapshot.safeValue} compact />
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <h2 className="mb-4 text-sm font-black uppercase tracking-widest text-gold">{t("tv.liveScoreboard")}</h2>
            <Scoreboard players={snapshot.players} compact />
          </div>
        </aside>
      </div>
    </main>
  );
}
