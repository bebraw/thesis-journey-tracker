import type { Student } from "../db";
import type { GoogleCalendarEvent } from "./google";

export const DEFAULT_SCHEDULE_TIMEZONE = "Europe/Helsinki";
const SLOT_START_HOUR = 9;
const SLOT_END_HOUR = 17;

export interface ScheduleEventView {
  id: string;
  summary: string;
  description: string | null;
  startLocal: string;
  endLocal: string;
  timeText: string;
  htmlLink: string | null;
}

export interface ScheduleSlot {
  startLocal: string;
  endLocal: string;
  label: string;
  selected: boolean;
}

export interface ScheduleDay {
  date: string;
  label: string;
  events: ScheduleEventView[];
  slots: ScheduleSlot[];
}

export interface ScheduleWeek {
  weekStart: string;
  weekEndExclusive: string;
  prevWeekStart: string;
  nextWeekStart: string;
  label: string;
  days: ScheduleDay[];
}

export function resolveScheduleTimeZone(timeZone?: string): string {
  return timeZone || DEFAULT_SCHEDULE_TIMEZONE;
}

export function resolveWeekStart(rawValue: string | null, timeZone: string, today = new Date()): string {
  if (rawValue && /^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    return rawValue;
  }

  const localDate = formatDateInTimeZone(today, timeZone);
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).format(today);
  const weekdayIndex = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday);
  return addDaysToDateString(localDate, weekdayIndex === -1 ? 0 : weekdayIndex * -1);
}

export function buildScheduleWeek(
  weekStart: string,
  timeZone: string,
  events: GoogleCalendarEvent[],
  selectedSlotStart: string | null,
): ScheduleWeek {
  const normalizedEvents = events.map((event) => {
    const startLocal = toEventLocalStart(event, timeZone);
    const endLocal = toEventLocalEnd(event, timeZone);
    return {
      id: event.id,
      summary: event.summary,
      description: event.description,
      startLocal,
      endLocal,
      timeText: buildEventTimeText(startLocal, endLocal),
      htmlLink: event.htmlLink,
    };
  });

  const days: ScheduleDay[] = [];
  for (let dayOffset = 0; dayOffset < 5; dayOffset += 1) {
    const date = addDaysToDateString(weekStart, dayOffset);
    const dayEvents = normalizedEvents
      .filter((event) => event.startLocal.slice(0, 10) === date)
      .sort((left, right) => left.startLocal.localeCompare(right.startLocal));
    const slots: ScheduleSlot[] = [];

    for (let hour = SLOT_START_HOUR; hour < SLOT_END_HOUR; hour += 1) {
      const startLocal = `${date}T${String(hour).padStart(2, "0")}:00`;
      const endLocal = `${date}T${String(hour + 1).padStart(2, "0")}:00`;
      const hasConflict = normalizedEvents.some((event) => rangesOverlap(startLocal, endLocal, event.startLocal, event.endLocal));
      if (hasConflict) {
        continue;
      }

      slots.push({
        startLocal,
        endLocal,
        label: `${startLocal.slice(11, 16)} - ${endLocal.slice(11, 16)}`,
        selected: selectedSlotStart === startLocal,
      });
    }

    days.push({
      date,
      label: new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone,
      }).format(new Date(`${date}T12:00:00Z`)),
      events: dayEvents,
      slots,
    });
  }

  const weekEndExclusive = addDaysToDateString(weekStart, 7);
  return {
    weekStart,
    weekEndExclusive,
    prevWeekStart: addDaysToDateString(weekStart, -7),
    nextWeekStart: addDaysToDateString(weekStart, 7),
    label: `${days[0]?.label || weekStart} - ${days[4]?.label || addDaysToDateString(weekStart, 4)}`,
    days,
  };
}

export function addDaysToDateString(dateText: string, days: number): string {
  const date = new Date(`${dateText}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function addHourToLocalDateTime(localDateTime: string, hours: number): string {
  const [dateText, timeText] = localDateTime.split("T");
  const [hour, minute] = timeText.split(":").map((value) => Number(value));
  const shiftedDate = new Date(Date.UTC(
    Number(dateText.slice(0, 4)),
    Number(dateText.slice(5, 7)) - 1,
    Number(dateText.slice(8, 10)),
    hour + hours,
    minute,
  ));

  return `${shiftedDate.toISOString().slice(0, 10)}T${shiftedDate.toISOString().slice(11, 16)}`;
}

export function localDateTimeToUtcIso(localDateTime: string, timeZone: string): string {
  const [dateText, timeText] = localDateTime.split("T");
  const [year, month, day] = dateText.split("-").map((value) => Number(value));
  const [hour, minute] = timeText.split(":").map((value) => Number(value));
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const offset = getTimeZoneOffsetMilliseconds(new Date(utcGuess), timeZone);
  let adjustedTimestamp = utcGuess - offset;
  const refinedOffset = getTimeZoneOffsetMilliseconds(new Date(adjustedTimestamp), timeZone);
  if (refinedOffset !== offset) {
    adjustedTimestamp = utcGuess - refinedOffset;
  }
  return new Date(adjustedTimestamp).toISOString();
}

export function buildScheduleEventTitle(student: Student): string {
  return `Thesis supervision: ${student.name}`;
}

export function buildScheduleEventDescription(student: Student): string {
  const parts = [`Student: ${student.name}`];
  if (student.thesisTopic) {
    parts.push(`Topic: ${student.thesisTopic}`);
  }
  if (student.studentNotes) {
    parts.push(`Notes: ${student.studentNotes}`);
  }
  return parts.join("\n");
}

function formatDateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(date);

  return `${findPart(parts, "year")}-${findPart(parts, "month")}-${findPart(parts, "day")}`;
}

function toEventLocalStart(event: GoogleCalendarEvent, timeZone: string): string {
  if (event.startDateTime) {
    return formatDateTimeInTimeZone(new Date(event.startDateTime), timeZone);
  }
  return `${event.startDate || ""}T00:00`;
}

function toEventLocalEnd(event: GoogleCalendarEvent, timeZone: string): string {
  if (event.endDateTime) {
    return formatDateTimeInTimeZone(new Date(event.endDateTime), timeZone);
  }
  return `${event.endDate || event.startDate || ""}T00:00`;
}

function formatDateTimeInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).formatToParts(date);

  return `${findPart(parts, "year")}-${findPart(parts, "month")}-${findPart(parts, "day")}T${findPart(parts, "hour")}:${findPart(parts, "minute")}`;
}

function buildEventTimeText(startLocal: string, endLocal: string): string {
  return `${startLocal.slice(11, 16)} - ${endLocal.slice(11, 16)}`;
}

function rangesOverlap(leftStart: string, leftEnd: string, rightStart: string, rightEnd: string): boolean {
  return leftStart < rightEnd && leftEnd > rightStart;
}

function getTimeZoneOffsetMilliseconds(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone,
  }).formatToParts(date);

  const utcTimestamp = Date.UTC(
    Number(findPart(parts, "year")),
    Number(findPart(parts, "month")) - 1,
    Number(findPart(parts, "day")),
    Number(findPart(parts, "hour")),
    Number(findPart(parts, "minute")),
    Number(findPart(parts, "second")),
  );

  return utcTimestamp - date.getTime();
}

function findPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value || "";
}
