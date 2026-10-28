import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccuracyBar } from "@/components/progress/accuracy-bar";
import { TopicsToReview } from "@/components/progress/topics-to-review";
import { Skeleton } from "@/components/ui/skeleton";
import { requireOwnedCourse } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getFlashcardStats, getQuizHistory, getReviewsThisWeek, getTopicStats, topicsToReview } from "@/lib/queries";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("course.tabs.progress") };
}

export default function ProgressPage({ params }: PageProps<"/courses/[courseId]/progress">) {
  return (
    <Suspense fallback={<ProgressSkeleton />}>
      <ProgressView params={params} />
    </Suspense>
  );
}

async function ProgressView({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { userId, course } = await requireOwnedCourse(courseId);
  const [{ t, locale }, topics, quizzes, cards, reviews] = await Promise.all([
    getT(),
    getTopicStats(course.id, userId),
    getQuizHistory(course.id, userId),
    getFlashcardStats(course.id, userId),
    getReviewsThisWeek(course.id, userId),
  ]);

  const completed = quizzes.filter((q) => q.score != null).reverse().slice(-12);
  const avg = completed.length ? Math.round(completed.reduce((s, q) => s + (q.score ?? 0), 0) / completed.length) : null;
  const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-6">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={t("progress.avgScore")} value={avg == null ? "–" : `${avg}%`} />
          <Stat label={t("flash.due")} value={cards.due} />
          <Stat label={t("flash.mastered")} value={`${cards.mastered}/${cards.total}`} />
          <Stat label={t("progress.reviewsWeek")} value={reviews} />
        </dl>

        <section className="rounded-2xl border bg-card p-5">
          <h2 className="mb-4 font-sans text-base font-semibold">{t("progress.quizzes")}</h2>
          {completed.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("quiz.empty")}</p>
          ) : (
            <ScoreChart
              label={t("progress.chartLabel")}
              points={completed.map((q) => ({
                id: q.id,
                score: Math.round(q.score ?? 0),
                label: fmt.format(q.completedAt ?? q.createdAt),
                title: q.title,
                href: `/courses/${course.id}/quiz/${q.id}`,
              }))}
            />
          )}
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <h2 className="mb-4 font-sans text-base font-semibold">{t("progress.allTopics")}</h2>
          {topics.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("progress.topics.empty")}</p>
          ) : (
            <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {[...topics].sort((a, b) => a.topic.localeCompare(b.topic)).map((s) => (
                <li key={s.topic}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{s.topic}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{Math.round(s.accuracy * 100)}%</span>
                  </div>
                  <AccuracyBar value={s.accuracy} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <aside>
        <TopicsToReview courseId={course.id} topics={topicsToReview(topics)} />
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-heading text-2xl font-semibold">{value}</dd>
    </div>
  );
}

/** Simple bar chart of recent quiz scores (oldest → newest). */
function ScoreChart({
  points,
  label,
}: {
  points: { id: string; score: number; label: string; title: string; href: string }[];
  label: string;
}) {
  return (
    <ol className="flex h-44 items-end gap-2" aria-label={label}>
      {points.map((p) => {
        const tone = p.score >= 80 ? "bg-success/70" : p.score >= 55 ? "bg-warning/80" : "bg-destructive/60";
        return (
          <li key={p.id} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="text-xs font-semibold tabular-nums">{p.score}%</span>
            <Link
              href={p.href}
              title={p.title}
              className={`w-full max-w-10 rounded-t-md transition-opacity hover:opacity-80 ${tone}`}
              style={{ height: `${Math.max(p.score, 3)}%` }}
            >
              <span className="sr-only">
                {p.title}: {p.score}%
              </span>
            </Link>
            <span className="w-full truncate text-center text-[10px] text-muted-foreground">{p.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function ProgressSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-56 rounded-2xl" />
      </div>
      <Skeleton className="h-56 rounded-2xl" />
    </div>
  );
}
