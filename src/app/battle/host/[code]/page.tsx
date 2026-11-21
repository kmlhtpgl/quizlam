"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Copy, ExternalLink, Monitor, Radio, Trophy, Users } from "lucide-react";
import type { BattleChoiceColor } from "@/lib/battleDomain";
import { useApp } from "@/components/layout/Providers";
import { useBattleRoom } from "@/hooks/useBattleRoom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { AvatarIcon } from "@/components/ui/Avatar";
import { QRCodeImage } from "@/components/ui/QRCodeImage";
import { Scoreboard } from "@/components/game/Scoreboard";
import { GameEventSounds } from "@/components/game/GameEventSounds";
import { McqBackgroundMusic } from "@/components/mcq/McqBackgroundMusic";
import type { McqPhase } from "@/lib/mcqDomain";

const choiceColors: Record<BattleChoiceColor, string> = {
  red: "border-rose-400/40 bg-rose-500/15 text-rose-100",
  blue: "border-sky-400/40 bg-sky-500/15 text-sky-100",
  yellow: "border-gold/40 bg-gold/15 text-gold",
  green: "border-emerald/40 bg-emerald/15 text-emerald-light",
};

function musicPhase(phase: string): McqPhase {
  if (phase === "question") return "question";
  if (phase === "reveal") return "answer_result";
  if (phase === "finished") return "finished";
  return "lobby";
}

