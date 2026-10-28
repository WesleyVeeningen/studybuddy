import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type ToolSet,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { TUTOR_MODEL } from "@/lib/ai";
import { getApiUserId, getOwnedCourse } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/server";
import { LANGUAGE_NAMES } from "@/lib/material";
import { formatSources, locationLabel, searchCourse } from "@/lib/rag";
import { buildTutorInstructions, type ChatMetadata, type ChatSource } from "@/lib/tutor";

export const maxDuration = 120;

const bodySchema = z.object({
  courseId: z.string().uuid(),
  mode: z.enum(["eli12", "example", "quiz"]).optional(),
  messages: z.array(z.custom<UIMessage<ChatMetadata>>()).min(1).max(100),
});

function textOf(message: UIMessage | undefined) {
  return (message?.parts ?? [])
    .map((p) => (p.type === "text" ? p.text : ""))
    .join(" ")
    .trim();
}

export async function POST(req: Request) {
  const userId = await getApiUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { courseId, mode, messages } = parsed.data;

  const course = await getOwnedCourse(courseId, userId);
  if (!course) return Response.json({ error: "Not found" }, { status: 404 });

  // Build a retrieval query from recent turns, so follow-ups like "give an example" still find the right material.
  const userTurns = messages.filter((m) => m.role === "user");
  const lastUser = textOf(userTurns.at(-1));
  const prevUser = textOf(userTurns.at(-2));
  const lastAssistant = textOf(messages.filter((m) => m.role === "assistant").at(-1));
  const isFollowUp = !!mode || lastUser.length < 60;
  const query = isFollowUp
    ? [lastUser, prevUser, lastAssistant.slice(0, 600)].filter(Boolean).join("\n")
    : lastUser;

  const [chunks, locale] = await Promise.all([searchCourse(course.id, query, { limit: 8 }), getLocale()]);
  const sources: ChatSource[] = chunks.map((c, i) => ({
    id: i + 1,
    fileId: c.fileId,
    fileName: c.fileName,
    location: locationLabel(c.kind, c.page),
    excerpt: c.content.slice(0, 280),
  }));

  const result = streamText({
    model: TUTOR_MODEL,
    instructions: buildTutorInstructions({
      courseName: course.name,
      sources: formatSources(chunks),
      mode,
      language: LANGUAGE_NAMES[locale],
    }),
    messages: await convertToModelMessages(messages.slice(-20)),
    maxOutputTokens: 1200,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream<ToolSet, UIMessage<ChatMetadata>>({
      stream: result.stream,
      originalMessages: messages,
      messageMetadata: ({ part }) => (part.type === "start" ? { sources, mode } : undefined),
      onError: (error) => {
        console.error("chat error", error);
        return "The tutor is unavailable right now. Please try again.";
      },
    }),
  });
}
