"use client";

import { Check, CircleAlert, Loader2, RotateCcw, Trophy, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { answerQuestion } from "@/app/actions/quiz";
import { AccuracyBar } from "@/components/progress/accuracy-bar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

type Result = {
  response: string;
  correct: boolean;
  score: number;
  feedback: string | null;
  answer: string;
  explanation: string | null;
  source: string | null;
};

export type PlayerQuestion = {
  id: string;
  type: "multiple_choice" | "open" | "true_false";
  prompt: string;
  options: string[] | null;
  topic: string;
  result: Result | null;
};

export function QuizPlayer({ courseId, title, questions: initial }: { courseId: string; title: string; questions: PlayerQuestion[] }) {
  const t = useT();
  const [questions, setQuestions] = useState(initial);
  const firstOpen = initial.findIndex((q) => !q.result);
  const [index, setIndex] = useState(firstOpen === -1 ? initial.length : firstOpen);
  const [response, setResponse] = useState("");
  const [pending, startTransition] = useTransition();

  const done = index >= questions.length;
  const q = questions[Math.min(index, questions.length - 1)];
  const answeredCount = questions.filter((x) => x.result).length;

  function submit(value: string) {
    if (!value.trim() || pending || q.result) return;
    startTransition(async () => {
      try {
        const res = await answerQuestion({ questionId: q.id, response: value });
        setQuestions((qs) =>
          qs.map((x) =>
            x.id === q.id
              ? {
                  ...x,
                  result: {
                    response: value,
                    correct: res.correct,
                    score: res.score,
                    feedback: res.feedback,
                    answer: res.answer,
                    explanation: res.explanation,
                    source: res.source,
                  },
                }
              : x,
          ),
        );
      } catch {
        toast.error(t("common.error"));
      }
    });
  }

  if (done) return <Results courseId={courseId} title={title} questions={questions} />;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
          <span>{t("quiz.question", { n: index + 1, total: questions.length })}</span>
          <span className="truncate pl-4">{q.topic}</span>
        </div>
        <Progress value={(answeredCount / questions.length) * 100} className="h-1.5" />
      </div>

      <article className="rounded-2xl border bg-card p-5 sm:p-7">
        <h2 className="font-sans text-lg leading-snug font-semibold text-pretty sm:text-xl">{q.prompt}</h2>

        <div className="mt-6">
          {q.type === "multiple_choice" && q.options && (
            <ChoiceList
              options={q.options.map((o) => ({ value: o, label: o }))}
              result={q.result}
              disabled={pending}
              onPick={submit}
            />
          )}
          {q.type === "true_false" && (
            <ChoiceList
              options={[
                { value: "true", label: t("quiz.true") },
                { value: "false", label: t("quiz.false") },
              ]}
              result={q.result}
              disabled={pending}
              onPick={submit}
              columns
            />
          )}
          {q.type === "open" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(response);
              }}
              className="space-y-3"
            >
              <Textarea
                value={q.result ? q.result.response : response}
                onChange={(e) => setResponse(e.target.value)}
                readOnly={!!q.result}
                placeholder={t("quiz.openPlaceholder")}
                className="min-h-32"
                aria-label={t("quiz.openPlaceholder")}
              />
              {!q.result && (
                <Button type="submit" disabled={!response.trim() || pending} className="rounded-full">
                  {pending && <Loader2 className="animate-spin" />}
                  {pending ? t("quiz.checking") : t("quiz.check")}
                </Button>
              )}
            </form>
          )}
        </div>

        {pending && q.type !== "open" && (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {t("quiz.checking")}
          </p>
        )}

        {q.result && <Feedback question={q} result={q.result} />}
      </article>

      {q.result && (
        <div className="mt-4 flex justify-end">
          <Button
            size="lg"
            className="rounded-full"
            autoFocus
            onClick={() => {
              setResponse("");
              setIndex((i) => i + 1);
            }}
          >
            {index + 1 >= questions.length ? t("quiz.finish") : t("quiz.next")}
          </Button>
        </div>
      )}
    </div>
  );
}

