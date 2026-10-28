import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { db, schema } from "@/lib/db";

/** Returns the signed-in user's id, creating their row on first visit. Redirects to sign-in otherwise. */
export const requireUserId = cache(async (): Promise<string> => {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const existing = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (!existing) {
    const user = await currentUser();
    await db
      .insert(schema.users)
      .values({
        id: userId,
        email: user?.primaryEmailAddress?.emailAddress ?? null,
        name: user?.firstName ?? user?.username ?? null,
      })
      .onConflictDoNothing();
  }
  return userId;
});

/** For route handlers: returns the user id or null instead of redirecting. */
export async function getApiUserId(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;
  await db.insert(schema.users).values({ id: userId }).onConflictDoNothing();
  return userId;
}

export async function getOwnedCourse(courseId: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(courseId)) return null;
  const course = await db.query.courses.findFirst({
    where: and(eq(schema.courses.id, courseId), eq(schema.courses.userId, userId)),
  });
  return course ?? null;
}

export async function requireOwnedCourse(courseId: string) {
  const userId = await requireUserId();
  const course = await getOwnedCourse(courseId, userId);
  if (!course) notFound();
  return { userId, course };
}
