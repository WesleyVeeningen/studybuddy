import Link from "next/link";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";
import type { TopicStat } from "@/lib/queries";
import { AccuracyBar } from "./accuracy-bar";

export async function TopicsToReview({ courseId, topics }: { courseId: string; topics: TopicStat[] }) {
  const { t } = await getT();
  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="mb-3 flex items-center gap-2 font-sans text-base font-semibold">
        <Target className="size-4 text-warning" /> {t("progress.topics")}
      </h2>
      {topics.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("progress.topics.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {topics.map((topic) => (
            <li key={topic.topic}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-medium">{topic.topic}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {t("progress.accuracy", { correct: topic.correct, total: topic.attempts })}
                </span>
              </div>
              <AccuracyBar value={topic.accuracy} />
              <Button asChild variant="link" size="sm" className="h-auto px-0 text-xs">
                <Link href={`/courses/${courseId}/quiz?focus=${encodeURIComponent(topic.topic)}`}>
                  {t("progress.practice")} →
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
