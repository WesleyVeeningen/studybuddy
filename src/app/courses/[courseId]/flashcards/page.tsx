import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { and, asc, eq, lte } from "drizzle-orm";
import { Suspense } from "react";
import { FlashcardsView } from "@/components/flashcards/flashcards-view";
import { Skeleton } from "@/components/ui/skeleton";
import { requireOwnedCourse } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { getFlashcardStats, getReadyFiles } from "@/lib/queries";
import { getDueCutoff } from "@/lib/time-server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("course.tabs.flashcards") };
}

export default function FlashcardsPage({ params }: PageProps<"/courses/[courseId]/flashcards">) {
  return (
    <Suspense fallback={<FlashcardsSkeleton />}>
      <Flashcards params={params} />
    </Suspense>
  );
}

async function Flashcards({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { userId, course } = await requireOwnedCourse(courseId);
  const cutoff = await getDueCutoff();
  const [stats, files, due, all] = await Promise.all([
    getFlashcardStats(course.id, userId),
    getReadyFiles(course.id),
    db.query.flashcards.findMany({
      where: and(
        eq(schema.flashcards.courseId, course.id),
        eq(schema.flashcards.userId, userId),
        lte(schema.flashcards.dueAt, cutoff),
      ),
      orderBy: asc(schema.flashcards.dueAt),
      limit: 200,
      columns: { id: true, front: true, back: true, topic: true },
    }),
    db.query.flashcards.findMany({
      where: and(eq(schema.flashcards.courseId, course.id), eq(schema.flashcards.userId, userId)),
      orderBy: asc(schema.flashcards.dueAt),
      limit: 500,
      columns: { id: true, front: true, back: true, topic: true, dueAt: true, interval: true },
    }),
  ]);

  return (
    <FlashcardsView
      courseId={course.id}
      stats={stats}
      files={files}
      due={due}
      cards={all.map((c) => ({ ...c, dueAt: c.dueAt.toISOString() }))}
    />
  );
}

function FlashcardsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}
