import { addDaysToDateString, localDateTimeToUtcIso } from "../calendar/scheduling";
import { toDateTimeLocalInput } from "../formatting";

export interface MeetingSchedule {
  startLocal: string;
  timeZone: string;
  intervalWeeks: number;
  untilDate: string | null;
}

export function parseMeetingSchedule(value: unknown): MeetingSchedule | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const { startLocal, timeZone, intervalWeeks } = input;
  const untilDate = input.untilDate ?? null;
  if (
    typeof startLocal !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startLocal) ||
    typeof timeZone !== "string" ||
    !Number.isInteger(intervalWeeks) ||
    Number(intervalWeeks) < 1 ||
    Number(intervalWeeks) > 52 ||
    (untilDate !== null && (typeof untilDate !== "string" || !isDate(untilDate) || untilDate < startLocal.slice(0, 10)))
  )
    return null;
  try {
    const instant = localDateTimeToUtcIso(startLocal, timeZone);
    if (toDateTimeLocalInput(instant, timeZone) !== startLocal) return null;
  } catch {
    return null;
  }
  return { startLocal, timeZone, intervalWeeks: Number(intervalWeeks), untilDate: untilDate as string | null };
}

export function nextScheduledMeeting(schedule: MeetingSchedule, after?: string): string | null {
  const first = localDateTimeToUtcIso(schedule.startLocal, schedule.timeZone);
  if (!after || first > after) return first;
  const localAfter = toDateTimeLocalInput(after, schedule.timeZone);
  const days =
    (Date.parse(`${localAfter.slice(0, 10)}T12:00:00Z`) - Date.parse(`${schedule.startLocal.slice(0, 10)}T12:00:00Z`)) / 86_400_000;
  let index = Math.max(0, Math.floor(days / (schedule.intervalWeeks * 7)));
  for (; index < 100_000; index += 1) {
    const date = addDaysToDateString(schedule.startLocal.slice(0, 10), index * schedule.intervalWeeks * 7);
    if (schedule.untilDate && date > schedule.untilDate) return null;
    const local = `${date}T${schedule.startLocal.slice(11)}`;
    const instant = localDateTimeToUtcIso(local, schedule.timeZone);
    if (toDateTimeLocalInput(instant, schedule.timeZone) !== local) continue;
    if (instant > after) return instant;
  }
  throw new Error("Meeting schedule is outside the supported date range.");
}

export function describeMeetingSchedule(schedule: MeetingSchedule): string {
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: schedule.timeZone }).format(
    new Date(localDateTimeToUtcIso(schedule.startLocal, schedule.timeZone)),
  );
  return `${schedule.intervalWeeks === 1 ? "Every" : `Every ${schedule.intervalWeeks} weeks on`} ${weekday} at ${schedule.startLocal.slice(11)} (${schedule.timeZone})${schedule.untilDate ? `, through ${schedule.untilDate}` : ""}`;
}

function isDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T12:00:00Z`)) &&
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
  );
}
