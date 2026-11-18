"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Gamepad2, Keyboard, Lightbulb, Radio, Trophy, UserPlus } from "lucide-react";
import { useApp } from "@/components/layout/Providers";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const steps = [
  { key: "step1", icon: UserPlus },
  { key: "step2", icon: BookOpen },
  { key: "step3", icon: Radio },
  { key: "step4", icon: Lightbulb },
  { key: "step5", icon: Keyboard },
  { key: "step6", icon: Trophy },
] as const;

export default function HowToPage() {
  const { t } = useApp();
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="text-center">
        <Gamepad2 size={52} className="mx-auto text-gold" />
        <h1 className="mt-4 text-4xl font-black text-cream sm:text-5xl">{t("howto.title")}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-cream/60">{t("howto.intro")}</p>
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {steps.map(({ key, icon: Icon }) => (
          <Card key={key} className="flex gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold/15 text-gold">
              <Icon size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black text-cream">{t(`howto.${key}Title`)}</h2>
              <p className="mt-2 text-sm leading-relaxed text-cream/60">{t(`howto.${key}Body`)}</p>
            </div>
          </Card>
        ))}
      </div>
      <div className="mt-10 rounded-3xl border border-gold/25 bg-gold/10 p-8 text-center">
        <p className="text-2xl font-black text-cream">{t("howto.ready")}</p>
        <Link href="/create" className="mt-5 inline-block">
          <Button variant="gold" size="lg">
            {t("common.createGame")}
            <ArrowRight size={18} />
          </Button>
        </Link>
      </div>
    </div>
  );
}
