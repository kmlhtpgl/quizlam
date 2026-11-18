"use client";

import { useState } from "react";
import { Lock, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { CATEGORIES, DIFFICULTIES, type Category, type Difficulty, type QuestionRecord } from "@/lib/domain";
import { useApp } from "@/components/layout/Providers";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";

interface ParentQuestion extends QuestionRecord {
  createdAt: string;
  updatedAt: string;
}

interface TranslationDraft {
  prompt: string;
  answer: string;
  aliases: string;
  explanation: string;
  source: string;
}

interface Draft {
  id?: string;
  category: Category;
  difficulty: Difficulty;
  approved: boolean;
  en: TranslationDraft;
  tr: TranslationDraft;
}

const emptyTranslation: TranslationDraft = {
  prompt: "",
  answer: "",
  aliases: "",
  explanation: "",
  source: "",
};

const emptyDraft: Draft = {
  category: CATEGORIES[0],
  difficulty: "easy",
  approved: true,
  en: { ...emptyTranslation },
  tr: { ...emptyTranslation },
};

function fromQuestion(question: ParentQuestion): Draft {
  const en = question.translations.en;
  const tr = question.translations.tr;
  return {
    id: question.id,
    category: question.category,
    difficulty: question.difficulty,
    approved: question.approved,
    en: {
      prompt: en?.prompt ?? "",
      answer: en?.answer ?? "",
      aliases: (en?.aliases ?? []).join(", "),
      explanation: en?.explanation ?? "",
      source: en?.source ?? "",
    },
    tr: {
      prompt: tr?.prompt ?? "",
      answer: tr?.answer ?? "",
      aliases: (tr?.aliases ?? []).join(", "),
      explanation: tr?.explanation ?? "",
      source: tr?.source ?? "",
    },
  };
}

function toAliases(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function translationPayload(draft: TranslationDraft) {
  return {
    prompt: draft.prompt,
    answer: draft.answer,
    aliases: toAliases(draft.aliases),
    explanation: draft.explanation,
    source: draft.source.trim() || null,
  };
}

export default function ParentPage() {
  const { t } = useApp();
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [questions, setQuestions] = useState<ParentQuestion[]>([]);
  const [draft, setDraft] = useState<Draft>({ ...emptyDraft });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadQuestions(value: string): Promise<boolean> {
    setBusy(true);
    setError("");
    const response = await fetch("/api/questions", { headers: { "x-parent-pin": value } });
    setBusy(false);
    if (!response.ok) {
      setUnlocked(false);
      setError(t("parent.wrongPin"));
      return false;
    }
    const data = (await response.json()) as { questions: ParentQuestion[] };
    setQuestions(data.questions);
    setUnlocked(true);
    window.sessionStorage.setItem("quizlam.parent.pin", value);
    return true;
  }

  async function save() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-parent-pin": pin },
      body: JSON.stringify({
        id: draft.id,
        category: draft.category,
        difficulty: draft.difficulty,
        approved: draft.approved,
        translations: {
          en: translationPayload(draft.en),
          tr: translationPayload(draft.tr),
        },
      }),
    });
    setBusy(false);
    if (!response.ok) {
      setError(response.status === 401 ? t("parent.wrongPin") : "SAVE_FAILED");
      return;
    }
    setDraft({ ...emptyDraft });
    setNotice(t("settings.saved"));
    window.setTimeout(() => setNotice(""), 1800);
    await loadQuestions(pin);
  }

  async function remove(id: string) {
    if (!window.confirm(t("parent.confirmDelete"))) return;
    const response = await fetch(`/api/questions/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "x-parent-pin": pin },
    });
    if (!response.ok) {
      setError(response.status === 401 ? t("parent.wrongPin") : "DELETE_FAILED");
      return;
    }
    await loadQuestions(pin);
  }

  function field(language: "en" | "tr", key: keyof TranslationDraft, value: string) {
    setDraft((current) => ({ ...current, [language]: { ...current[language], [key]: value } }));
  }

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-md px-4 py-20">
        <Card strong>
          <div className="text-center">
            <Lock size={42} className="mx-auto text-gold" />
            <h1 className="mt-4 text-2xl font-black text-cream">{t("parent.pinTitle")}</h1>
            <p className="mt-2 text-sm text-cream/55">{t("settings.parentPinHint")}</p>
          </div>
          <form
            className="mt-8 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void loadQuestions(pin);
            }}
          >
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-cream/55">{t("parent.pinLabel")}</span>
              <input
                type="password"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                className="w-full rounded-2xl border border-white/15 bg-navy/70 px-4 py-3 text-center text-xl font-black tracking-[0.3em] text-cream"
                autoFocus
              />
            </label>
            <Button type="submit" variant="gold" className="w-full" disabled={!pin || busy}>
              <ShieldCheck size={17} />
              {t("parent.unlock")}
            </Button>
            {error && <p className="text-center text-sm font-bold text-rose-300">{error}</p>}
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-cream">{t("parent.title")}</h1>
          <p className="mt-2 text-sm text-cream/55">
            {questions.length} {t("parent.questionsCount")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {notice && <Pill tone="emerald">{notice}</Pill>}
          <Pill tone="emerald">
            <ShieldCheck size={13} />
            {t("common.approve")}
          </Pill>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <Card strong>
          <h2 className="mb-5 text-lg font-black text-gold">
            {draft.id ? t("parent.editQuestion") : t("parent.newQuestion")}
          </h2>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-cream/55">{t("parent.category")}</span>
                <select
                  value={draft.category}
                  onChange={(event) => setDraft({ ...draft, category: event.target.value as Category })}
                  className="w-full rounded-xl border border-white/15 bg-navy/70 px-3 py-2 text-sm text-cream"
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-cream/55">{t("parent.difficulty")}</span>
                <select
                  value={draft.difficulty}
                  onChange={(event) => setDraft({ ...draft, difficulty: event.target.value as Difficulty })}
                  className="w-full rounded-xl border border-white/15 bg-navy/70 px-3 py-2 text-sm text-cream"
                >
                  {DIFFICULTIES.map((difficulty) => (
                    <option key={difficulty} value={difficulty}>{t(`common.${difficulty}`)}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm font-bold text-cream">
              <input
                type="checkbox"
                checked={draft.approved}
                onChange={(event) => setDraft({ ...draft, approved: event.target.checked })}
                className="h-4 w-4 accent-gold"
              />
              {t("parent.approved")}
            </label>

            {(["en", "tr"] as const).map((language) => (
              <div key={language} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="mb-4 text-sm font-black uppercase tracking-widest text-gold">
                  {language === "en" ? t("parent.english") : t("parent.turkish")}
                </p>
                <div className="space-y-3">
                  <input
                    value={draft[language].prompt}
                    onChange={(event) => field(language, "prompt", event.target.value)}
                    placeholder={t("parent.prompt")}
                    className="w-full rounded-xl border border-white/10 bg-navy/60 px-3 py-2 text-sm text-cream"
                  />
                  <input
                    value={draft[language].answer}
                    onChange={(event) => field(language, "answer", event.target.value)}
                    placeholder={t("parent.answer")}
                    className="w-full rounded-xl border border-white/10 bg-navy/60 px-3 py-2 text-sm font-bold text-cream"
                  />
                  <input
                    value={draft[language].aliases}
                    onChange={(event) => field(language, "aliases", event.target.value)}
                    placeholder={t("parent.aliases")}
                    className="w-full rounded-xl border border-white/10 bg-navy/60 px-3 py-2 text-sm text-cream"
                  />
                  <textarea
                    value={draft[language].explanation}
                    onChange={(event) => field(language, "explanation", event.target.value)}
                    placeholder={t("parent.explanation")}
                    rows={2}
                    className="w-full rounded-xl border border-white/10 bg-navy/60 px-3 py-2 text-sm text-cream"
                  />
                  <input
                    value={draft[language].source}
                    onChange={(event) => field(language, "source", event.target.value)}
                    placeholder={t("parent.source")}
                    className="w-full rounded-xl border border-white/10 bg-navy/60 px-3 py-2 text-sm text-cream"
                  />
                </div>
              </div>
            ))}

            <div className="flex gap-3">
              <Button variant="gold" onClick={save} disabled={busy || !draft.en.answer || !draft.tr.answer}>
                <Plus size={16} />
                {t("parent.save")}
              </Button>
              {draft.id && (
                <Button variant="ghost" onClick={() => setDraft({ ...emptyDraft })}>
                  {t("parent.cancel")}
                </Button>
              )}
            </div>
            {error && <p className="text-sm font-bold text-rose-300">{error}</p>}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-black text-gold">{t("parent.questionEditor")}</h2>
          <div className="max-h-[72vh] space-y-2 overflow-y-auto pr-1">
            {questions.map((question) => (
              <div key={question.id} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={question.approved ? "emerald" : "neutral"}>{question.category}</Pill>
                    <span className="text-xs text-cream/45">{question.difficulty}</span>
                    <span className="text-xs text-cream/30">{question.id}</span>
                  </div>
                  <p className="mt-2 truncate text-sm font-bold text-cream">{question.translations.en?.prompt}</p>
                  <p className="truncate text-xs text-emerald-light">{question.translations.en?.answer}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDraft(fromQuestion(question))}
                  className="rounded-lg px-2 py-1 text-xs font-bold text-gold hover:bg-gold/10"
                >
                  {t("common.edit")}
                </button>
                <button
                  type="button"
                  onClick={() => void remove(question.id)}
                  className="rounded-lg p-1 text-cream/40 hover:bg-rose-500/10 hover:text-rose-300"
                  aria-label={t("parent.delete")}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
