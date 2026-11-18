"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Sparkles, Users } from "lucide-react";
import { useApp } from "@/components/layout/Providers";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { setHostSession } from "@/lib/session";
import { emitWithAck } from "@/lib/socket";

export default function DailyPage() {
  const router = useRouter();
  const { t, defaults } = useApp();
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const today = useMemo(
    () => new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date()),
    [],
  );

  async function start() {
    setBusy(true);
    setError("");
    const response = await emitWithAck("room:create", {
      config: { ...defaults, mode: "daily" },
      localPlayers: [
        { nickname: nickname.trim() || "Player 1", avatar: "star" },
        { nickname: "Family", avatar: "lion" },
      ],
    });
    setBusy(false);
    if (!response.ok || typeof response.code !== "string" || typeof response.hostToken !== "string") {
      setError(response.error ?? "CREATE_FAILED");
      return;
    }
    setHostSession(response.code, response.hostToken);
    router.push(`/host/${response.code}`);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="text-center">
        <Sparkles size={52} className="mx-auto text-gold" />
        <h1 className="mt-4 text-4xl font-black text-cream sm:text-5xl">{t("daily.title")}</h1>
        <p className="mx-auto mt-4 max-w-xl text-cream/60">{t("daily.subtitle")}</p>
        <Pill tone="gold" className="mt-6">
          <CalendarDays size={13} />
          {today}
        </Pill>
      </div>

      <Card strong className="mt-10">
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-cream/55">{t("join.nickname")}</span>
          <input
            value={nickname}
            onChange={(event) => setNickname(event.target.value.slice(0, 18))}
            placeholder="Zeynep"
            className="w-full rounded-2xl border border-white/15 bg-navy/70 px-4 py-3 text-lg font-bold text-cream"
          />
        </label>
        <p className="mt-4 flex items-center gap-2 text-sm text-cream/50">
          <Users size={15} />
          {t("create.familyHint")}
        </p>
        <Button variant="gold" size="lg" className="mt-7 w-full btn-glow" onClick={start} disabled={busy}>
          {busy ? t("create.creating") : t("daily.start")}
        </Button>
        {error && <p className="mt-3 text-center text-sm font-bold text-rose-300">{error}</p>}
      </Card>
    </div>
  );
}
