import "server-only";
import { and, asc, count, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getDueCutoff } from "@/lib/time-server";

export type TopicStat = {
  topic: string;
  attempts: number;
  correct: number;
  accuracy: number;
  lastAttemptAt: Date;
};

/**
 * Per-topic accuracy for a course, weakest first. Recent attempts weigh more because only the
 * latest 10 attempts per topic are counted.
 */
export async function getTopicStats(courseId: string, userId: string): Promise<TopicStat[]> {
  const rows = await db.execute<{
    topic: string;
    attempts: number;
    correct: number;
    last_attempt_at: string;
  }>(sql`
    with ranked as (
      select q.topic, a.score, a.created_at,
             row_number() over (partition by q.topic order by a.created_at desc) as rn
      from ${schema.attempts} a
      join ${schema.questions} q on q.id = a.question_id
      where q.course_id = ${courseId} and a.user_id = ${userId}
    )
    select topic,
           count(*)::int as attempts,
           sum(score)::float as correct,
           max(created_at) as last_attempt_at
    from ranked
    where rn <= 10
    group by topic
  `);

  return rows.rows
    .map((r) => ({
      topic: r.topic,
      attempts: Number(r.attempts),
      correct: Math.round(Number(r.correct) * 10) / 10,
      accuracy: Number(r.correct) / Number(r.attempts),
      lastAttemptAt: new Date(r.last_attempt_at),
    }))
    .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts);
}

/** Topics to review: anything under 80% accuracy, weakest first. */
export function topicsToReview(stats: TopicStat[]) {
  return stats.filter((s) => s.accuracy < 0.8);
}

export async function getDashboard(userId: string) {
  const courses = await db.query.courses.findMany({
    where: eq(schema.courses.userId, userId),
    orderBy: desc(schema.courses.createdAt),
  });
  if (courses.length === 0) return { courses: [], totalDue: 0 };

  const tomorrow = await getDueCutoff();
  const [dueRows, fileRows, quizRows] = await Promise.all([
    db
      .select({ courseId: schema.flashcards.courseId, n: count() })
      .from(schema.flashcards)
      .where(and(eq(schema.flashcards.userId, userId), lte(schema.flashcards.dueAt, tomorrow)))
      .groupBy(schema.flashcards.courseId),
    db
      .select({ courseId: schema.files.courseId, n: count() })
      .from(schema.files)
      .where(eq(schema.files.userId, userId))
      .groupBy(schema.files.courseId),
    db
      .selectDistinctOn([schema.quizzes.courseId], {
        courseId: schema.quizzes.courseId,
        score: schema.quizzes.score,
      })
      .from(schema.quizzes)
      .where(and(eq(schema.quizzes.userId, userId), isNotNull(schema.quizzes.completedAt)))
      .orderBy(schema.quizzes.courseId, desc(schema.quizzes.completedAt)),
  ]);

  const weakest = await Promise.all(
    courses.map(async (c) => topicsToReview(await getTopicStats(c.id, userId))[0] ?? null),
  );

  const due = new Map(dueRows.map((r) => [r.courseId, r.n]));
  const fileCounts = new Map(fileRows.map((r) => [r.courseId, r.n]));
  const lastScores = new Map(quizRows.map((r) => [r.courseId, r.score]));

  const cards = courses.map((c, i) => ({
    ...c,
    dueToday: due.get(c.id) ?? 0,
    fileCount: fileCounts.get(c.id) ?? 0,
    lastQuizScore: lastScores.get(c.id) ?? null,
    weakestTopic: weakest[i],
  }));
  return { courses: cards, totalDue: cards.reduce((s, c) => s + c.dueToday, 0) };
}

export async function getCourseFiles(courseId: string) {
  return db.query.files.findMany({
    where: eq(schema.files.courseId, courseId),
    orderBy: desc(schema.files.createdAt),
  });
}

export async function getReadyFiles(courseId: string) {
  return db.query.files.findMany({
    where: and(eq(schema.files.courseId, courseId), eq(schema.files.status, "ready")),
    orderBy: asc(schema.files.name),
    columns: { id: true, name: true, kind: true, pageCount: true },
  });
}

export async function getFlashcardStats(courseId: string, userId: string) {
  const tomorrow = await getDueCutoff();
  const [row] = await db
    .select({
      total: count(),
      due: sql<number>`count(*) filter (where ${schema.flashcards.dueAt} <= ${tomorrow})`.mapWith(Number),
      mastered: sql<number>`count(*) filter (where ${schema.flashcards.interval} >= 21)`.mapWith(Number),
    })
    .from(schema.flashcards)
    .where(and(eq(schema.flashcards.courseId, courseId), eq(schema.flashcards.userId, userId)));
  return row ?? { total: 0, due: 0, mastered: 0 };
}

export async function getReviewsThisWeek(courseId: string, userId: string) {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const [row] = await db
    .select({ n: count() })
    .from(schema.reviews)
    .innerJoin(schema.flashcards, eq(schema.flashcards.id, schema.reviews.flashcardId))
    .where(
      and(
        eq(schema.flashcards.courseId, courseId),
        eq(schema.reviews.userId, userId),
        gte(schema.reviews.reviewedAt, since),
      ),
    );
  return row?.n ?? 0;
}

export async function getQuizHistory(courseId: string, userId: string) {
  return db
    .select({
      id: schema.quizzes.id,
      title: schema.quizzes.title,
      score: schema.quizzes.score,
      completedAt: schema.quizzes.completedAt,
      createdAt: schema.quizzes.createdAt,
      questionCount: sql<number>`(select count(*) from ${schema.questions} where ${schema.questions.quizId} = ${schema.quizzes.id})`.mapWith(Number),
    })
    .from(schema.quizzes)
    .where(and(eq(schema.quizzes.courseId, courseId), eq(schema.quizzes.userId, userId)))
    .orderBy(desc(schema.quizzes.createdAt))
    .limit(30);
}
