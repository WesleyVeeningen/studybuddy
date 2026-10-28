import type { Metadata } from "next";
import { Suspense } from "react";
import { TutorChat } from "@/components/chat/tutor-chat";
import { Skeleton } from "@/components/ui/skeleton";
import { requireOwnedCourse } from "@/lib/auth";
import { getReadyFiles } from "@/lib/queries";

export const metadata: Metadata = { title: "Chat" };

export default function ChatPage({ params }: PageProps<"/courses/[courseId]/chat">) {
  return (
    <Suspense fallback={<Skeleton className="h-[60vh] rounded-2xl" />}>
      <Chat params={params} />
    </Suspense>
  );
}

async function Chat({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { course } = await requireOwnedCourse(courseId);
  const files = await getReadyFiles(course.id);
  return <TutorChat courseId={course.id} hasMaterial={files.length > 0} />;
}
