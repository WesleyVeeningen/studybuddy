"use server";

import { del, put } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { getOwnedCourse, requireUserId } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { kindFromName, processFile } from "@/lib/ingest";

const courseInput = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).optional(),
  color: z.enum(["sage", "sky", "lavender", "peach", "rose", "sand"]).default("sage"),
});

export async function createCourse(input: z.input<typeof courseInput>) {
  const userId = await requireUserId();
  const data = courseInput.parse(input);
  const [course] = await db
    .insert(schema.courses)
    .values({ userId, name: data.name, description: data.description || null, color: data.color })
    .returning({ id: schema.courses.id });
  redirect(`/courses/${course.id}`);
}

export async function deleteCourse(courseId: string) {
  const userId = await requireUserId();
  const course = await getOwnedCourse(courseId, userId);
  if (!course) return;
  const courseFiles = await db.query.files.findMany({ where: eq(schema.files.courseId, courseId) });
  const pathnames = courseFiles.map((f) => f.blobPathname).filter((p): p is string => !!p);
  await db.delete(schema.courses).where(eq(schema.courses.id, courseId));
  if (pathnames.length) after(() => del(pathnames).catch(() => {}));
  redirect("/dashboard");
}

/** Called by the browser after a direct-to-Blob upload finished. */
export async function registerUpload(input: { courseId: string; pathname: string; name: string; size: number }) {
  const userId = await requireUserId();
  const course = await getOwnedCourse(input.courseId, userId);
  if (!course) throw new Error("Course not found");
  if (!input.pathname.startsWith(`${userId}/${course.id}/`)) throw new Error("Invalid upload");

  const kind = kindFromName(input.name);
  if (!kind) throw new Error("Unsupported file type");

  const [file] = await db
    .insert(schema.files)
    .values({
      courseId: course.id,
      userId,
      name: input.name.slice(0, 200),
      kind,
      blobPathname: input.pathname,
      size: input.size,
    })
    .returning({ id: schema.files.id });

  after(() => processFile(file.id));
  refresh();
  return { id: file.id };
}

export async function addPastedText(input: { courseId: string; title: string; text: string }) {
  const userId = await requireUserId();
  const course = await getOwnedCourse(input.courseId, userId);
  if (!course) throw new Error("Course not found");
  const text = input.text.trim();
  if (text.length < 20) throw new Error("Please paste a bit more text.");
  if (text.length > 400_000) throw new Error("That's a lot of text. Please split it into smaller parts.");

  const title = (input.title.trim() || "Pasted notes").slice(0, 120);
  const blob = await put(`${userId}/${course.id}/${title.replace(/[^\w\- ]+/g, "")}.txt`, text, {
    access: "private",
    addRandomSuffix: true,
    contentType: "text/plain",
  });

  const [file] = await db
    .insert(schema.files)
    .values({ courseId: course.id, userId, name: title, kind: "text", blobPathname: blob.pathname, size: text.length })
    .returning({ id: schema.files.id });

  after(() => processFile(file.id, text));
  refresh();
  return { id: file.id };
}

export async function deleteFile(fileId: string) {
  const userId = await requireUserId();
  const file = await db.query.files.findFirst({
    where: and(eq(schema.files.id, fileId), eq(schema.files.userId, userId)),
  });
  if (!file) return;
  await db.delete(schema.files).where(eq(schema.files.id, fileId));
  if (file.blobPathname) after(() => del(file.blobPathname!).catch(() => {}));
  refresh();
}

export async function retryFile(fileId: string) {
  const userId = await requireUserId();
  const file = await db.query.files.findFirst({
    where: and(eq(schema.files.id, fileId), eq(schema.files.userId, userId)),
  });
  if (!file) return;
  await db.update(schema.files).set({ status: "processing", error: null }).where(eq(schema.files.id, fileId));
  after(() => processFile(fileId));
  refresh();
}