export default function BattleHostPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();
  const { t } = useApp();
  const { snapshot, connected, events, emit, hostToken } = useBattleRoom(code, "host");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const joinUrl = useMemo(
    () => (typeof window === "undefined" ? "" : `${window.location.origin}/join?code=${code}&game=battle`),
    [code],
  );

  if (!hostToken) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-3xl font-black text-cream">{t("host.hostOnly")}</h1>
        <Link href="/games" className="mt-6 inline-block">
          <Button variant="gold">{t("games.title")}</Button>
        </Link>
      </div>
    );
  }

  if (!snapshot) return <div className="py-32 text-center text-cream/60">{t("common.loading")}</div>;

  async function run(eventName: string) {
    setError("");
    const response = await emit(eventName, { code, hostToken });
    if (!response.ok) setError(response.error ?? "ACTION_FAILED");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("COPY_FAILED");
    }
  }

  const round = Math.min(snapshot.roundIndex + 1, snapshot.totalRounds);
  const correctOption = snapshot.phase === "reveal" ? snapshot.question?.options.find((option) => option.index === snapshot.question?.correctIndex) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <GameEventSounds events={events} />
      <McqBackgroundMusic phase={musicPhase(snapshot.phase)} paused={snapshot.paused} roundIndex={snapshot.roundIndex} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Pill tone={connected ? "emerald" : "danger"}>{connected ? t("common.connected") : t("common.disconnected")}</Pill>
          <h1 className="mt-3 text-3xl font-black text-cream sm:text-4xl">{t("battle.host.title")}</h1>
          <p className="mt-1 text-sm text-cream/55">
            {t("common.room")} <span className="font-black tracking-[0.2em] text-gold">{code}</span>
            {" · "}
            {t("battle.host.roundProgress", { current: round, total: snapshot.totalRounds })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/battle/tv/${code}`} target="_blank">
            <Button variant="outline">
              <Monitor size={16} />
              {t("common.openTV")}
            </Button>
          </Link>
          <Link href={`/battle/results/${code}`}>
            <Button variant="ghost">
              <Radio size={16} />
              {t("common.results")}
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-6">
          <Card strong>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Pill tone="gold">{snapshot.question?.category ?? t("host.lobby")}</Pill>
              {snapshot.phase === "question" && (
                <Pill tone="emerald">
                  {t("battle.host.answers", { count: snapshot.answerCount, total: snapshot.players.length })}
                </Pill>
              )}
              {snapshot.paused && <Pill tone="gold">{t("battle.tv.paused")}</Pill>}
            </div>

            {snapshot.phase === "lobby" && (
              <p className="mt-10 text-center text-xl font-bold text-cream/60">{t("battle.host.waiting")}</p>
            )}

            {(snapshot.phase === "question" || snapshot.phase === "reveal") && snapshot.question && (
              <div className="mt-6">
                <p className="text-xs font-bold uppercase tracking-widest text-gold">{t("battle.host.question")}</p>
                <h2 className="mt-2 text-2xl font-bold leading-snug text-cream">{snapshot.question.prompt}</h2>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {snapshot.question.options.map((option) => (
                    <div key={option.index} className={`rounded-2xl border px-4 py-3 text-sm font-bold ${choiceColors[option.color]}`}>
                      {option.text}
                    </div>
                  ))}
                </div>
                {correctOption && (
                  <p className="mt-5 text-lg font-black text-emerald-light">
                    {t("battle.host.correctAnswer")}: {correctOption.text}
                  </p>
                )}
              </div>
            )}

            {snapshot.phase === "finished" && (
              <div className="mt-10 text-center">
                <Trophy size={52} className="mx-auto text-gold" />
                <p className="mt-4 text-2xl font-black text-gold">{t("battle.host.finished")}</p>
                <Link href={`/battle/results/${code}`} className="mt-6 inline-block">
                  <Button variant="gold">
                    {t("common.results")}
                    <ExternalLink size={15} />
                  </Button>
                </Link>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-black text-gold">{t("host.controls")}</h2>
            <div className="flex flex-wrap gap-3">
              {snapshot.phase === "lobby" && (
                <Button variant="gold" onClick={() => void run("battle:start")} disabled={!snapshot.players.length}>
                  {t("battle.host.start")}
                </Button>
              )}
              {snapshot.phase === "question" && (
                <>
                  {snapshot.paused ? (
                    <Button variant="primary" onClick={() => void run("battle:resume")}>
                      {t("battle.host.resume")}
                    </Button>
                  ) : (
                    <Button variant="ghost" onClick={() => void run("battle:pause")}>
                      {t("battle.host.pause")}
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => void run("battle:skip")}>
                    {t("battle.host.skip")}
                  </Button>
                </>
              )}
              {snapshot.phase === "reveal" && (
                <Button variant="gold" onClick={() => void run("battle:next")}>
                  {t("battle.host.next")}
                </Button>
              )}
              {snapshot.phase !== "finished" && (
                <Button variant="danger" onClick={() => void run("battle:end")}>
                  {t("battle.host.end")}
                </Button>
              )}
            </div>
            {!snapshot.players.length && snapshot.phase === "lobby" && (
              <p className="mt-3 text-sm font-bold text-rose-300">{t("battle.host.needPlayers")}</p>
            )}
            {error && <p className="mt-3 text-sm font-bold text-rose-300">{error}</p>}
          </Card>

          <Card>
            <div className="mb-4 flex items-center gap-2 text-gold">
              <Users size={18} />
              <h2 className="text-sm font-black uppercase tracking-widest">{t("battle.host.liveStandings")}</h2>
            </div>
            <Scoreboard players={snapshot.players} compact />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-black text-gold">{t("host.shareTitle")}</h2>
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-3xl bg-cream p-3">
                <QRCodeImage value={joinUrl} />
              </div>
              <p className="text-center text-xs text-cream/50">{t("host.shareHint")}</p>
              <div className="flex w-full gap-2">
                <input readOnly value={joinUrl} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-navy/60 px-3 py-2 text-xs text-cream/70" />
                <Button variant="ghost" size="sm" onClick={copyLink}>
                  {copied ? <span className="text-emerald-light">{t("common.copied")}</span> : <Copy size={15} />}
                </Button>
              </div>
              <a href={joinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-gold hover:underline">
                {t("host.openLink")}
                <ExternalLink size={12} />
              </a>
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-black text-gold">{t("host.playerList")}</h2>
            <div className="space-y-2">
              {snapshot.players.length === 0 && <p className="text-sm text-cream/50">{t("host.noPlayers")}</p>}
              {snapshot.players.map((player) => (
                <div key={player.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-2.5">
                  <AvatarIcon avatar={player.avatar} size="sm" active={player.connected} />
                  <span className="min-w-0 flex-1 truncate font-bold text-cream">{player.nickname}</span>
                  <span className="text-sm font-black text-gold">{player.score.toLocaleString("en-US")}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
