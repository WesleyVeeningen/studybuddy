import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { locationLabel, searchCourse, type RetrievedChunk } from "@/lib/rag";

export type NumberedChunk = RetrievedChunk & { ref: number };

/**
 * Picks material for quiz/flashcard generation: either chunks relevant to a focus topic, or an even
 * spread across the selected files, capped at roughly `maxChars` characters.
 */
export async function selectMaterial(
  courseId: string,
  { fileIds, focus, maxChars = 40_000 }: { fileIds?: string[]; focus?: string; maxChars?: number },
): Promise<NumberedChunk[]> {
  let picked: RetrievedChunk[];

  if (focus?.trim()) {
    picked = await searchCourse(courseId, focus, { limit: 24, fileIds, minSimilarity: 0.15 });
  } else {
    const rows = await db
      .select({
        id: schema.chunks.id,
        fileId: schema.chunks.fileId,
        fileName: schema.files.name,
        kind: schema.files.kind,
        page: schema.chunks.page,
        content: schema.chunks.content,
      })
      .from(schema.chunks)
      .innerJoin(schema.files, eq(schema.files.id, schema.chunks.fileId))
      .where(
        and(
          eq(schema.chunks.courseId, courseId),
          fileIds?.length ? inArray(schema.chunks.fileId, fileIds) : undefined,
        ),
      )
      .orderBy(asc(schema.files.name), asc(schema.chunks.position));

    const total = rows.reduce((s, r) => s + r.content.length, 0);
    const step = Math.max(1, Math.ceil(total / maxChars));
    picked = rows.filter((_, i) => i % step === 0).map((r) => ({ ...r, similarity: 1 }));
  }

  const out: NumberedChunk[] = [];
  let chars = 0;
  for (const c of picked) {
    if (chars + c.content.length > maxChars) break;
    chars += c.content.length;
    out.push({ ...c, ref: out.length + 1 });
  }
  return out;
}

export function formatMaterial(chunks: NumberedChunk[]) {
  return chunks
    .map((c) => `<chunk ref="${c.ref}" file="${c.fileName}" location="${locationLabel(c.kind, c.page)}">\n${c.content}\n</chunk>`)
    .join("\n\n");
}

export const LANGUAGE_NAMES = { en: "English", nl: "Dutch (Nederlands)" } as const;
