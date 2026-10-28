import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_TIME_ZONE, endOfLocalToday, isValidTimeZone, TZ_COOKIE } from "@/lib/time";

export async function getTimeZone() {
  const tz = (await cookies()).get(TZ_COOKIE)?.value;
  return isValidTimeZone(tz) ? tz : DEFAULT_TIME_ZONE;
}

/** Cards due before the end of the student's local "today" count as due today. */
export async function getDueCutoff() {
  return endOfLocalToday(await getTimeZone());
}
