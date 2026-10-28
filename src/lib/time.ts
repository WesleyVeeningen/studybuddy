export const TZ_COOKIE = "sb-tz";
export const DEFAULT_TIME_ZONE = "Europe/Amsterdam";
const DAY = 24 * 60 * 60 * 1000;

export function isValidTimeZone(tz: string | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Offset (ms) of `tz` from UTC at instant `t`. */
function tzOffset(t: number, tz: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(t))
      .map((p) => [p.type, Number(p.value)]),
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(t / 1000) * 1000;
}

/** Midnight at the start of the local day (in `tz`) that is `addDays` days after `date`'s local day. */
export function startOfLocalDay(date: Date, tz: string, addDays = 0): Date {
  const t = date.getTime();
  const local = new Date(t + tzOffset(t, tz));
  const midnightAsUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + addDays);
  // Correct for DST changes between now and the target day.
  const guess = midnightAsUtc - tzOffset(midnightAsUtc, tz);
  return new Date(midnightAsUtc - tzOffset(guess, tz));
}

export function endOfLocalToday(tz: string, now = new Date()) {
  return startOfLocalDay(now, tz, 1);
}

export { DAY };
