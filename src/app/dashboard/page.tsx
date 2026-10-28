import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { currentUser } from "@clerk/nextjs/server";
import { BookOpen, FileText, Layers, Target } from "lucide-react";
import { NewCourseDialog } from "@/components/new-course-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserId } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getDashboard } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
    </div>
  );
}

async function Dashboard() {
  const userId = await requireUserId();
  const [{ t }, user, data] = await Promise.all([getT(), currentUser(), getDashboard(userId)]);

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold sm:text-4xl">
            {user?.firstName ? t("dashboard.greeting", { name: user.firstName }) : t("dashboard.greetingAnon")}
          </h1>
          <p className="mt-1.5 text-muted-foreground">
            {data.totalDue > 0
              ? t("dashboard.dueSummary", { count: data.totalDue })
              : t("dashboard.dueSummaryNone")}
          </p>
        </div>
        {data.courses.length > 0 && <NewCourseDialog />}
      </div>

      {data.courses.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed px-6 py-16 text-center">
          <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-secondary text-secondary-foreground">
            <BookOpen className="size-7" />
          </div>
          <h2 className="text-xl font-semibold">{t("dashboard.empty.title")}</h2>
          <p className="mt-1.5 mb-6 max-w-sm text-muted-foreground">{t("dashboard.empty.body")}</p>
          <NewCourseDialog />
        </div>
      ) : (
        <>
          <h2 className="sr-only">{t("dashboard.courses")}</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.courses.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/courses/${c.id}`}
                  className={cn(
                    `course-${c.color}`,
                    "group flex h-full flex-col rounded-2xl border bg-card p-5 transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  )}
                >
                  <div className="mb-4 flex items-start gap-3">
                    <span className="mt-1.5 size-3 shrink-0 rounded-full bg-[var(--course)]" aria-hidden />
                    <div className="min-w-0">
                      <h3 className="truncate text-xl font-semibold">{c.name}</h3>
                      <p className="flex items-center gap-1 text-sm text-muted-foreground">
                        <FileText className="size-3.5" />
                        {t("dashboard.files", { count: c.fileCount })}
                        {c.description && <span className="truncate"> · {c.description}</span>}
                      </p>
                    </div>
                  </div>
                  <dl className="mt-auto grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl bg-[var(--course-soft)] p-3">
                      <dt className="flex items-center gap-1 text-muted-foreground">
                        <Layers className="size-3.5" /> {t("dashboard.dueToday")}
                      </dt>
                      <dd className="mt-0.5 font-heading text-2xl font-semibold">{c.dueToday}</dd>
                    </div>
                    <div className="rounded-xl bg-[var(--course-soft)] p-3">
                      <dt className="text-muted-foreground">{t("dashboard.lastQuiz")}</dt>
                      <dd className="mt-0.5 font-heading text-2xl font-semibold">
                        {c.lastQuizScore == null ? (
                          <span className="text-base font-normal text-muted-foreground">{t("dashboard.noQuiz")}</span>
                        ) : (
                          `${Math.round(c.lastQuizScore)}%`
                        )}
                      </dd>
                    </div>
                    {c.weakestTopic && (
                      <div className="col-span-2 flex items-center gap-2 rounded-xl border border-dashed px-3 py-2">
                        <Target className="size-4 shrink-0 text-warning" />
                        <dt className="text-muted-foreground">{t("dashboard.weakest")}:</dt>
                        <dd className="truncate font-medium">{c.weakestTopic.topic}</dd>
                      </div>
                    )}
                  </dl>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <Skeleton className="h-10 w-56" />
      <Skeleton className="mt-3 mb-8 h-5 w-72" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-48 rounded-2xl" />
        ))}
      </div>
    </>
  );
}
