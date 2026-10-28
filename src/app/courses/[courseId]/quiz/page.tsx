import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { QuizGenerator } from "@/components/quiz/quiz-generator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { requireOwnedCourse } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getQuizHistory, getReadyFiles } from "@/lib/queries";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("course.tabs.quiz") };
}

export default function QuizPage({ params, searchParams }: PageProps<"/courses/[courseId]/quiz">) {
  return (
    <Suspense fallback={<QuizSkeleton />}>
      <Quizzes params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Quizzes({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ courseId }, sp] = await Promise.all([params, searchParams]);
  const { userId, course } = await requireOwnedCourse(courseId);
  const [{ t, locale }, files, history] = await Promise.all([
    getT(),
    getReadyFiles(course.id),
    getQuizHistory(course.id, userId),
  ]);
  const focus = typeof sp.focus === "string" ? sp.focus : "";
  const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <QuizGenerator courseId={course.id} files={files} defaultFocus={focus} />
      <section>
        <h2 className="mb-3 font-sans text-sm font-semibold tracking-normal text-muted-foreground uppercase">
          {t("quiz.history")}
        </h2>
        {history.length === 0 ? (
          <p className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            {t("quiz.empty")}
          </p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
            {history.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/courses/${course.id}/quiz/${q.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{q.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {dateFmt.format(q.createdAt)} · {t("quiz.questions", { count: q.questionCount })}
                    </p>
                  </div>
                  {q.score == null ? (
                    <Badge variant="secondary">{t("quiz.inProgress")}</Badge>
                  ) : (
                    <ScoreBadge score={q.score} />
                  )}
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const s = Math.round(score);
  const tone = s >= 80 ? "bg-success/15 text-success" : s >= 55 ? "bg-warning/20 text-foreground" : "bg-destructive/15 text-destructive";
  return <span className={`rounded-full px-2 py-0.5 text-sm font-semibold tabular-nums ${tone}`}>{s}%</span>;
}

function QuizSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <Skeleton className="h-96 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}
