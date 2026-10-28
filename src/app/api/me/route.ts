import { getApiUserId } from "@/lib/auth";

export async function GET() {
  const id = await getApiUserId();
  if (!id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ id });
}
