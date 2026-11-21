"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Crown, Radio } from "lucide-react";
import { getPlayerSession } from "@/lib/session";
import { useApp } from "@/components/layout/Providers";
import { useMcqRoom } from "@/hooks/useMcqRoom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { AvatarIcon } from "@/components/ui/Avatar";
import { CircularTimer } from "@/components/game/CircularTimer";
import { McqOptions } from "@/components/mcq/McqOptions";
import { McqResultCard } from "@/components/mcq/McqResultCard";

export default function McqPlayerPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();
  const { t } = useApp();
  const session = useMemo(() => getPlayerSession(code), [code]);
  const { snapshot, connected, emit } = useMcqRoom(code, "player");
  const [answerState, setAnswerState] = useState<{ key: string; selected: number | null; error: string }>({
    key: "",
    selected: null,
    error: "",
  });
  const roundKey = snapshot ? `${snapshot.roundIndex}:${snapshot.phase}` : "";
  const activeState = answerState.key === roundKey ? answerState : { key: roundKey, selected: null, error: "" };
  const selected = activeState.selected;
  const error = activeState.error;

  useEffect(() => {
    if (!session?.token) return;
    void emit("mcq:reconnect", { code, token: session.token });
  }, [code, emit, session?.token]);

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <Card strong className="max-w-md text-center">
          <h1 className="text-3xl font-black text-cream">{t("mcq.player.title")}</h1>
          <p className="mt-3 text-sm text-cream/60">{t("join.subtitle")}</p>
          <Link href={`/join?code=${code}&game=mcq`} className="mt-6 inline-block">
            <Button variant="gold">{t("common.joinGame")}</Button>
          </Link>
        </Card>
      </main>
    );
  }

  if (!snapshot) return <div className="flex min-h-screen items-center justify-center text-cream/60">{t("common.loading")}</div>;

  const me = snapshot.players.find((player) => player.id === session.playerId);
  const isContestant = snapshot.activePlayerId === session.playerId;
  const canAnswer = isContestant && snapshot.phase === "question" && connected && !snapshot.paused && selected === null;

  async function choose(index: number) {
    if (!canAnswer || !session) return;
    setAnswerState({ key: roundKey, selected: index, error: "" });
    const response = await emit("mcq:answer", {
      code,
      playerId: session.playerId,
      choice: index,
      idempotencyKey: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    });
    if (!response.ok) {
      setAnswerState({ key: roundKey, selected: null, error: response.error ?? "ANSWER_FAILED" });
    }
  }

  async function useFiftyFifty() {
    if (!session) return;
    const response = await emit("mcq:fifty-fifty", { code, playerId: session.playerId });
    if (!response.ok) setAnswerState({ key: roundKey, selected, error: response.error ?? "LIFELINE_FAILED" });
  }

  const revealResult = snapshot.lastResult && (snapshot.phase === "answer_result" || snapshot.phase === "finished");

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
            <p className="text-xs font-bold uppercase tracking-widest text-cream/50">{t("player.score")}</p>
            <p className="text-4xl font-black text-gold">{(me?.score ?? 0).toLocaleString("en-US")}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-widest text-cream/50">{t("mcq.player.currentValue")}</p>
            <p className="text-2xl font-black text-gold">{snapshot.currentValue.toLocaleString("en-US")}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-widest text-cream/50">{t("mcq.player.banked")}</p>
            <p className="text-2xl font-black text-emerald-light">{snapshot.bankedPoints.toLocaleString("en-US")}</p>
          </div>
        </div>

        <div className="mt-7">
          {snapshot.phase === "lobby" && (
            <div className="py-10 text-center">
              <h1 className="text-2xl font-black text-cream">{t("mcq.player.waitingForHost")}</h1>
              <p className="mt-2 text-sm text-cream/50">{code}</p>
            </div>
          )}

          {snapshot.phase === "contestant" && (
            <div className="py-10 text-center">
              <h1 className="text-2xl font-black text-cream">
                {isContestant ? t("mcq.player.youAreContestant") : t("mcq.player.waitingForContestant")}
              </h1>
            </div>
          )}

          {snapshot.phase === "question" && snapshot.question && (
            <div className="pop-in">
              <p className="text-center text-xs font-bold uppercase tracking-widest text-gold">{snapshot.question.category}</p>
              <h1 className="mt-3 text-center text-xl font-bold leading-snug text-cream">{snapshot.question.prompt}</h1>
              {isContestant ? (
                <>
                  <div className="mt-5 flex justify-center">
                    <CircularTimer
                      endsAt={snapshot.turnEndsAt}
                      remainingMs={snapshot.remainingMs}
                      paused={snapshot.paused}
                      totalSeconds={snapshot.config.timerSeconds}
                      size={110}
                    />
                  </div>
                  <p className="mt-4 text-center text-sm font-bold text-gold">{t("mcq.player.chooseAnswer")}</p>
                  <div className="mt-4">
                    <McqOptions
                      options={snapshot.question.options}
                      selectedIndex={selected}
                      onSelect={choose}
                      disabled={!canAnswer}
                      compact
                    />
                  </div>
                  {selected !== null && <p className="mt-3 text-center text-sm font-black text-emerald-light">{t("mcq.player.answerSent")}</p>}
                  {!snapshot.fiftyFiftyUsed ? (
                    <Button variant="outline" className="mt-5 w-full" onClick={useFiftyFifty} disabled={selected !== null || !canAnswer}>
                      {t("mcq.player.fiftyFifty")}
                    </Button>
                  ) : (
                    <p className="mt-5 text-center text-xs font-bold text-cream/40">{t("mcq.player.fiftyFiftyUsed")}</p>
                  )}
                </>
              ) : (
                <div className="py-12 text-center">
                  <p className="text-xl font-black text-cream">{t("mcq.player.spectator")}</p>
                </div>
              )}
            </div>
          )}

          {revealResult && snapshot.lastResult && (
            <div className="py-3">
              <McqResultCard result={snapshot.lastResult} compact />
              {snapshot.question && (
                <div className="mt-4">
                  <McqOptions
                    options={snapshot.question.options}
                    correctIndex={snapshot.question.correctIndex}
                    selectedIndex={snapshot.lastResult.selectedIndex}
                    compact
                  />
                </div>
              )}
            </div>
          )}

          {snapshot.phase === "finished" && (
            <div className="py-8 text-center">
              <Crown size={48} className="mx-auto text-gold" />
              <p className="mt-3 text-xl font-black text-gold">{t("mcq.player.runOver")}</p>
            </div>
          )}

          {error && <p className="mt-4 text-center text-sm font-bold text-rose-300">{error}</p>}
        </div>
      </Card>
    </main>
  );
}
