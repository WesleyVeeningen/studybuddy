import "server-only";
import { generateText, Output } from "ai";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { extractText, getDocumentProxy } from "unpdf";
import { z } from "zod";
import { TUTOR_MODEL } from "@/lib/ai";

/** One logical page of source material: a PDF page, a slide, or a section of text. */
export type ExtractedPage = { page: number; heading?: string; text: string };

const MIN_CHARS_PER_PAGE = 40;

export async function extractPdf(data: Uint8Array): Promise<ExtractedPage[]> {
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = text.map((t, i) => ({ page: i + 1, text: normalize(t) }));

  // Scanned PDFs have (almost) no text layer: let Claude read the pages instead.
  const textual = pages.filter((p) => p.text.length >= MIN_CHARS_PER_PAGE).length;
  if (pages.length > 0 && textual / pages.length < 0.3) {
    return transcribeDocument(data, "application/pdf");
  }
  return pages.filter((p) => p.text.length > 0);
}

export async function extractPptx(data: Uint8Array): Promise<ExtractedPage[]> {
  const zip = await JSZip.loadAsync(data);
  const parser = new XMLParser({ ignoreAttributes: true, textNodeName: "#text" });

  const slideFiles = Object.keys(zip.files)
    .map((name) => ({ name, match: name.match(/^ppt\/slides\/slide(\d+)\.xml$/) }))
    .filter((f) => f.match)
    .map((f) => ({ name: f.name, n: Number(f.match![1]) }))
    .sort((a, b) => a.n - b.n);

  const pages: ExtractedPage[] = [];
  for (const { name, n } of slideFiles) {
    const xml = await zip.file(name)!.async("string");
    const paragraphs = collectParagraphs(parser.parse(xml));
    const notesXml = await zip.file(`ppt/notesSlides/notesSlide${n}.xml`)?.async("string");
    const notes = notesXml
      ? collectParagraphs(parser.parse(notesXml)).filter((p) => !/^\d+$/.test(p))
      : [];

    const body = [...paragraphs, ...(notes.length ? ["", "Speaker notes:", ...notes] : [])].join("\n");
    const text = normalize(body);
    if (text) pages.push({ page: n, heading: paragraphs[0]?.slice(0, 120), text });
  }
  return pages;
}

export async function extractImage(data: Uint8Array, mediaType: string): Promise<ExtractedPage[]> {
  return transcribeDocument(data, mediaType);
}

export function extractPlainText(text: string): ExtractedPage[] {
  // Split pasted text into ~sections on blank-line-separated headings, roughly 3000 chars each.
  const paragraphs = normalize(text).split(/\n{2,}/);
  const pages: ExtractedPage[] = [];
  let current = "";
  for (const para of paragraphs) {
    if (current.length + para.length > 3000 && current) {
      pages.push({ page: pages.length + 1, text: current.trim() });
      current = "";
    }
    current += para + "\n\n";
  }
  if (current.trim()) pages.push({ page: pages.length + 1, text: current.trim() });
  return pages;
}

const transcriptionSchema = z.object({
  pages: z.array(
    z.object({
      page: z.number().int().describe("1-based page number in the document (always 1 for a single image)"),
      heading: z.string().optional().describe("Title or main heading on this page, if any"),
      text: z.string().describe("Faithful transcription of all text on this page, in the original language"),
    }),
  ),
});

/** Uses Claude's vision to transcribe handwritten notes, photos, or scanned PDFs. */
async function transcribeDocument(data: Uint8Array, mediaType: string): Promise<ExtractedPage[]> {
  const { output } = await generateText({
    model: TUTOR_MODEL,
    output: Output.object({ schema: transcriptionSchema }),
    instructions:
      "You transcribe study material for a student. Transcribe all readable text faithfully in its original language " +
      "(do not translate or summarize). Describe diagrams, formulas and tables briefly in text so they are searchable. " +
      "Keep the page structure of the document.",
    messages: [
      {
        role: "user",
        content: [
          { type: "file", data, mediaType },
          { type: "text", text: "Transcribe this study material page by page." },
        ],
      },
    ],
  });
  return output.pages
    .map((p) => ({ page: p.page, heading: p.heading, text: normalize(p.text) }))
    .filter((p) => p.text.length > 0);
}

function collectParagraphs(node: unknown): string[] {
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== "object") return;
    for (const [key, value] of Object.entries(n)) {
      if (key === "a:p") {
        const paras = Array.isArray(value) ? value : [value];
        for (const p of paras) {
          const text = collectRuns(p).join("").trim();
          if (text) out.push(text);
        }
      } else {
        walk(value);
      }
    }
  };
  walk(node);
  return out;
}

function collectRuns(node: unknown): string[] {
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== "object") return;
    for (const [key, value] of Object.entries(n)) {
      if (key === "a:t") {
        const vals = Array.isArray(value) ? value : [value];
        for (const v of vals) {
          if (typeof v === "string" || typeof v === "number") out.push(String(v));
          else if (v && typeof v === "object" && "#text" in v) out.push(String((v as Record<string, unknown>)["#text"]));
        }
      } else {
        walk(value);
      }
    }
  };
  walk(node);
  return out;
}

function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
