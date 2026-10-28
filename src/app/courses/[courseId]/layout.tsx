import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { CourseActions } from "@/components/course/course-actions";
import { CourseTabs } from "@/components/course/course-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { requireOwnedCourse } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";

export default function CourseLayout({ children, params }: LayoutProps<"/courses/[courseId]">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pt-5 sm:px-6 sm:pt-8">
      <Suspense fallback={<HeaderSkeleton />}>
        <CourseHeader params={params} />
      </Suspense>
      <div className="flex flex-1 flex-col pt-6 pb-10">{children}</div>
    </div>
  );
}

async function CourseHeader({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const [{ course }, { t }] = await Promise.all([requireOwnedCourse(courseId), getT()]);

  return (
    <div className={`course-${course.color}`}>
      <Link
        href="/dashboard"
        className="-ml-1 inline-flex items-center gap-0.5 rounded-md text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> {t("course.back")}
      </Link>
      <div className="mt-2 flex items-start gap-3">
        <span className="mt-3 size-3.5 shrink-0 rounded-full bg-[var(--course)]" aria-hidden />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-3xl font-semibold sm:text-4xl">{course.name}</h1>
          {course.description && <p className="mt-1 text-muted-foreground">{course.description}</p>}
        </div>
        <CourseActions courseId={course.id} />
      </div>
      <CourseTabs courseId={course.id} />
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <div>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-10 w-64" />
      <Skeleton className="mt-6 h-10 w-full max-w-lg rounded-full" />
    </div>
  );
}