function ChoiceList({
  options,
  result,
  disabled,
  onPick,
  columns,
}: {
  options: { value: string; label: string }[];
  result: Result | null;
  disabled: boolean;
  onPick: (value: string) => void;
  columns?: boolean;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const chosen = result?.response ?? picked;
  return (
    <div className={cn("grid gap-2", columns && "grid-cols-2")} role="radiogroup">
      {options.map((o, i) => {
        const isChosen = chosen === o.value;
        const isAnswer = result && o.value.trim().toLowerCase() === result.answer.trim().toLowerCase();
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={isChosen}
            disabled={disabled || !!result}
            onClick={() => {
              setPicked(o.value);
              onPick(o.value);
            }}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring enabled:hover:border-primary/50 enabled:hover:bg-accent/50",
              isChosen && !result && "border-primary bg-accent",
              result && isAnswer && "border-success bg-success/10",
              result && isChosen && !isAnswer && "border-destructive bg-destructive/10",
              result && !isChosen && !isAnswer && "opacity-60",
            )}
          >
            {!columns && (
              <span className="grid size-7 shrink-0 place-items-center rounded-lg border text-xs font-semibold text-muted-foreground">
                {String.fromCharCode(65 + i)}
              </span>
            )}
            <span className={cn("flex-1", columns && "text-center font-medium")}>{o.label}</span>
            {result && isAnswer && <Check className="size-4 text-success" />}
            {result && isChosen && !isAnswer && <X className="size-4 text-destructive" />}
          </button>
        );
      })}
    </div>
  );
}

function Feedback({ question, result }: { question: PlayerQuestion; result: Result }) {
  const t = useT();
  const partial = !result.correct && result.score > 0;
  const tone = result.correct ? "success" : partial ? "warning" : "destructive";
  const answerLabel =
    question.type === "true_false" ? (result.answer === "true" ? t("quiz.true") : t("quiz.false")) : result.answer;

  return (
    <div
      className={cn(
        "mt-5 rounded-xl border p-4 text-sm",
        tone === "success" && "border-success/30 bg-success/5",
        tone === "warning" && "border-warning/40 bg-warning/10",
        tone === "destructive" && "border-destructive/30 bg-destructive/5",
      )}
      role="status"
    >
      <p className="mb-1.5 flex items-center gap-2 font-semibold">
        {result.correct ? <Check className="size-4 text-success" /> : <CircleAlert className="size-4" />}
        {result.correct ? t("quiz.correct") : partial ? t("quiz.partial") : t("quiz.incorrect")}
      </p>
      {result.feedback && <p className="mb-2">{result.feedback}</p>}
      {question.type === "open" ? (
        <div className="mb-2">
          <p className="text-xs font-medium text-muted-foreground">{t("quiz.modelAnswer")}</p>
          <p>{result.answer}</p>
        </div>
      ) : (
        !result.correct && <p className="mb-2">{t("quiz.answerWas", { answer: answerLabel })}</p>
      )}
      {result.explanation && <p className="text-muted-foreground">{result.explanation}</p>}
      {result.source && <p className="mt-2 text-xs text-muted-foreground">{t("quiz.source", { source: result.source })}</p>}
    </div>
  );
}

function Results({ courseId, title, questions }: { courseId: string; title: string; questions: PlayerQuestion[] }) {
  const t = useT();
  const score = Math.round((questions.reduce((s, q) => s + (q.result?.score ?? 0), 0) / questions.length) * 100);
  const topics = useMemo(() => {
    const map = new Map<string, { total: number; points: number }>();
    for (const q of questions) {
      const m = map.get(q.topic) ?? { total: 0, points: 0 };
      m.total += 1;
      m.points += q.result?.score ?? 0;
      map.set(q.topic, m);
    }
    return [...map.entries()]
      .map(([topic, m]) => ({ topic, ...m, accuracy: m.points / m.total }))
      .sort((a, b) => a.accuracy - b.accuracy);
  }, [questions]);
  const weak = topics.filter((x) => x.accuracy < 0.8);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="rounded-2xl border bg-card p-6 text-center sm:p-8">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-secondary text-secondary-foreground">
          <Trophy className="size-7" />
        </div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <h2 className="mt-1 text-3xl font-semibold">{t("quiz.results.score", { score })}</h2>
      </div>

      {weak.length > 0 && (
        <section className="mt-4 rounded-2xl border bg-card p-5">
          <h3 className="mb-3 font-sans text-base font-semibold">{t("quiz.results.review")}</h3>
          <ul className="space-y-3">
            {weak.map((w) => (
              <li key={w.topic}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{w.topic}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {t("progress.accuracy", { correct: Math.round(w.points * 10) / 10, total: w.total })}
                  </span>
                </div>
                <AccuracyBar value={w.accuracy} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild variant="outline" className="rounded-full">
          <Link href={`/courses/${courseId}/quiz`}>{t("quiz.results.back")}</Link>
        </Button>
        <Button asChild className="rounded-full">
          <Link href={`/courses/${courseId}/quiz${weak[0] ? `?focus=${encodeURIComponent(weak[0].topic)}` : ""}`}>
            <RotateCcw /> {t("quiz.results.again")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
