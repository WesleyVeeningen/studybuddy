"use server";

import { generateText, Output } from "ai";
import { and, asc, eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { TUTOR_MODEL } from "@/lib/ai";
import { getOwnedCourse, requireUserId } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { getLocale } from "@/lib/i18n/server";
import { formatMaterial, LANGUAGE_NAMES, selectMaterial } from "@/lib/material";
import { locationLabel } from "@/lib/rag";

const QUESTION_TYPES = ["multiple_choice", "open", "true_false"] as const;

const generateInput = z.object({
  courseId: z.string().uuid(),
  fileIds: z.array(z.string().uuid()).max(50).default([]),
  count: z.number().int().min(5).max(15),
  types: z.array(z.enum(QUESTION_TYPES)).min(1),
  focus: z.string().trim().max(200).optional(),
});

const quizSchema = z.object({
  title: z.string().describe("Short quiz title (max 6 words)"),
  questions: z.array(
    z.object({
      type: z.enum(QUESTION_TYPES),
      prompt: z.string().describe("The question. For true_false: a statement the student judges as true or false."),
      options: z
        .array(z.string())
        .optional()
        .describe("multiple_choice only: exactly 4 plausible options, one correct"),
      answer: z
        .string()
        .describe(
          'multiple_choice: the correct option text exactly as in options. true_false: "true" or "false". open: a concise model answer listing the key points.',
        ),
      explanation: z.string().describe("1-2 sentences explaining why, based on the material"),
      topic: z.string().describe("Broad chapter-level topic (1-3 words), shared by several questions"),
      sourceRef: z.number().int().describe("ref number of the chunk this question is based on"),
    }),
  ),
});

export type GenerateQuizResult = { ok: true; quizId: string } | { ok: false; error: "no_material" | "failed" };

export async function generateQuiz(input: z.input<typeof generateInput>): Promise<GenerateQuizResult> {
  const userId = await requireUserId();
  const data = generateInput.parse(input);
  const course = await getOwnedCourse(data.courseId, userId);
  if (!course) throw new Error("Course not found");

  const material = await selectMaterial(course.id, { fileIds: data.fileIds, focus: data.focus });
  if (material.length === 0) return { ok: false, error: "no_material" };

  const [locale, existingTopics] = await Promise.all([
    getLocale(),
    db
      .selectDistinct({ topic: schema.questions.topic })
      .from(schema.questions)
      .where(eq(schema.questions.courseId, course.id))
      .limit(60),
  ]);

  try {
    const { output } = await generateText({
      model: TUTOR_MODEL,
      output: Output.object({ schema: quizSchema }),
      instructions: `You write excellent study quizzes for students. Write everything in ${LANGUAGE_NAMES[locale]}.
Rules:
- Base every question strictly on the provided material chunks; never use outside facts.
- Test understanding, not trivia: mix recall, explanation and application questions.
- Cover different parts of the material; avoid near-duplicate questions.
- multiple_choice: exactly 4 options, one clearly correct, distractors plausible and similar in length. Vary the position of the correct option.
- true_false: a clear statement; make roughly half of them false.
- open: answerable in 1-3 sentences; the model answer lists the key points a good answer needs.
- topic: a broad, chapter-level concept (1-3 words, e.g. "Photosynthesis", "Cell respiration"), NOT a per-question detail.
  A whole quiz should use only about 2-5 distinct topics, and several questions share each topic.
  Reuse an existing topic name exactly whenever it fits. Existing topics in this course: ${
        existingTopics.map((t) => t.topic).join(", ") || "(none yet)"
      }.`,
      prompt: `Create exactly ${data.count} questions using only these question types: ${data.types.join(", ")}.${
        data.focus ? ` Focus on: ${data.focus}.` : ""
      }\n\n<material>\n${formatMaterial(material)}\n</material>`,
    });

    const byRef = new Map(material.map((m) => [m.ref, m]));
    const valid = output.questions
      .filter((q) => data.types.includes(q.type))
      .map((q) => {
        if (q.type === "true_false") {
          const a = q.answer.trim().toLowerCase();
          return { ...q, options: null, answer: a === "true" || a === "waar" || a === "juist" ? "true" : "false" };
        }
        if (q.type === "multiple_choice") {
          const options = (q.options ?? []).slice(0, 5);
          if (options.length < 2) return null;
          const answer = options.find((o) => o.trim() === q.answer.trim()) ?? options.find((o) => o.includes(q.answer.trim()));
          if (!answer) return null;
          return { ...q, options, answer };
        }
        return { ...q, options: null };
      })
      .filter((q): q is NonNullable<typeof q> => q !== null)
      .slice(0, data.count);

    if (valid.length === 0) return { ok: false, error: "failed" };

    const [quiz] = await db
      .insert(schema.quizzes)
      .values({ courseId: course.id, userId, title: output.title.slice(0, 120), fileIds: data.fileIds })
      .returning({ id: schema.quizzes.id });

    await db.insert(schema.questions).values(
      valid.map((q, i) => {
        const src = byRef.get(q.sourceRef);
        return {
          quizId: quiz.id,
          courseId: course.id,
          position: i,
          type: q.type,
          prompt: q.prompt,
          options: q.options,
          answer: q.answer,
          explanation: q.explanation,
          topic: q.topic.trim().slice(0, 60),
          sourceFileId: src?.fileId ?? null,
          sourcePage: src?.page ?? null,
        };
      }),
    );

    return { ok: true, quizId: quiz.id };
  } catch (err) {
    console.error("generateQuiz failed", err);
    return { ok: false, error: "failed" };
  }
}

const gradingSchema = z.object({
  score: z.number().min(0).max(1).describe("0 = wrong, 0.5 = partly right, 1 = fully right"),
  feedback: z
    .string()
    .describe("2-4 short sentences addressed to the student: what was good, and specifically what was missing or wrong"),
});

export type AnswerResult = {
  correct: boolean;
  score: number;
  feedback: string | null;
  answer: string;
  explanation: string | null;
  source: string | null;
  quizComplete: boolean;
};

export async function answerQuestion(input: { questionId: string; response: string }): Promise<AnswerResult> {
  const userId = await requireUserId();
  const response = input.response.trim().slice(0, 4000);
  if (!response) throw new Error("Empty answer");

  const [row] = await db
    .select({ question: schema.questions, quiz: schema.quizzes, fileName: schema.files.name, fileKind: schema.files.kind })
    .from(schema.questions)
    .innerJoin(schema.quizzes, eq(schema.quizzes.id, schema.questions.quizId))
    .leftJoin(schema.files, eq(schema.files.id, schema.questions.sourceFileId))
    .where(and(eq(schema.questions.id, input.questionId), eq(schema.quizzes.userId, userId)));
  if (!row) throw new Error("Question not found");
  const { question, quiz } = row;

  // One attempt per question per quiz; return the existing grade if they answer again.
  const previous = await db.query.attempts.findFirst({
    where: and(eq(schema.attempts.questionId, question.id), eq(schema.attempts.userId, userId)),
  });

  let score: number;
  let feedback: string | null = null;

  if (previous) {
    score = previous.score;
    feedback = previous.feedback;
  } else if (question.type === "open") {
    const locale = await getLocale();
    const sourceText = question.sourcePage && question.sourceFileId
      ? await db.query.chunks.findMany({
          where: and(eq(schema.chunks.fileId, question.sourceFileId), eq(schema.chunks.page, question.sourcePage)),
          columns: { content: true },
          orderBy: asc(schema.chunks.position),
          limit: 3,
        })
      : [];
    const { output } = await generateText({
      model: TUTOR_MODEL,
      output: Output.object({ schema: gradingSchema }),
      instructions: `You grade a student's answer to an open study question. Be fair and encouraging, but accurate.
Judge meaning, not wording; ignore spelling mistakes, and accept answers written in any language. Always write the feedback in ${LANGUAGE_NAMES[locale]}.
Only use the model answer and source material to judge; mention the specific key points the student missed.`,
      prompt: `Question: ${question.prompt}
Model answer (key points): ${question.answer}
${sourceText.length ? `Source material:\n${sourceText.map((c) => c.content).join("\n")}\n` : ""}
Student answer: ${response}`,
    });
    score = Math.round(output.score * 2) / 2;
    feedback = output.feedback;
  } else {
    const normalized = response.trim().toLowerCase();
    score = normalized === question.answer.trim().toLowerCase() ? 1 : 0;
  }

  if (!previous) {
    await db.insert(schema.attempts).values({
      questionId: question.id,
      quizId: quiz.id,
      userId,
      response,
      correct: score >= 0.75,
      score,
      feedback,
    });
  }

  // Finish the quiz once every question has an attempt.
  const [progress] = await db
    .select({
      total: sql<number>`count(distinct ${schema.questions.id})`.mapWith(Number),
      answered: sql<number>`count(distinct ${schema.attempts.questionId})`.mapWith(Number),
      points: sql<number>`coalesce(sum(${schema.attempts.score}), 0)`.mapWith(Number),
    })
    .from(schema.questions)
    .leftJoin(
      schema.attempts,
      and(eq(schema.attempts.questionId, schema.questions.id), eq(schema.attempts.userId, userId)),
    )
    .where(eq(schema.questions.quizId, quiz.id));

  const quizComplete = progress.answered >= progress.total;
  if (quizComplete && !quiz.completedAt) {
    await db
      .update(schema.quizzes)
      .set({ completedAt: new Date(), score: (progress.points / progress.total) * 100 })
      .where(eq(schema.quizzes.id, quiz.id));
  }

  return {
    correct: score >= 0.75,
    score,
    feedback,
    answer: question.answer,
    explanation: question.explanation,
    source: row.fileName && question.sourcePage ? `${row.fileName}, ${locationLabel(row.fileKind!, question.sourcePage)}` : null,
    quizComplete,
  };
}

export async function deleteQuiz(quizId: string) {
  const userId = await requireUserId();
  await db.delete(schema.quizzes).where(and(eq(schema.quizzes.id, quizId), eq(schema.quizzes.userId, userId)));
  refresh();
}
