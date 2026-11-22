"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Copy, ExternalLink, Monitor, Plus, Radio, Trophy, Users } from "lucide-react";
import { AVATARS, type Avatar } from "@/lib/domain";
import { useApp } from "@/components/layout/Providers";
import { useMcqRoom } from "@/hooks/useMcqRoom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { AvatarIcon } from "@/components/ui/Avatar";
import { QRCodeImage } from "@/components/ui/QRCodeImage";
import { Scoreboard } from "@/components/game/Scoreboard";
import { CircularTimer } from "@/components/game/CircularTimer";
import { GameEventSounds } from "@/components/game/GameEventSounds";
import { McqBackgroundMusic } from "@/components/mcq/McqBackgroundMusic";
import { McqOptions } from "@/components/mcq/McqOptions";
import { McqResultCard } from "@/components/mcq/McqResultCard";

export default function McqHostPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();
  const { t } = useApp();
  const { snapshot, connected, events, emit, hostToken } = useMcqRoom(code, "host");
  const [newName, setNewName] = useState("");
  const [newAvatar, setNewAvatar] = useState<Avatar>("fox");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const joinUrl = useMemo(
    () => (typeof window === "undefined" ? "" : `${window.location.origin}/join?code=${code}&game=mcq`),
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

  async function run(eventName: string, payload: Record<string, unknown>) {
    setError("");
    const response = await emit(eventName, payload);
    if (!response.ok) setError(response.error ?? "ACTION_FAILED");
  }

  async function addLocal() {
    if (!newName.trim()) return;
    await run("mcq:add-local", { code, hostToken, nickname: newName.trim(), avatar: newAvatar });
    setNewName("");
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

  const activePlayer = snapshot.players.find((player) => player.id === snapshot.activePlayerId);
  const canSelect = snapshot.phase === "lobby" || snapshot.phase === "contestant" || snapshot.phase === "finished";
  const value = Math.min(snapshot.roundIndex + 1, snapshot.totalRounds);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <GameEventSounds events={events} />
      <McqBackgroundMusic phase={snapshot.phase} paused={snapshot.paused} roundIndex={snapshot.roundIndex} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Pill tone={connected ? "emerald" : "danger"}>{connected ? t("common.connected") : t("common.disconnected")}</Pill>
          <h1 className="mt-3 text-3xl font-black text-cream sm:text-4xl">{t("mcq.host.title")}</h1>
          <p className="mt-1 text-sm text-cream/55">
            {t("common.room")} <span className="font-black tracking-[0.2em] text-gold">{code}</span>
            {" · "}
            {t("common.round")} {value} {t("common.of")} {snapshot.totalRounds}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/mcq/tv/${code}`} target="_blank">
            <Button variant="outline">
              <Monitor size={16} />
              {t("common.openTV")}
            </Button>
          </Link>
          <Link href={`/mcq/results/${code}`}>
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
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Pill tone="gold">{snapshot.question?.category ?? t("host.lobby")}</Pill>
              <div className="flex gap-6 text-right">
                <div>
                  <p className="text-[0.65rem] font-bold uppercase tracking-widest text-cream/45">{t("mcq.host.currentValue")}</p>
                  <p className="text-2xl font-black text-gold">{snapshot.currentValue.toLocaleString("en-US")}</p>
                </div>
                <div>
                  <p className="text-[0.65rem] font-bold uppercase tracking-widest text-cream/45">{t("mcq.host.banked")}</p>
                  <p className="text-2xl font-black text-emerald-light">{snapshot.bankedPoints.toLocaleString("en-US")}</p>
                </div>
              </div>
            </div>

            {snapshot.phase === "question" && snapshot.question && (
              <div className="mt-6">
                <h2 className="text-xl font-bold leading-snug text-cream">{snapshot.question.prompt}</h2>
                <div className="mt-5">
                  <McqOptions options={snapshot.question.options} compact />
                </div>
                {activePlayer && (
                  <div className="mt-5 flex items-center gap-3 rounded-2xl border border-gold/30 bg-gold/10 p-3">
                    <AvatarIcon avatar={activePlayer.avatar} size="sm" active />
                    <span className="font-black text-gold">{activePlayer.nickname}</span>
                  </div>
                )}
              </div>
            )}

            {snapshot.phase === "contestant" && (
              <p className="mt-8 text-center text-lg font-bold text-cream/60">
                {activePlayer ? t("mcq.host.contestantReady") : t("mcq.host.noContestant")}
              </p>
            )}

            {snapshot.phase === "answer_result" && snapshot.lastResult && (
              <div className="mt-6">
                <McqResultCard result={snapshot.lastResult} />
                <div className="mt-5 flex flex-col items-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-cream/60">{t("mcq.host.autoAdvance")}</p>
                  <CircularTimer
                    endsAt={snapshot.nextQuestionAt}
                    remainingMs={snapshot.resultHoldMs}
                    paused={false}
                    totalSeconds={Math.round(snapshot.resultHoldMs / 1000)}
                    size={92}
                  />
                </div>
              </div>
            )}

            {snapshot.phase === "finished" && (
              <div className="mt-8 text-center">
                <Trophy size={46} className="mx-auto text-gold" />
                <p className="mt-3 text-2xl font-black text-gold">{t("mcq.host.runOver")}</p>
                {snapshot.lastResult && (
                  <div className="mt-6">
                    <McqResultCard result={snapshot.lastResult} />
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-black text-gold">{t("host.controls")}</h2>
            <div className="flex flex-wrap gap-3">
              {snapshot.phase === "contestant" && activePlayer && (
                <Button variant="gold" onClick={() => void run("mcq:start", { code, hostToken })}>
                  {t("mcq.host.startRun")}
                </Button>
              )}
              {snapshot.phase === "question" && (
                <>
                  {snapshot.paused ? (
                    <Button variant="primary" onClick={() => void run("mcq:resume", { code, hostToken })}>
                      {t("mcq.host.resume")}
                    </Button>
                  ) : (
                    <Button variant="ghost" onClick={() => void run("mcq:pause", { code, hostToken })}>
                      {t("mcq.host.pause")}
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => void run("mcq:reveal", { code, hostToken })}>
                    {t("mcq.host.reveal")}
                  </Button>
                </>
              )}
              {snapshot.phase === "answer_result" && (
                <Button variant="gold" onClick={() => void run("mcq:next", { code, hostToken })}>
                  {t("mcq.host.nextNow")}
                </Button>
              )}
              {snapshot.phase === "finished" && (
                <>
                  <Button variant="gold" onClick={() => void run("mcq:reset", { code, hostToken })}>
                    {t("mcq.host.resetRun")}
                  </Button>
                  <Link href={`/mcq/results/${code}`}>
                    <Button variant="outline">{t("mcq.host.goResults")}</Button>
                  </Link>
                </>
              )}
            </div>
            {error && <p className="mt-3 text-sm font-bold text-rose-300">{error}</p>}
          </Card>

          {canSelect && (
            <Card>
              <h2 className="mb-4 text-lg font-black text-gold">{t("mcq.host.selectContestant")}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {snapshot.players.map((player) => (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => void run("mcq:select-contestant", { code, hostToken, playerId: player.id })}
                    className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.98] ${
                      player.id === snapshot.activePlayerId
                        ? "border-gold/60 bg-gold/15"
                        : "border-white/10 bg-white/[0.04] hover:border-gold/40"
                    }`}
                  >
                    <AvatarIcon avatar={player.avatar} size="sm" active={player.id === snapshot.activePlayerId} />
                    <span className="min-w-0 flex-1 truncate font-black text-cream">{player.nickname}</span>
                    <span className="text-xs font-bold text-cream/40">{player.score}</span>
                  </button>
                ))}
              </div>
            </Card>
          )}
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
            <Scoreboard players={snapshot.players} compact />
            {canSelect && (
              <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
                <div className="flex gap-2">
                  <input
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder={t("mcq.host.newPlayer")}
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-navy/60 px-3 py-2 text-sm text-cream"
                  />
                  <Button size="sm" variant="ghost" onClick={addLocal} disabled={!newName.trim() || snapshot.players.length >= 12}>
                    <Plus size={15} />
                  </Button>
                </div>
                <select
                  value={newAvatar}
                  onChange={(event) => setNewAvatar(event.target.value as Avatar)}
                  className="w-full rounded-xl border border-white/10 bg-navy/60 px-3 py-2 text-sm text-cream"
                  aria-label={t("create.avatar")}
                >
                  {AVATARS.map((avatar) => (
                    <option key={avatar} value={avatar}>{avatar}</option>
                  ))}
                </select>
              </div>
            )}
          </Card>

          {snapshot.phase !== "lobby" && (
            <Card>
              <div className="mb-3 flex items-center gap-2 text-gold">
                <Users size={18} />
                <h2 className="text-sm font-black uppercase tracking-widest">{t("mcq.host.selectedContestant")}</h2>
              </div>
              {activePlayer ? (
                <div className="flex items-center gap-3">
                  <AvatarIcon avatar={activePlayer.avatar} size="md" active />
                  <span className="text-xl font-black text-cream">{activePlayer.nickname}</span>
                </div>
              ) : (
                <p className="text-sm text-cream/45">{t("mcq.host.noContestant")}</p>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
