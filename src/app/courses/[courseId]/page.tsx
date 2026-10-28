import { Suspense } from "react";
import { FileList } from "@/components/material/file-list";
import { Uploader } from "@/components/material/uploader";
import { TopicsToReview } from "@/components/progress/topics-to-review";
import { Skeleton } from "@/components/ui/skeleton";
import { requireOwnedCourse } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getCourseFiles, getTopicStats, topicsToReview } from "@/lib/queries";

export default function MaterialPage({ params }: PageProps<"/courses/[courseId]">) {
  return (
    <Suspense fallback={<MaterialSkeleton />}>
      <Material params={params} />
    </Suspense>
  );
}

async function Material({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { userId, course } = await requireOwnedCourse(courseId);
  const [{ t }, files, stats] = await Promise.all([
    getT(),
    getCourseFiles(course.id),
    getTopicStats(course.id, userId),
  ]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-6">
        <Uploader courseId={course.id} />
        <section>
          <h2 className="mb-3 font-sans text-sm font-semibold tracking-normal text-muted-foreground uppercase">
            {t("material.files")}
          </h2>
          <FileList
            files={files.map((f) => ({
              id: f.id,
              name: f.name,
              kind: f.kind,
              status: f.status,
              error: f.error,
              pageCount: f.pageCount,
              createdAt: f.createdAt.toISOString(),
            }))}
          />
        </section>
      </div>
      <aside className="lg:pt-0">
        <TopicsToReview courseId={course.id} topics={topicsToReview(stats).slice(0, 6)} />
      </aside>
    </div>
  );
}

function MaterialSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <Skeleton className="h-40 rounded-2xl" />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
      <Skeleton className="h-56 rounded-2xl" />
    </div>
  );
}
