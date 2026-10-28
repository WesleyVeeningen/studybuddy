import { DEFAULT_TIME_ZONE, startOfLocalDay } from "@/lib/time";

export type Sm2State = { easeFactor: number; interval: number; repetitions: number };

/** Button → SM-2 quality (0-5). */
export const GRADES = { again: 1, hard: 3, good: 4, easy: 5 } as const;
export type GradeName = keyof typeof GRADES;

/**
 * Classic SM-2. Failed cards (quality < 3) restart and come back in 10 minutes;
 * passed cards are scheduled for the start of the student's local day `interval` days from now.
 */
export function sm2(
  state: Sm2State,
  quality: number,
  { now = new Date(), timeZone = DEFAULT_TIME_ZONE }: { now?: Date; timeZone?: string } = {},
): Sm2State & { dueAt: Date } {
  const easeFactor = Math.max(1.3, state.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  if (quality < 3) {
    return { easeFactor, interval: 0, repetitions: 0, dueAt: new Date(now.getTime() + 10 * 60 * 1000) };
  }

  let interval: number;
  if (state.repetitions === 0) interval = quality === 5 ? 2 : 1;
  else if (state.repetitions === 1) interval = quality === 3 ? 3 : 6;
  else interval = Math.round(Math.max(1, state.interval) * (quality === 3 ? 1.2 : easeFactor));

  return { easeFactor, interval, repetitions: state.repetitions + 1, dueAt: startOfLocalDay(now, timeZone, interval) };
}
