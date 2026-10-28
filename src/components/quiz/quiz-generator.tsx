"use client";

import { Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { generateQuiz } from "@/app/actions/quiz";
import { FilePicker, type PickableFile } from "@/components/material/file-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const TYPES = ["multiple_choice", "true_false", "open"] as const;

export function QuizGenerator({
  courseId,
  files,
  defaultFocus,
}: {
  courseId: string;
  files: PickableFile[];
  defaultFocus: string;
}) {
  const t = useT();
  const router = useRouter();
  const [fileIds, setFileIds] = useState<string[]>([]);
  const [count, setCount] = useState(8);
  const [types, setTypes] = useState<(typeof TYPES)[number][]>([...TYPES]);
  const [focus, setFocus] = useState(defaultFocus);
  const [pending, startTransition] = useTransition();

  if (files.length === 0) {
    return (
      <section className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-12 text-center">
        <p className="font-medium">{t("material.empty.title")}</p>
        <p className="mt-1 mb-5 text-sm text-muted-foreground">{t("material.empty.body")}</p>
        <Button asChild className="rounded-full">
          <Link href={`/courses/${courseId}`}>{t("material.upload.title")}</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-card p-5 sm:p-6">
      <h2 className="mb-5 text-2xl font-semibold">{t("quiz.new.title")}</h2>
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const res = await generateQuiz({ courseId, fileIds, count, types, focus: focus || undefined });
            if (res.ok) router.push(`/courses/${courseId}/quiz/${res.quizId}`);
            else toast.error(res.error === "no_material" ? t("material.empty.body") : t("common.error"));
          });
        }}
      >
        <FilePicker files={files} value={fileIds} onChange={setFileIds} label={t("quiz.new.files")} />

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label htmlFor="quiz-count">{t("quiz.new.count")}</Label>
            <span className="text-sm font-semibold tabular-nums">{count}</span>
          </div>
          <input
            id="quiz-count"
            type="range"
            min={5}
            max={15}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-full accent-[var(--primary)]"
          />
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t("quiz.new.types")}</legend>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((type) => {
              const checked = types.includes(type);
              return (
                <label
                  key={type}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                    checked && "border-primary/40 bg-accent",
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) =>
                      setTypes((prev) =>
                        v ? [...prev, type] : prev.length > 1 ? prev.filter((x) => x !== type) : prev,
                      )
                    }
                  />
                  {t(`quiz.type.${type}`)}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-1.5">
          <Label htmlFor="quiz-focus">{t("quiz.new.focus")}</Label>
          <Input
            id="quiz-focus"
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            maxLength={200}
            placeholder={t("quiz.new.focusPlaceholder")}
          />
        </div>

        <Button type="submit" size="lg" className="w-full rounded-full sm:w-auto" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {pending ? t("quiz.new.generating") : t("quiz.new.generate")}
        </Button>
      </form>
    </section>
  );
}
