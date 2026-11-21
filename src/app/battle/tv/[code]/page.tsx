"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { Check, Crown, Radio, Trophy } from "lucide-react";
import type { BattleChoiceColor } from "@/lib/battleDomain";
import { useApp } from "@/components/layout/Providers";
import { useBattleRoom } from "@/hooks/useBattleRoom";
import { Pill } from "@/components/ui/Pill";
import { AvatarIcon } from "@/components/ui/Avatar";
import { QRCodeImage } from "@/components/ui/QRCodeImage";
import { CircularTimer } from "@/components/game/CircularTimer";
import { Scoreboard } from "@/components/game/Scoreboard";
import { Confetti } from "@/components/game/Confetti";
import { GameEventSounds } from "@/components/game/GameEventSounds";
import { McqBackgroundMusic } from "@/components/mcq/McqBackgroundMusic";
import type { McqPhase } from "@/lib/mcqDomain";

const tileColors: Record<BattleChoiceColor, string> = {
  red: "from-rose-500 to-red-600",
  blue: "from-sky-500 to-blue-600",
  yellow: "from-amber-300 to-gold",
  green: "from-emerald-light to-emerald",
};

function musicPhase(phase: string): McqPhase {
  if (phase === "question") return "question";
  if (phase === "reveal") return "answer_result";
  if (phase === "finished") return "finished";
  return "lobby";
}

export default function BattleTvPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();
  const { t } = useApp();
  const { snapshot, connected, events } = useBattleRoom(code, "viewer");
  const joinUrl = useMemo(
    () => (typeof window === "undefined" ? "" : `${window.location.origin}/join?code=${code}&game=battle`),
    [code],
  );

  if (!snapshot) return <div className="flex min-h-screen items-center justify-center text-cream/60">{t("common.loading")}</div>;

  const round = Math.min(snapshot.roundIndex + 1, snapshot.totalRounds);
  const champion = snapshot.players.find((player) => player.isWinner) ?? [...snapshot.players].sort((a, b) => b.score - a.score)[0];
  const reveal = snapshot.phase === "reveal";
  const correctIndex = reveal ? snapshot.question?.correctIndex : null;

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden px-6 py-7 sm:px-10">
      <GameEventSounds events={events} />
      <McqBackgroundMusic phase={musicPhase(snapshot.phase)} paused={snapshot.paused} roundIndex={snapshot.roundIndex} />
      <Confetti active={snapshot.phase === "finished"} />
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black tracking-[0.18em] text-gold">QUIZLAM</span>
          <Pill tone={connected ? "emerald" : "danger"}>
            <Radio size={12} />
            {code}
          </Pill>
        </div>
        <div className="text-right text-sm font-bold uppercase tracking-[0.18em] text-cream/55">
          {t("battle.host.roundProgress", { current: round, total: snapshot.totalRounds })}
        </div>
      </header>

      <div className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[1fr_290px]">
        <section className="text-center">
          {snapshot.phase === "lobby" && (
            <div className="slide-up">
              <p className="text-lg font-black uppercase tracking-[0.3em] text-gold">{code}</p>
              <h1 className="mt-6 text-5xl font-black text-cream sm:text-7xl">{t("battle.tv.getReady")}</h1>
              <div className="mt-10 flex flex-col items-center gap-3">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-cream/60">{t("battle.tv.scanToJoin")}</p>
                <div className="rounded-3xl bg-cream p-3">
                  <QRCodeImage value={joinUrl} size={210} />
                </div>
                <p className="text-base font-bold text-cream/70">{t("battle.tv.scanHint", { code })}</p>
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

          {(snapshot.phase === "question" || reveal) && snapshot.question && (
            <div className="slide-up">
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Pill tone="gold">{snapshot.question.category}</Pill>
                <Pill tone="emerald">
                  {t("battle.tv.answers", { count: snapshot.answerCount, total: snapshot.players.length })}
                </Pill>
                {snapshot.paused && <Pill tone="neutral">{t("battle.tv.paused")}</Pill>}
              </div>
              <h1 className="mx-auto mt-6 max-w-6xl text-3xl font-bold leading-snug text-cream sm:text-5xl">
                {snapshot.question.prompt}
              </h1>
              <div className="mx-auto mt-8 grid max-w-5xl gap-4 sm:grid-cols-2">
                {snapshot.question.options.map((option) => {
                  const isCorrect = correctIndex === option.index;
                  const dimmed = reveal && !isCorrect;
                  return (
                    <div
                      key={option.index}
                      className={`relative flex min-h-[7rem] items-center gap-4 rounded-3xl bg-gradient-to-br px-6 text-left text-xl font-black text-white shadow-xl transition sm:text-2xl ${tileColors[option.color]} ${
                        dimmed ? "opacity-30 saturate-50" : ""
                      } ${isCorrect ? "scale-[1.03] ring-4 ring-cream ring-offset-4 ring-offset-navy" : ""}`}
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-navy/30 text-2xl">
                        {option.index + 1}
                      </span>
                      <span className="min-w-0 flex-1">{option.text}</span>
                      {isCorrect && <Check size={30} className="shrink-0" />}
                    </div>
                  );
                })}
              </div>
              <div className="mt-8 flex flex-col items-center gap-3">
                {snapshot.phase === "question" ? (
                  <CircularTimer
                    endsAt={snapshot.turnEndsAt}
                    remainingMs={snapshot.remainingMs}
                    paused={snapshot.paused}
                    totalSeconds={snapshot.config.timerSeconds}
                    size={120}
                  />
                ) : (
                  <div>
                    <p className="text-2xl font-black text-emerald-light">{t("battle.tv.correctAnswer")}</p>
                    <p className="mt-2 text-lg font-bold uppercase tracking-[0.18em] text-cream/60">{t("battle.tv.waitingForNext")}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {snapshot.phase === "question" && !snapshot.question && (
            <p className="text-xl font-bold text-cream/55">{t("battle.tv.noQuestion")}</p>
          )}

          {snapshot.phase === "finished" && (
            <div className="slide-up">
              <Trophy size={74} className="mx-auto text-gold" />
              <h1 className="mt-4 text-4xl font-black text-gold sm:text-6xl">{t("battle.tv.finished")}</h1>
              {champion && (
                <div className="mt-8 flex flex-col items-center gap-3">
                  <AvatarIcon avatar={champion.avatar} size="xl" active />
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-cream/55">{t("battle.tv.winner")}</p>
                  <p className="text-3xl font-black text-cream sm:text-5xl">{champion.nickname}</p>
                  <p className="text-2xl font-black text-emerald-light">{champion.score.toLocaleString("en-US")}</p>
                  <Crown size={38} className="text-gold" />
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <h2 className="mb-4 text-sm font-black uppercase tracking-widest text-gold">{t("tv.liveScoreboard")}</h2>
            <Scoreboard players={snapshot.players} compact />
          </div>
        </aside>
      </div>
    </main>
  );
}
