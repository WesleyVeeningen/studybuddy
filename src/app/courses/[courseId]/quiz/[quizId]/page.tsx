import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { QuizPlayer, type PlayerQuestion } from "@/components/quiz/quiz-player";
import { Skeleton } from "@/components/ui/skeleton";
import { requireOwnedCourse } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { locationLabel } from "@/lib/rag";

export default function QuizRunPage({ params }: PageProps<"/courses/[courseId]/quiz/[quizId]">) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-2xl rounded-2xl" />}>
      <QuizRun params={params} />
    </Suspense>
  );
}

async function QuizRun({ params }: { params: Promise<{ courseId: string; quizId: string }> }) {
  const { courseId, quizId } = await params;
  const { userId, course } = await requireOwnedCourse(courseId);
  if (!/^[0-9a-f-]{36}$/i.test(quizId)) notFound();

  const quiz = await db.query.quizzes.findFirst({
    where: and(eq(schema.quizzes.id, quizId), eq(schema.quizzes.courseId, course.id), eq(schema.quizzes.userId, userId)),
  });
  if (!quiz) notFound();

  const rows = await db
    .select({ q: schema.questions, a: schema.attempts, fileName: schema.files.name, fileKind: schema.files.kind })
    .from(schema.questions)
    .leftJoin(
      schema.attempts,
      and(eq(schema.attempts.questionId, schema.questions.id), eq(schema.attempts.userId, userId)),
    )
    .leftJoin(schema.files, eq(schema.files.id, schema.questions.sourceFileId))
    .where(eq(schema.questions.quizId, quiz.id))
    .orderBy(asc(schema.questions.position));

  // Answers are only sent to the browser for questions that were already answered.
  const questions: PlayerQuestion[] = rows.map(({ q, a, fileName, fileKind }) => ({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    options: q.options,
    topic: q.topic,
    result: a
      ? {
          response: a.response,
          correct: a.correct,
          score: a.score,
          feedback: a.feedback,
          answer: q.answer,
          explanation: q.explanation,
          source: fileName && q.sourcePage ? `${fileName}, ${locationLabel(fileKind!, q.sourcePage)}` : null,
        }
      : null,
  }));

  return <QuizPlayer courseId={course.id} title={quiz.title} questions={questions} />;
}
