"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, Clock, Crown, Radio, Trophy, XCircle } from "lucide-react";
import type { BattleChoiceColor } from "@/lib/battleDomain";
import { getPlayerSession } from "@/lib/session";
import { playSound } from "@/lib/sound";
import { useApp } from "@/components/layout/Providers";
import { useBattleRoom } from "@/hooks/useBattleRoom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { AvatarIcon } from "@/components/ui/Avatar";
import { CircularTimer } from "@/components/game/CircularTimer";

const buttonColors: Record<BattleChoiceColor, string> = {
  red: "from-rose-500 to-red-600 text-cream",
  blue: "from-sky-500 to-blue-600 text-cream",
  yellow: "from-amber-300 to-gold text-navy",
  green: "from-emerald-light to-emerald text-navy",
};

function answerKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function BattlePlayPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();
  const { t, soundEnabled } = useApp();
  const session = useMemo(() => getPlayerSession(code), [code]);
  const { snapshot, connected, emit } = useBattleRoom(code, "player");
  const [answerState, setAnswerState] = useState<{ key: string; selected: number | null; error: string }>({
    key: "",
    selected: null,
    error: "",
  });
  const previousPhase = useRef<string | null>(null);
  const roundKey = snapshot ? `${snapshot.roundIndex}:${snapshot.phase}` : "";
  const activeState = answerState.key === roundKey ? answerState : { key: roundKey, selected: null, error: "" };
  const selected = activeState.selected;
  const error = activeState.error;

  useEffect(() => {
    if (!session?.token) return;
    void emit("battle:reconnect", { code, token: session.token });
  }, [code, emit, session?.token]);

  useEffect(() => {
    const phase = snapshot?.phase ?? null;
    const correct = snapshot?.myAnswer?.correct;
    if (
      phase === "reveal" &&
      previousPhase.current !== null &&
      previousPhase.current !== "reveal" &&
      typeof correct === "boolean"
    ) {
      playSound(correct ? "correct" : "wrong", soundEnabled);
    }
    previousPhase.current = phase;
  }, [snapshot?.phase, snapshot?.myAnswer?.correct, soundEnabled]);

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <Card strong className="max-w-md text-center">
          <h1 className="text-3xl font-black text-cream">{t("battle.play.title")}</h1>
          <p className="mt-3 text-sm text-cream/60">{t("join.subtitle")}</p>
          <Link href={`/join?code=${code}&game=battle`} className="mt-6 inline-block">
            <Button variant="gold">{t("common.joinGame")}</Button>
          </Link>
        </Card>
      </main>
    );
  }

  if (!snapshot) return <div className="flex min-h-screen items-center justify-center text-cream/60">{t("common.loading")}</div>;

  const me = snapshot.players.find((player) => player.id === session.playerId);
  const ordered = [...snapshot.players].sort((a, b) => b.score - a.score);
  const rank = ordered.findIndex((player) => player.id === session.playerId) + 1;
  const answered = snapshot.myAnswer?.answered === true || selected !== null;
  const canAnswer = snapshot.phase === "question" && connected && !snapshot.paused && !answered;
  const reveal = snapshot.phase === "reveal" || snapshot.phase === "finished";
  const correct = snapshot.myAnswer?.correct;
  const result = reveal ? snapshot.results.find((item) => item.playerId === session.playerId) ?? null : null;
  const speedBonus = result?.speedBonus ?? 0;
  const streakBonus = result?.streakBonus ?? 0;
  const totalPoints = result?.totalPoints ?? snapshot.myAnswer?.points ?? 0;
  const basePoints = Math.max(0, totalPoints - speedBonus - streakBonus);
  const correctText = snapshot.question?.options.find((option) => option.index === snapshot.question?.correctIndex)?.text ?? "";

  async function choose(index: number) {
    if (!canAnswer || !session) return;
    setAnswerState({ key: roundKey, selected: index, error: "" });
    const response = await emit("battle:answer", {
      code,
      playerId: session.playerId,
      selectedIndex: index,
      idempotencyKey: answerKey(),
    });
    if (!response.ok) {
      setAnswerState({ key: roundKey, selected: null, error: response.error ?? "ANSWER_FAILED" });
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
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

      <Card strong>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-cream/50">{t("battle.play.score")}</p>
            <p className="text-4xl font-black text-gold">{(me?.score ?? 0).toLocaleString("en-US")}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-widest text-cream/50">{t("battle.play.rank")}</p>
            <p className="text-2xl font-black text-emerald-light">#{rank || "-"}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-widest text-cream/50">{t("battle.play.streak")}</p>
            <p className="text-2xl font-black text-gold">{result?.streakCount ?? 0}</p>
          </div>
        </div>

        <div className="mt-7">
          {snapshot.phase === "lobby" && (
            <div className="py-12 text-center">
              <h1 className="text-2xl font-black text-cream">{t("battle.play.waitingForHost")}</h1>
              <p className="mt-2 text-sm font-bold tracking-[0.2em] text-gold">{code}</p>
            </div>
          )}

          {snapshot.phase === "question" && snapshot.question && (
            <div className="pop-in">
              <p className="text-center text-xs font-bold uppercase tracking-widest text-gold">{snapshot.question.category}</p>
              <h1 className="mt-3 text-center text-xl font-bold leading-snug text-cream">{snapshot.question.prompt}</h1>
              <div className="mt-5 flex justify-center">
                <CircularTimer
                  endsAt={snapshot.turnEndsAt}
                  remainingMs={snapshot.remainingMs}
                  paused={snapshot.paused}
                  totalSeconds={snapshot.config.timerSeconds}
                  size={104}
                />
              </div>
              {!answered ? (
                <>
                  <p className="mt-4 text-center text-sm font-black text-gold">{t("battle.play.chooseAnswer")}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {snapshot.question.options.map((option) => (
                      <button
                        key={option.index}
                        type="button"
                        disabled={!canAnswer}
                        onClick={() => void choose(option.index)}
                        className={`flex min-h-[5rem] items-center gap-3 rounded-3xl bg-gradient-to-br px-4 text-left text-base font-black shadow-lg transition active:scale-[0.98] disabled:opacity-70 ${buttonColors[option.color]}`}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy/25 text-sm">
                          {option.index + 1}
                        </span>
                        <span className="min-w-0 flex-1">{option.text}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="py-10 text-center">
                  <CheckCircle2 size={42} className="mx-auto text-emerald-light" />
                  <p className="mt-4 text-xl font-black text-cream">{t("battle.play.answerSent")}</p>
                  <p className="mt-2 text-sm text-cream/55">{t("battle.play.waitingForPlayers")}</p>
                </div>
              )}
            </div>
          )}

          {reveal && (
            <div className="pop-in py-2">
              <div className={`flex flex-col items-center text-center ${correct ? "text-emerald-light" : "text-rose-300"}`}>
                {correct ? <CheckCircle2 size={48} /> : <XCircle size={48} />}
                <p className="mt-3 text-2xl font-black">{correct ? t("battle.play.correct") : t("battle.play.incorrect")}</p>
              </div>
              {correctText && (
                <p className="mt-5 text-center text-sm text-cream/60">
                  {t("battle.results.correctAnswer")}: <span className="font-black text-cream">{correctText}</span>
                </p>
              )}
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
                  <p className="text-[0.65rem] font-bold uppercase tracking-widest text-cream/45">{t("battle.play.basePoints")}</p>
                  <p className="mt-1 text-xl font-black text-cream">{basePoints.toLocaleString("en-US")}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
                  <p className="text-[0.65rem] font-bold uppercase tracking-widest text-cream/45">{t("battle.play.speedBonus")}</p>
                  <p className="mt-1 text-xl font-black text-gold">+{speedBonus.toLocaleString("en-US")}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
                  <p className="text-[0.65rem] font-bold uppercase tracking-widest text-cream/45">{t("battle.play.streakBonus")}</p>
                  <p className="mt-1 text-xl font-black text-gold">+{streakBonus.toLocaleString("en-US")}</p>
                </div>
                <div className="rounded-2xl border border-emerald/30 bg-emerald/10 p-3 text-center">
                  <p className="text-[0.65rem] font-bold uppercase tracking-widest text-emerald-light/70">{t("battle.play.totalPoints")}</p>
                  <p className="mt-1 text-xl font-black text-emerald-light">+{totalPoints.toLocaleString("en-US")}</p>
                </div>
              </div>
              {typeof result?.responseMs === "number" && (
                <p className="mt-4 flex items-center justify-center gap-2 text-sm font-bold text-cream/55">
                  <Clock size={14} />
                  {t("battle.play.responseTime")}: {(result.responseMs / 1000).toFixed(1)}s
                </p>
              )}
              {snapshot.phase === "reveal" && (
                <p className="mt-5 text-center text-sm font-bold text-cream/50">{t("battle.play.nextRound")}</p>
              )}
            </div>
          )}

          {snapshot.phase === "finished" && (
            <div className="py-8 text-center">
              {me?.isWinner ? <Crown size={48} className="mx-auto text-gold" /> : <Trophy size={44} className="mx-auto text-gold" />}
              <p className="mt-3 text-xl font-black text-gold">{t("battle.play.finished")}</p>
              <Link href={`/battle/results/${code}`} className="mt-5 inline-block">
                <Button variant="outline">{t("common.results")}</Button>
              </Link>
            </div>
          )}

          {error && <p className="mt-4 text-center text-sm font-bold text-rose-300">{error}</p>}
        </div>
      </Card>
    </main>
  );
}
