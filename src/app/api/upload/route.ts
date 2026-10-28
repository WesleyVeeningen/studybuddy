import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getApiUserId, getOwnedCourse } from "@/lib/auth";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

// Issues short-lived tokens so the browser can upload straight to the private Blob store
// (bypasses the 4.5 MB function body limit).
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const userId = await getApiUserId();
        if (!userId) throw new Error("Not signed in");

        const { courseId } = JSON.parse(clientPayload ?? "{}") as { courseId?: string };
        if (!courseId || !(await getOwnedCourse(courseId, userId))) throw new Error("Unknown course");
        if (!pathname.startsWith(`${userId}/${courseId}/`)) throw new Error("Invalid upload path");

        return {
          allowedContentTypes: [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "image/png",
            "image/jpeg",
            "image/webp",
            "image/gif",
            "text/plain",
            "text/markdown",
          ],
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(json);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
