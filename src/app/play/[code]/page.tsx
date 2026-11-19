"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Clock3, Crown, Radio, Trophy } from "lucide-react";
import { getPlayerSession } from "@/lib/session";
import { useApp } from "@/components/layout/Providers";
import { useGameRoom } from "@/hooks/useGameRoom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { AvatarIcon } from "@/components/ui/Avatar";
import { CircularTimer } from "@/components/game/CircularTimer";
import { BuzzerButton } from "@/components/game/BuzzerButton";
import { AnswerControls } from "@/components/game/AnswerControls";
import { ResultOverlay } from "@/components/game/ResultOverlay";
import { GameEventSounds } from "@/components/game/GameEventSounds";
import { Scoreboard } from "@/components/game/Scoreboard";

export default function PlayerPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();
  const { t } = useApp();
  const session = useMemo(() => getPlayerSession(code), [code]);
  const { snapshot, connected, events, emit } = useGameRoom(code, "player");
  const [justSubmitted, setJustSubmitted] = useState(false);

  useEffect(() => {
    if (!session?.token) return;
    void emit("room:reconnect", { code, token: session.token });
  }, [code, emit, session?.token]);

  if (!session) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-3xl font-black text-cream">{t("player.title")}</h1>
        <p className="mt-4 text-cream/60">{t("join.subtitle")}</p>
        <Link href={`/join?code=${code}`} className="mt-8 inline-block">
          <Button variant="gold">{t("common.joinGame")}</Button>
        </Link>
      </div>
    );
  }

  if (!snapshot) {
    return <div className="py-32 text-center text-cream/60">{t("common.loading")}</div>;
  }

  const me = snapshot.players.find((player) => player.id === session.playerId);
  const isActive = snapshot.activePlayerId === session.playerId;
  const canBuzz = snapshot.phase === "buzzer_open" && Boolean(me?.isEligible) && connected;
  const myResult = snapshot.lastResult?.playerId === session.playerId ? snapshot.lastResult : null;
  const champion = snapshot.players.find((player) => player.isWinner);

  async function buzz() {
    const response = await emit("player:buzz", { code, playerId: session!.playerId });
    if (!response.ok) setJustSubmitted(false);
  }

  async function reveal() {
    await emit("player:reveal", { code, playerId: session!.playerId });
  }

  async function submit(answer: string) {
    const response = await emit("player:submit", {
      code,
      playerId: session!.playerId,
      answer,
      idempotencyKey: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    });
    if (response.ok) {
      setJustSubmitted(true);
      window.setTimeout(() => setJustSubmitted(false), 1400);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
      <GameEventSounds events={events} />
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AvatarIcon avatar={session.avatar as Parameters<typeof AvatarIcon>[0]["avatar"]} size="sm" active={connected} />
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-cream/50">{t("player.youAre")}</p>
            <p className="font-black text-cream">{session.nickname}</p>
          </div>
        </div>
        <Pill tone={connected ? "emerald" : "danger"}>
          <Radio size={12} />
          {connected ? t("common.connected") : t("player.reconnecting")}
        </Pill>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
        <Card strong>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-cream/50">{t("player.score")}</p>
              <p className="text-4xl font-black text-gold">{me?.score ?? 0}</p>
            </div>
            <Pill tone="gold">
              {t("player.round")} {Math.min(snapshot.roundIndex + 1, snapshot.totalRounds)}/{snapshot.totalRounds}
            </Pill>
          </div>

          <div className="mt-7 text-center">
            {snapshot.phase === "lobby" && (
              <div className="py-8">
                <Clock3 size={42} className="mx-auto mb-4 text-gold/60" />
                <p className="text-xl font-black text-cream">{t("player.waitingForHost")}</p>
                <p className="mt-2 text-sm text-cream/50">{code}</p>
              </div>
            )}

            {(snapshot.phase === "buzzer_open" || snapshot.phase === "answering") && !isActive && (
              <div className="py-4">
                <h1 className="text-2xl font-black text-cream">{t("tv.getReady")}</h1>
                <p className="mt-2 text-sm text-cream/55">{t("tv.waitingForBuzz")}</p>
                <div className="mx-auto mt-8 flex justify-center">
                  <BuzzerButton
                    label={t("player.buzz")}
                    state={canBuzz ? "ready" : snapshot.phase === "answering" ? "locked" : "waiting"}
                    disabled={!canBuzz}
                    onClick={buzz}
                  />
                </div>
                {!me?.isEligible && snapshot.phase === "buzzer_open" && (
                  <p className="mt-5 text-sm font-bold text-rose-300">{t("player.wrongTryAgain")}</p>
                )}
              </div>
            )}

            {isActive && snapshot.phase === "answering" && (
              <div className="pop-in">
                <Pill tone="emerald">{t("player.yourTurn")}</Pill>
                <div className="mt-5 flex justify-center">
                  <CircularTimer
                    endsAt={snapshot.turnEndsAt}
                    remainingMs={snapshot.remainingMs}
                    paused={snapshot.paused}
                    totalSeconds={snapshot.config.timerSeconds}
                    size={140}
                  />
                </div>
                <p className="mt-5 text-xs font-bold uppercase tracking-widest text-cream/50">
                  {t("player.turnEndsIn")}
                </p>
                <div className="mt-6">
                  <AnswerControls
                    disabled={snapshot.paused || justSubmitted}
                    canReveal={snapshot.availablePoints > 0}
                    pointsAvailable={snapshot.availablePoints}
                    onReveal={reveal}
                    onSubmit={submit}
                  />
                </div>
                <p className="mt-3 text-xs text-cream/45">{t("player.submitHint")}</p>
                {justSubmitted && <p className="mt-3 text-sm font-black text-emerald-light">{t("player.answerSent")}</p>}
              </div>
            )}

            {snapshot.phase === "round_result" && (
              <div className="py-3">
                {myResult ? (
                  <ResultOverlay result={myResult} compact />
                ) : (
                  <>
                    <Trophy size={42} className="mx-auto mb-3 text-gold/70" />
                    <p className="text-xl font-black text-cream">{t("player.waitingForHost")}</p>
                    {snapshot.lastResult && (
                      <p className="mt-3 text-sm text-cream/60">
                        {t("common.answer")}: <span className="font-black text-gold">{snapshot.lastResult.answer}</span>
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {snapshot.phase === "finished" && (
              <div className="py-8">
                <Crown size={52} className="mx-auto text-gold" />
                <p className="mt-4 text-2xl font-black text-gold">{t("results.champion")}</p>
                {champion && <p className="mt-2 text-lg font-bold text-cream">{champion.nickname}</p>}
                <Link href={`/results/${code}`} className="mt-6 inline-block">
                  <Button variant="gold">{t("common.results")}</Button>
                </Link>
              </div>
            )}
          </div>
        </Card>

        <Card className="sm:w-52">
          <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-gold">{t("tv.liveScoreboard")}</h2>
          <Scoreboard players={snapshot.players} compact groupByTeam={snapshot.config.mode === "team"} />
        </Card>
      </div>
    </div>
  );
}
