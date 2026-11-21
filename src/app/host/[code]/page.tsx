"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Copy, ExternalLink, Monitor, Plus, Radio, Users } from "lucide-react";
import type { Avatar } from "@/lib/domain";
import { AVATARS } from "@/lib/domain";
import { useApp } from "@/components/layout/Providers";
import { useGameRoom } from "@/hooks/useGameRoom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { AvatarIcon } from "@/components/ui/Avatar";
import { QRCodeImage } from "@/components/ui/QRCodeImage";
import { Scoreboard } from "@/components/game/Scoreboard";
import { HostControls } from "@/components/game/HostControls";
import { LetterTiles } from "@/components/game/LetterTiles";
import { ResultOverlay } from "@/components/game/ResultOverlay";
import { GameEventSounds } from "@/components/game/GameEventSounds";
import { BackgroundMusic } from "@/components/game/BackgroundMusic";

export default function HostPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();
  const { t, language } = useApp();
  const { snapshot, connected, events, emit, hostToken } = useGameRoom(code, "host");
  const [newName, setNewName] = useState("");
  const [newAvatar, setNewAvatar] = useState<Avatar>("fox");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const joinUrl = useMemo(
    () => (typeof window === "undefined" ? "" : `${window.location.origin}/join?code=${code}`),
    [code],
  );

  if (!hostToken) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-3xl font-black text-cream">{t("host.hostOnly")}</h1>
        <Link href="/create" className="mt-6 inline-block">
          <Button variant="gold">{t("common.createGame")}</Button>
        </Link>
      </div>
    );
  }

  if (!snapshot) {
    return <div className="py-32 text-center text-cream/60">{t("common.loading")}</div>;
  }

  async function addLocal() {
    if (!newName.trim()) return;
    const response = await emit("player:add-local", {
      code,
      hostToken,
      nickname: newName.trim(),
      avatar: newAvatar,
      teamId: snapshot?.config.mode === "team" ? "team-a" : null,
    });
    if (!response.ok) setError(response.error ?? "ADD_FAILED");
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
  const localPlayers = snapshot.players.filter((player) => player.isLocal);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <GameEventSounds events={events} />
      <BackgroundMusic phase={snapshot.phase} paused={snapshot.paused} roundIndex={snapshot.roundIndex} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Pill tone="emerald">{connected ? t("common.connected") : t("common.disconnected")}</Pill>
          <h1 className="mt-3 text-3xl font-black text-cream sm:text-4xl">{t("host.title")}</h1>
          <p className="mt-1 text-sm text-cream/55">
            {t("common.room")} <span className="font-black tracking-[0.2em] text-gold">{code}</span>
            {" · "}
            {t("host.round")} {Math.min(snapshot.roundIndex + 1, snapshot.totalRounds)} {t("common.of")} {snapshot.totalRounds}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/tv/${code}`} target="_blank">
            <Button variant="outline">
              <Monitor size={16} />
              {t("common.openTV")}
            </Button>
          </Link>
          <Link href={`/results/${code}`}>
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
            <div className="flex items-center justify-between gap-4">
              <div>
                <Pill tone="gold">{snapshot.question?.category ?? t("host.lobby")}</Pill>
                <p className="mt-3 text-xs font-bold uppercase tracking-widest text-cream/45">
                  {snapshot.question ? `${t("common.round")} ${snapshot.roundIndex + 1}` : t("host.waiting")}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold uppercase tracking-widest text-cream/45">{t("player.pointsAvailable")}</p>
                <p className="text-3xl font-black text-gold">{snapshot.availablePoints}</p>
              </div>
            </div>
            {snapshot.question ? (
              <>
                <h2 className="mt-5 text-xl font-bold leading-snug text-cream sm:text-2xl">{snapshot.question.prompt}</h2>
                <div className="mt-7">
                  <LetterTiles tiles={snapshot.question.tiles} size="lg" />
                </div>
                {activePlayer && (
                  <div className="mt-7 flex items-center justify-center gap-3 rounded-2xl border border-gold/30 bg-gold/10 p-3">
                    <AvatarIcon avatar={activePlayer.avatar} size="sm" active />
                    <span className="font-black text-gold">{activePlayer.nickname}</span>
                    <span className="text-sm text-cream/60">{t("tv.playerBuzzed")}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="py-12 text-center text-cream/45">
                <Radio size={40} className="mx-auto mb-4 text-gold/40" />
                <p>{t("tv.noQuestion")}</p>
              </div>
            )}
            {snapshot.lastResult && (
              <div className="mt-6">
                <ResultOverlay result={snapshot.lastResult} compact />
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-black text-gold">{t("host.controls")}</h2>
            <HostControls snapshot={snapshot} hostToken={hostToken} emit={emit} />
            {error && <p className="mt-3 text-sm font-bold text-rose-300">{error}</p>}
          </Card>

          {localPlayers.length > 0 && (
            <Card>
              <div className="mb-4 flex items-center gap-2 text-gold">
                <Users size={18} />
                <h2 className="text-lg font-black">{t("host.localBuzzer")}</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {localPlayers.map((player) => {
                  const enabled = snapshot.phase === "buzzer_open" && player.isEligible && player.connected;
                  return (
                    <button
                      key={player.id}
                      type="button"
                      disabled={!enabled}
                      onClick={() => void emit("player:buzz", { code, playerId: player.id })}
                      className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.98] ${
                        enabled
                          ? "border-gold/50 bg-gold/10 hover:bg-gold/20"
                          : "border-white/10 bg-white/[0.03] opacity-50"
                      }`}
                    >
                      <AvatarIcon avatar={player.avatar} size="md" active={player.isActive} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-black text-cream">{player.nickname}</p>
                        <p className="text-xs text-cream/50">{t("host.buzzerFor")} · {player.score} {t("common.points")}</p>
                      </div>
                      <span className="text-lg font-black text-gold">BUZZ</span>
                    </button>
                  );
                })}
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
            <Scoreboard players={snapshot.players} groupByTeam={snapshot.config.mode === "team"} />
            {snapshot.phase === "lobby" && (
              <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
                <div className="flex gap-2">
                  <input
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder={t("host.newPlayer")}
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-navy/60 px-3 py-2 text-sm text-cream"
                  />
                  <Button size="sm" variant="ghost" onClick={addLocal} disabled={!newName.trim() || snapshot.players.length >= 6}>
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
            {snapshot.phase === "lobby" && snapshot.players.length < 2 && (
              <p className="mt-4 text-sm text-rose-300">{t("host.needPlayers")}</p>
            )}
          </Card>
        </div>
      </div>
      <span className="hidden">{language}</span>
    </div>
  );
}
