"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Hash, User } from "lucide-react";
import { AVATARS, type Avatar } from "@/lib/domain";
import { useApp } from "@/components/layout/Providers";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AvatarIcon } from "@/components/ui/Avatar";
import { setPlayerSession } from "@/lib/session";
import { emitWithAck } from "@/lib/socket";

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="py-32 text-center text-cream/60">Loading...</div>}>
      <JoinForm />
    </Suspense>
  );
}

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useApp();
  const [code, setCode] = useState(() => (searchParams.get("code") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState<Avatar>("fox");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function join() {
    setBusy(true);
    setError("");
    const response = await emitWithAck("room:join", { code, nickname, avatar });
    setBusy(false);
    if (
      !response.ok ||
      typeof response.playerId !== "string" ||
      typeof response.token !== "string"
    ) {
      setError(response.error ?? "JOIN_FAILED");
      return;
    }
    setPlayerSession(code, {
      playerId: response.playerId,
      token: response.token,
      nickname,
      avatar,
    });
    router.push(`/play/${code}`);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-black text-cream sm:text-5xl">{t("join.title")}</h1>
        <p className="mt-3 text-cream/60">{t("join.subtitle")}</p>
      </div>
      <Card strong>
        <div className="space-y-6">
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-cream/60">
              <Hash size={14} />
              {t("join.roomCode")}
            </span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
              placeholder="AB3K7Q"
              className="w-full rounded-2xl border border-white/15 bg-navy/70 px-4 py-4 text-center text-3xl font-black uppercase tracking-[0.4em] text-gold placeholder:text-cream/20 focus:border-gold focus:outline-none"
            />
            <span className="mt-2 block text-center text-xs text-cream/40">{t("join.codeHelp")}</span>
          </label>

          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-cream/60">
              <User size={14} />
              {t("join.nickname")}
            </span>
            <input
              value={nickname}
              onChange={(event) => setNickname(event.target.value.slice(0, 18))}
              placeholder="Zeynep"
              className="w-full rounded-2xl border border-white/15 bg-navy/70 px-4 py-3 text-lg font-bold text-cream placeholder:text-cream/25 focus:border-gold focus:outline-none"
            />
          </label>

          <div>
            <span className="mb-3 block text-xs font-bold uppercase tracking-widest text-cream/60">{t("join.chooseAvatar")}</span>
            <div className="grid grid-cols-5 gap-3">
              {AVATARS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setAvatar(item)}
                  className={`flex flex-col items-center gap-2 rounded-2xl border p-2 transition ${
                    avatar === item ? "border-gold bg-gold/10" : "border-white/10 bg-white/5 hover:border-white/25"
                  }`}
                  aria-label={item}
                >
                  <AvatarIcon avatar={item} size="sm" active={avatar === item} />
                  <span className="text-[0.6rem] font-bold uppercase text-cream/60">{item}</span>
                </button>
              ))}
            </div>
          </div>

          <Button size="lg" variant="gold" className="w-full btn-glow" onClick={join} disabled={busy || code.length < 4 || !nickname.trim()}>
            {busy ? t("join.joining") : t("join.joinButton")}
            <ArrowRight size={18} />
          </Button>
          {error && <p className="text-center text-sm font-bold text-rose-300">{error}</p>}
        </div>
      </Card>
    </div>
  );
}
