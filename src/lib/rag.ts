import "server-only";
import { embed, embedMany } from "ai";
import { and, cosineDistance, desc, eq, inArray, sql } from "drizzle-orm";
import { EMBEDDING_MODEL } from "@/lib/ai";
import { db, schema } from "@/lib/db";
import type { ExtractedPage } from "@/lib/extract";

const TARGET_CHARS = 1200;
const OVERLAP_CHARS = 200;

export type ChunkDraft = { page: number; heading: string | null; content: string };

/** Splits each page into ~1200 char chunks on paragraph/sentence boundaries, with a small overlap. */
export function chunkPages(pages: ExtractedPage[]): ChunkDraft[] {
  const out: ChunkDraft[] = [];
  for (const page of pages) {
    const units = page.text
      .split(/\n{2,}/)
      .flatMap((para) => (para.length > TARGET_CHARS ? para.split(/(?<=[.!?])\s+/) : [para]));

    let current = "";
    for (const unit of units) {
      if (current && current.length + unit.length > TARGET_CHARS) {
        out.push({ page: page.page, heading: page.heading ?? null, content: current.trim() });
        current = current.slice(-OVERLAP_CHARS).replace(/^\S*\s/, "");
      }
      current += (current ? "\n\n" : "") + unit;
    }
    if (current.trim().length > 20 || (current.trim() && out.at(-1)?.page !== page.page)) {
      out.push({ page: page.page, heading: page.heading ?? null, content: current.trim() });
    }
  }
  return out;
}

export async function embedTexts(values: string[]): Promise<number[][]> {
  const result: number[][] = [];
  // Keep batches modest so one request never gets too large.
  for (let i = 0; i < values.length; i += 96) {
    const { embeddings } = await embedMany({ model: EMBEDDING_MODEL, values: values.slice(i, i + 96) });
    result.push(...embeddings);
  }
  return result;
}

export type RetrievedChunk = {
  id: string;
  fileId: string;
  fileName: string;
  page: number;
  kind: (typeof schema.fileKind.enumValues)[number];
  content: string;
  similarity: number;
};

/** Semantic search over a course's chunks, optionally restricted to certain files. */
export async function searchCourse(
  courseId: string,
  query: string,
  { limit = 8, fileIds, minSimilarity = 0.2 }: { limit?: number; fileIds?: string[]; minSimilarity?: number } = {},
): Promise<RetrievedChunk[]> {
  const { embedding } = await embed({ model: EMBEDDING_MODEL, value: query });
  const similarity = sql<number>`1 - (${cosineDistance(schema.chunks.embedding, embedding)})`;

  const rows = await db
    .select({
      id: schema.chunks.id,
      fileId: schema.chunks.fileId,
      fileName: schema.files.name,
      kind: schema.files.kind,
      page: schema.chunks.page,
      content: schema.chunks.content,
      similarity,
    })
    .from(schema.chunks)
    .innerJoin(schema.files, eq(schema.files.id, schema.chunks.fileId))
    .where(
      and(
        eq(schema.chunks.courseId, courseId),
        fileIds?.length ? inArray(schema.chunks.fileId, fileIds) : undefined,
      ),
    )
    .orderBy(desc(similarity))
    .limit(limit);

  return rows.filter((r) => r.similarity >= minSimilarity);
}

/** Human-readable location label: "p. 4" for PDFs/text, "slide 4" for decks. */
export function locationLabel(kind: RetrievedChunk["kind"], page: number) {
  if (kind === "pptx") return `slide ${page}`;
  if (kind === "image") return "image";
  if (kind === "text") return `section ${page}`;
  return `p. ${page}`;
}

/** Formats retrieved chunks as numbered sources for a prompt. */
export function formatSources(chunks: RetrievedChunk[]): string {
  return chunks
    .map(
      (c, i) =>
        `<source id="${i + 1}" file="${c.fileName}" location="${locationLabel(c.kind, c.page)}">\n${c.content}\n</source>`,
    )
    .join("\n\n");
}
