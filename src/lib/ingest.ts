import "server-only";
import { get } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { extractImage, extractPdf, extractPlainText, extractPptx, type ExtractedPage } from "@/lib/extract";
import { chunkPages, embedTexts } from "@/lib/rag";

const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export function kindFromName(name: string): (typeof schema.fileKind.enumValues)[number] | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "pptx") return "pptx";
  if (ext in IMAGE_TYPES) return "image";
  if (ext === "txt" || ext === "md") return "text";
  return null;
}

async function readBlob(pathname: string): Promise<Uint8Array> {
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) throw new Error("Could not read the uploaded file.");
  return new Uint8Array(await new Response(result.stream).arrayBuffer());
}

/**
 * Extracts text from a file, chunks it, embeds the chunks and stores them.
 * Marks the file as ready or error. Safe to run in `after()`.
 */
export async function processFile(fileId: string, pastedText?: string) {
  const file = await db.query.files.findFirst({ where: eq(schema.files.id, fileId) });
  if (!file) return;

  try {
    let pages: ExtractedPage[];
    if (file.kind === "text" && pastedText !== undefined) {
      pages = extractPlainText(pastedText);
    } else {
      if (!file.blobPathname) throw new Error("File has no stored content.");
      const data = await readBlob(file.blobPathname);
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (file.kind === "pdf") pages = await extractPdf(data);
      else if (file.kind === "pptx") pages = await extractPptx(data);
      else if (file.kind === "image") pages = await extractImage(data, IMAGE_TYPES[ext] ?? "image/png");
      else pages = extractPlainText(new TextDecoder().decode(data));
    }

    const drafts = chunkPages(pages);
    if (drafts.length === 0) {
      throw new Error("We couldn't find any readable text in this file.");
    }

    const embeddings = await embedTexts(
      drafts.map((d) => (d.heading ? `${file.name} — ${d.heading}\n${d.content}` : `${file.name}\n${d.content}`)),
    );

    await db.delete(schema.chunks).where(eq(schema.chunks.fileId, file.id));
    for (let i = 0; i < drafts.length; i += 200) {
      await db.insert(schema.chunks).values(
        drafts.slice(i, i + 200).map((d, j) => ({
          fileId: file.id,
          courseId: file.courseId,
          page: d.page,
          position: i + j,
          heading: d.heading,
          content: d.content,
          embedding: embeddings[i + j],
        })),
      );
    }

    await db
      .update(schema.files)
      .set({
        status: "ready",
        error: null,
        pageCount: Math.max(...pages.map((p) => p.page)),
        chunkCount: drafts.length,
      })
      .where(eq(schema.files.id, file.id));
  } catch (err) {
    console.error("processFile failed", fileId, err);
    await db
      .update(schema.files)
      .set({ status: "error", error: err instanceof Error ? err.message.slice(0, 300) : "Processing failed." })
      .where(eq(schema.files.id, file.id));
  }
}
