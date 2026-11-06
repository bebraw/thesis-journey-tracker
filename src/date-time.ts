export const DEFAULT_TIME_ZONE = "Europe/Helsinki";

export function addDaysToDateString(dateText: string, days: number): string {
  const date = new Date(`${dateText}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
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
