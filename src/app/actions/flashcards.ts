"use server";

import { generateText, Output } from "ai";
import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { TUTOR_MODEL } from "@/lib/ai";
import { getOwnedCourse, requireUserId } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { getLocale } from "@/lib/i18n/server";
import { formatMaterial, LANGUAGE_NAMES, selectMaterial } from "@/lib/material";
import { GRADES, sm2, type GradeName } from "@/lib/sm2";
import { getTimeZone } from "@/lib/time-server";

const generateInput = z.object({
  courseId: z.string().uuid(),
  fileIds: z.array(z.string().uuid()).max(50).default([]),
  count: z.number().int().min(5).max(40),
});

const cardsSchema = z.object({
  cards: z.array(
    z.object({
      front: z.string().describe("A focused question or term (max ~15 words)"),
      back: z.string().describe("A short, complete answer (max ~40 words)"),
      topic: z.string().describe("Broad chapter-level topic (1-3 words), shared by several cards"),
      sourceRef: z.number().int().describe("ref of the chunk this card is based on"),
    }),
  ),
});

export async function generateFlashcards(
  input: z.input<typeof generateInput>,
): Promise<{ ok: true; created: number } | { ok: false; error: "no_material" | "failed" }> {
  const userId = await requireUserId();
  const data = generateInput.parse(input);
  const course = await getOwnedCourse(data.courseId, userId);
  if (!course) throw new Error("Course not found");

  const material = await selectMaterial(course.id, { fileIds: data.fileIds, maxChars: 45_000 });
  if (material.length === 0) return { ok: false, error: "no_material" };

  const [locale, existing] = await Promise.all([
    getLocale(),
    db.query.flashcards.findMany({
      where: eq(schema.flashcards.courseId, course.id),
      columns: { front: true },
      limit: 200,
    }),
  ]);

  try {
    const { output } = await generateText({
      model: TUTOR_MODEL,
      output: Output.object({ schema: cardsSchema }),
      instructions: `You create high-quality spaced-repetition flashcards for a student. Write in ${LANGUAGE_NAMES[locale]}.
Rules:
- Only use facts from the provided material.
- One idea per card (atomic). Prefer "why/how" and definitions of key terms over trivia.
- Front: a clear question or term. Back: short and complete, so the card makes sense on its own.
- Spread cards across the material. Don't duplicate existing cards.`,
      prompt: `Create ${data.count} flashcards.
Existing card fronts (avoid duplicates): ${existing.map((c) => c.front).join(" | ") || "(none)"}

<material>
${formatMaterial(material)}
</material>`,
    });

    const byRef = new Map(material.map((m) => [m.ref, m]));
    const cards = output.cards.slice(0, data.count).filter((c) => c.front.trim() && c.back.trim());
    if (cards.length === 0) return { ok: false, error: "failed" };

    await db.insert(schema.flashcards).values(
      cards.map((c) => {
        const src = byRef.get(c.sourceRef);
        return {
          courseId: course.id,
          userId,
          fileId: src?.fileId ?? null,
          sourcePage: src?.page ?? null,
          front: c.front.trim(),
          back: c.back.trim(),
          topic: c.topic.trim().slice(0, 60),
        };
      }),
    );
    refresh();
    return { ok: true, created: cards.length };
  } catch (err) {
    console.error("generateFlashcards failed", err);
    return { ok: false, error: "failed" };
  }
}

export async function reviewFlashcard(input: { cardId: string; grade: GradeName }) {
  const userId = await requireUserId();
  const quality = GRADES[input.grade];
  if (quality === undefined) throw new Error("Invalid grade");

  const card = await db.query.flashcards.findFirst({
    where: and(eq(schema.flashcards.id, input.cardId), eq(schema.flashcards.userId, userId)),
  });
  if (!card) throw new Error("Card not found");

  const next = sm2(card, quality, { timeZone: await getTimeZone() });
  await db
    .update(schema.flashcards)
    .set({ easeFactor: next.easeFactor, interval: next.interval, repetitions: next.repetitions, dueAt: next.dueAt })
    .where(eq(schema.flashcards.id, card.id));
  await db.insert(schema.reviews).values({ flashcardId: card.id, userId, grade: quality, intervalAfter: next.interval });

  return { dueAt: next.dueAt.toISOString(), interval: next.interval };
}

export async function deleteFlashcard(cardId: string) {
  const userId = await requireUserId();
  await db.delete(schema.flashcards).where(and(eq(schema.flashcards.id, cardId), eq(schema.flashcards.userId, userId)));
  refresh();
}
