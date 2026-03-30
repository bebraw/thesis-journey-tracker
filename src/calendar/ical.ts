import { addDaysToDateString, localDateTimeToUtcIso } from "./scheduling";
import type { GoogleCalendarEvent } from "./google";

interface ListIcalCalendarEventsOptions {
  timeMinIso?: string;
  timeMaxIso?: string;
}

interface IcalDateTimeField {
  value: string;
  params: Record<string, string>;
}

interface IcalEventFields {
  uid?: string;
  summary?: string;
  description?: string;
  url?: string;
  start?: IcalDateTimeField;
  end?: IcalDateTimeField;
  rrule?: string;
  exdates: IcalDateTimeField[];
  recurrenceId?: IcalDateTimeField;
}

interface IcalExpansionWindow {
  timeMinIso: string | null;
  timeMaxIso: string | null;
  timeMinDate: string | null;
  timeMaxDate: string | null;
}

interface ParsedRecurringRule {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | null;
  interval: number;
  count: number | null;
  byDay: string[];
  byMonthDay: number[];
  byMonth: number[];
  until: ParsedTemporal | null;
}

type ParsedTemporal = ParsedDateTimeTemporal | ParsedDateTemporal;

interface ParsedDateTimeTemporal {
  kind: "dateTime";
  utcIso: string;
  localDateTime: string;
  date: string;
  timeZone: string;
}

interface ParsedDateTemporal {
  kind: "date";
  date: string;
}

export async function listIcalCalendarEvents(
  iCalUrl: string,
  defaultTimeZone: string,
  options: ListIcalCalendarEventsOptions = {},
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleCalendarEvent[]> {
  const response = await fetchImpl(iCalUrl);
  if (!response.ok) {
    throw new Error(`iCal download failed with status ${response.status}.`);
  }

  const calendarText = await response.text();
  return parseIcalCalendarEvents(calendarText, defaultTimeZone, options);
}

export function parseIcalCalendarEvents(
  calendarText: string,
  defaultTimeZone: string,
  options: ListIcalCalendarEventsOptions = {},
): GoogleCalendarEvent[] {
  const lines = unfoldIcalLines(calendarText);
  const calendarTimeZone = findCalendarTimeZone(lines) || defaultTimeZone;
  const parsedEvents = parseRawIcalEvents(lines);
  const exceptionsByUid = buildExceptionMap(parsedEvents, calendarTimeZone);
  const usedExceptionKeys = new Set<string>();
  const events: GoogleCalendarEvent[] = [];

  for (const fields of parsedEvents) {
    if (fields.recurrenceId) {
      continue;
    }

    if (!fields.rrule) {
      const event = buildIcalEvent(fields, calendarTimeZone, options);
      if (event) {
        events.push(event);
      }
      continue;
    }

    events.push(
      ...expandRecurringEvent(fields, calendarTimeZone, options, exceptionsByUid.get(fields.uid || "") || new Map(), usedExceptionKeys),
    );
  }

  for (const fields of parsedEvents) {
    if (!fields.recurrenceId || !fields.uid) {
      continue;
    }

    const exceptionKey = buildRecurrenceKey(fields.recurrenceId, calendarTimeZone, fields.start?.params.TZID || calendarTimeZone);
    if (usedExceptionKeys.has(`${fields.uid}:${exceptionKey}`)) {
      continue;
    }

    const event = buildIcalEvent(fields, calendarTimeZone, options);
    if (event) {
      events.push(event);
    }
  }

  return events.sort(compareGoogleCalendarEvents);
}

function parseRawIcalEvents(lines: string[]): IcalEventFields[] {
  const events: IcalEventFields[] = [];
  let currentEvent: IcalEventFields | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      currentEvent = { exdates: [] };
      continue;
    }

    if (line === "END:VEVENT") {
      if (currentEvent) {
        events.push(currentEvent);
      }
      currentEvent = null;
      continue;
    }

    if (!currentEvent) {
      continue;
    }

    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }

    const rawKey = line.slice(0, separatorIndex);
    const rawValue = line.slice(separatorIndex + 1);
    const [name, ...paramParts] = rawKey.split(";");
    const params = parseIcalParams(paramParts);

    if (name === "UID") {
      currentEvent.uid = rawValue.trim();
    } else if (name === "SUMMARY") {
      currentEvent.summary = decodeIcalText(rawValue);
    } else if (name === "DESCRIPTION") {
      currentEvent.description = decodeIcalText(rawValue);
    } else if (name === "URL") {
      currentEvent.url = rawValue.trim();
    } else if (name === "DTSTART") {
      currentEvent.start = {
        value: rawValue.trim(),
        params,
      };
    } else if (name === "DTEND") {
      currentEvent.end = {
        value: rawValue.trim(),
        params,
      };
    } else if (name === "RRULE") {
      currentEvent.rrule = rawValue.trim();
    } else if (name === "EXDATE") {
      for (const value of rawValue.split(",")) {
        const trimmedValue = value.trim();
        if (!trimmedValue) continue;
        currentEvent.exdates.push({
          value: trimmedValue,
          params,
        });
      }
    } else if (name === "RECURRENCE-ID") {
      currentEvent.recurrenceId = {
        value: rawValue.trim(),
        params,
      };
    }
  }

  return events;
}

function buildExceptionMap(events: IcalEventFields[], calendarTimeZone: string): Map<string, Map<string, IcalEventFields>> {
  const result = new Map<string, Map<string, IcalEventFields>>();

  for (const fields of events) {
    if (!fields.uid || !fields.recurrenceId) {
      continue;
    }

    const recurrenceKey = buildRecurrenceKey(fields.recurrenceId, calendarTimeZone, fields.start?.params.TZID || calendarTimeZone);
    const byUid = result.get(fields.uid) || new Map<string, IcalEventFields>();
    byUid.set(recurrenceKey, fields);
    result.set(fields.uid, byUid);
  }

  return result;
}

function buildIcalEvent(
  fields: IcalEventFields,
  calendarTimeZone: string,
  options: ListIcalCalendarEventsOptions,
): GoogleCalendarEvent | null {
  if (!fields.start) {
    return null;
  }

  const start = parseIcalTemporal(fields.start, calendarTimeZone, fields.start.params.TZID || calendarTimeZone);
  const end = parseIcalTemporal(fields.end || fields.start, calendarTimeZone, fields.start.params.TZID || calendarTimeZone);
  if (!temporalOverlapsWindow(start, end, options)) {
    return null;
  }

  return createGoogleCalendarEvent(fields, start, end);
}

function expandRecurringEvent(
  fields: IcalEventFields,
  calendarTimeZone: string,
  options: ListIcalCalendarEventsOptions,
  exceptions: Map<string, IcalEventFields>,
  usedExceptionKeys: Set<string>,
): GoogleCalendarEvent[] {
  if (!fields.start) {
    return [];
  }

  const rule = parseRecurringRule(fields.rrule || "", fields.start, calendarTimeZone);
  if (!rule.freq) {
    const fallbackEvent = buildIcalEvent(fields, calendarTimeZone, options);
    return fallbackEvent ? [fallbackEvent] : [];
  }

  const start = parseIcalTemporal(fields.start, calendarTimeZone, fields.start.params.TZID || calendarTimeZone);
  const end = parseIcalTemporal(fields.end || fields.start, calendarTimeZone, fields.start.params.TZID || calendarTimeZone);
  const window = buildIcalExpansionWindow(options);
  const exclusionKeys = new Set(
    fields.exdates.map((field) => buildRecurrenceKey(field, calendarTimeZone, fields.start?.params.TZID || calendarTimeZone)),
  );
  const occurrenceEvents: GoogleCalendarEvent[] = [];
  let occurrenceCount = 0;
  let cursorDate = start.date;
  const maxCursorDate = rule.until?.kind === "date" ? rule.until.date : rule.until?.date || window.timeMaxDate || addDaysToDateString(start.date, 366);
  let safetyCounter = 0;

  while (cursorDate <= maxCursorDate && safetyCounter < 3700) {
    safetyCounter += 1;

    if (matchesRecurringRule(cursorDate, start.date, rule)) {
      const occurrence = buildRecurringOccurrence(cursorDate, start, end);
      occurrenceCount += 1;

      if (rule.count && occurrenceCount > rule.count) {
        break;
      }

      if (rule.until && compareOccurrenceToUntil(occurrence.start, rule.until) > 0) {
        break;
      }

      const recurrenceKey = buildTemporalRecurrenceKey(occurrence.start);
      const matchingException = fields.uid ? exceptions.get(recurrenceKey) : null;

      if (matchingException && fields.uid) {
        usedExceptionKeys.add(`${fields.uid}:${recurrenceKey}`);
      }

      if (!matchingException && exclusionKeys.has(recurrenceKey)) {
        cursorDate = addDaysToDateString(cursorDate, 1);
        continue;
      }

      if (matchingException) {
        const exceptionEvent = buildIcalEvent(matchingException, calendarTimeZone, options);
        if (exceptionEvent) {
          occurrenceEvents.push(exceptionEvent);
        }
      } else if (temporalOverlapsWindow(occurrence.start, occurrence.end, options)) {
        occurrenceEvents.push(createGoogleCalendarEvent(fields, occurrence.start, occurrence.end));
      }
    }

    cursorDate = addDaysToDateString(cursorDate, 1);
  }

  return occurrenceEvents;
}

function buildIcalExpansionWindow(options: ListIcalCalendarEventsOptions): IcalExpansionWindow {
  return {
    timeMinIso: options.timeMinIso || null,
    timeMaxIso: options.timeMaxIso || null,
    timeMinDate: options.timeMinIso ? options.timeMinIso.slice(0, 10) : null,
    timeMaxDate: options.timeMaxIso ? options.timeMaxIso.slice(0, 10) : null,
  };
}

function temporalOverlapsWindow(start: ParsedTemporal, end: ParsedTemporal, options: ListIcalCalendarEventsOptions): boolean {
  const window = buildIcalExpansionWindow(options);

  if (!window.timeMinIso && !window.timeMaxIso) {
    return true;
  }

  if (start.kind === "dateTime" && end.kind === "dateTime") {
    if (window.timeMinIso && end.utcIso <= window.timeMinIso) {
      return false;
    }
    if (window.timeMaxIso && start.utcIso >= window.timeMaxIso) {
      return false;
    }
    return true;
  }

  const eventStartDate = start.date;
  const eventEndDate = end.kind === "date" ? end.date : end.date;
  if (window.timeMinDate && eventEndDate <= window.timeMinDate) {
    return false;
  }
  if (window.timeMaxDate && eventStartDate >= window.timeMaxDate) {
    return false;
  }
  return true;
}

function createGoogleCalendarEvent(fields: IcalEventFields, start: ParsedTemporal, end: ParsedTemporal): GoogleCalendarEvent {
  return {
    id: fields.uid || "",
    summary: fields.summary || "Untitled event",
    description: fields.description || null,
    htmlLink: fields.url || null,
    startDateTime: start.kind === "dateTime" ? start.utcIso : null,
    startDate: start.kind === "date" ? start.date : null,
    endDateTime: end.kind === "dateTime" ? end.utcIso : null,
    endDate: end.kind === "date" ? end.date : null,
    attendeeEmails: [],
  };
}

function parseRecurringRule(rruleText: string, startField: IcalDateTimeField, calendarTimeZone: string): ParsedRecurringRule {
  const parsed: ParsedRecurringRule = {
    freq: null,
    interval: 1,
    count: null,
    byDay: [],
    byMonthDay: [],
    byMonth: [],
    until: null,
  };

  for (const part of rruleText.split(";")) {
    const [rawKey, rawValue] = part.split("=");
    const key = (rawKey || "").trim().toUpperCase();
    const value = (rawValue || "").trim();
    if (!key || !value) {
      continue;
    }

    if (key === "FREQ" && (value === "DAILY" || value === "WEEKLY" || value === "MONTHLY" || value === "YEARLY")) {
      parsed.freq = value;
    } else if (key === "INTERVAL") {
      const interval = Number.parseInt(value, 10);
      parsed.interval = Number.isFinite(interval) && interval > 0 ? interval : 1;
    } else if (key === "COUNT") {
      const count = Number.parseInt(value, 10);
      parsed.count = Number.isFinite(count) && count > 0 ? count : null;
    } else if (key === "BYDAY") {
      parsed.byDay = value.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
    } else if (key === "BYMONTHDAY") {
      parsed.byMonthDay = value
        .split(",")
        .map((item) => Number.parseInt(item, 10))
        .filter((item) => Number.isFinite(item));
    } else if (key === "BYMONTH") {
      parsed.byMonth = value
        .split(",")
        .map((item) => Number.parseInt(item, 10))
        .filter((item) => Number.isFinite(item));
    } else if (key === "UNTIL") {
      parsed.until = parseRRuleUntil(value, startField, calendarTimeZone);
    }
  }

  return parsed;
}

function parseRRuleUntil(value: string, startField: IcalDateTimeField, calendarTimeZone: string): ParsedTemporal | null {
  if (/^\d{8}$/.test(value)) {
    return { kind: "date", date: compactDateToIso(value) };
  }

  if (/^\d{8}T\d{6}Z$/.test(value)) {
    return parseIcalTemporal({ value, params: {} }, calendarTimeZone, startField.params.TZID || calendarTimeZone);
  }

  if (/^\d{8}T\d{6}$/.test(value)) {
    return parseIcalTemporal({ value, params: { TZID: startField.params.TZID || calendarTimeZone } }, calendarTimeZone, startField.params.TZID || calendarTimeZone);
  }

  return null;
}

function matchesRecurringRule(candidateDate: string, masterDate: string, rule: ParsedRecurringRule): boolean {
  const interval = rule.interval || 1;
  const diffDays = daysBetweenDateStrings(masterDate, candidateDate);
  if (diffDays < 0) {
    return false;
  }

  const weekday = getWeekdayCode(candidateDate);
  const candidateDay = getDayOfMonth(candidateDate);
  const candidateMonth = getMonthOfYear(candidateDate);
  const masterDay = getDayOfMonth(masterDate);
  const masterMonth = getMonthOfYear(masterDate);
  const masterWeekday = getWeekdayCode(masterDate);

  if (rule.byMonth.length > 0 && !rule.byMonth.includes(candidateMonth)) {
    return false;
  }

  if (rule.freq === "DAILY") {
    if (diffDays % interval !== 0) {
      return false;
    }
    if (rule.byDay.length > 0 && !rule.byDay.includes(weekday)) {
      return false;
    }
    if (rule.byMonthDay.length > 0 && !rule.byMonthDay.includes(candidateDay)) {
      return false;
    }
    return true;
  }

  if (rule.freq === "WEEKLY") {
    if (Math.floor(diffDays / 7) % interval !== 0) {
      return false;
    }
    const allowedWeekdays = rule.byDay.length > 0 ? rule.byDay : [masterWeekday];
    return allowedWeekdays.includes(weekday);
  }

  if (rule.freq === "MONTHLY") {
    const diffMonths = monthsBetweenDateStrings(masterDate, candidateDate);
    if (diffMonths < 0 || diffMonths % interval !== 0) {
      return false;
    }
    if (rule.byMonthDay.length > 0) {
      if (!rule.byMonthDay.includes(candidateDay)) {
        return false;
      }
    } else if (candidateDay !== masterDay) {
      return false;
    }
    if (rule.byDay.length > 0 && !rule.byDay.includes(weekday)) {
      return false;
    }
    return true;
  }

  if (rule.freq === "YEARLY") {
    const diffYears = getYear(candidateDate) - getYear(masterDate);
    if (diffYears < 0 || diffYears % interval !== 0) {
      return false;
    }
    const allowedMonths = rule.byMonth.length > 0 ? rule.byMonth : [masterMonth];
    if (!allowedMonths.includes(candidateMonth)) {
      return false;
    }
    if (rule.byMonthDay.length > 0) {
      if (!rule.byMonthDay.includes(candidateDay)) {
        return false;
      }
    } else if (candidateDay !== masterDay) {
      return false;
    }
    if (rule.byDay.length > 0 && !rule.byDay.includes(weekday)) {
      return false;
    }
    return true;
  }

  return false;
}

function buildRecurringOccurrence(
  occurrenceDate: string,
  start: ParsedTemporal,
  end: ParsedTemporal,
): { start: ParsedTemporal; end: ParsedTemporal } {
  if (start.kind === "dateTime" && end.kind === "dateTime") {
    const startTime = start.localDateTime.slice(11, 16);
    const durationMs = Date.parse(end.utcIso) - Date.parse(start.utcIso);
    const localStart = `${occurrenceDate}T${startTime}`;
    const startUtcIso = localDateTimeToUtcIso(localStart, start.timeZone);
    const endUtcIso = new Date(Date.parse(startUtcIso) + durationMs).toISOString();
    const endLocalDateTime = formatUtcIsoInTimeZone(endUtcIso, start.timeZone);

    return {
      start: {
        kind: "dateTime",
        utcIso: startUtcIso,
        localDateTime: localStart,
        date: occurrenceDate,
        timeZone: start.timeZone,
      },
      end: {
        kind: "dateTime",
        utcIso: endUtcIso,
        localDateTime: endLocalDateTime,
        date: endLocalDateTime.slice(0, 10),
        timeZone: start.timeZone,
      },
    };
  }

  const durationDays = daysBetweenDateStrings(start.date, end.date) || 1;
  return {
    start: { kind: "date", date: occurrenceDate },
    end: { kind: "date", date: addDaysToDateString(occurrenceDate, durationDays) },
  };
}

function compareOccurrenceToUntil(occurrenceStart: ParsedTemporal, until: ParsedTemporal): number {
  if (occurrenceStart.kind === "dateTime" && until.kind === "dateTime") {
    return occurrenceStart.utcIso.localeCompare(until.utcIso);
  }
  return occurrenceStart.date.localeCompare(until.date);
}

function buildRecurrenceKey(field: IcalDateTimeField, calendarTimeZone: string, fallbackTimeZone: string): string {
  return buildTemporalRecurrenceKey(parseIcalTemporal(field, calendarTimeZone, fallbackTimeZone));
}

function buildTemporalRecurrenceKey(value: ParsedTemporal): string {
  return value.kind === "dateTime" ? `dateTime:${value.utcIso}` : `date:${value.date}`;
}

function parseIcalTemporal(field: IcalDateTimeField, calendarTimeZone: string, fallbackTimeZone: string): ParsedTemporal {
  if (field.params.VALUE === "DATE" || /^\d{8}$/.test(field.value)) {
    return {
      kind: "date",
      date: compactDateToIso(field.value),
    };
  }

  if (field.value.endsWith("Z")) {
    const utcIso = compactUtcDateTimeToIso(field.value);
    const localDateTime = formatUtcIsoInTimeZone(utcIso, fallbackTimeZone || calendarTimeZone);
    return {
      kind: "dateTime",
      utcIso,
      localDateTime,
      date: localDateTime.slice(0, 10),
      timeZone: fallbackTimeZone || calendarTimeZone,
    };
  }

  const timeZone = field.params.TZID || fallbackTimeZone || calendarTimeZone;
  const localDateTime = compactLocalDateTime(field.value);
  return {
    kind: "dateTime",
    utcIso: localDateTimeToUtcIso(localDateTime, timeZone),
    localDateTime,
    date: localDateTime.slice(0, 10),
    timeZone,
  };
}

function compareGoogleCalendarEvents(left: GoogleCalendarEvent, right: GoogleCalendarEvent): number {
  const leftKey = left.startDateTime || left.startDate || "";
  const rightKey = right.startDateTime || right.startDate || "";
  return leftKey.localeCompare(rightKey);
}

function unfoldIcalLines(calendarText: string): string[] {
  return calendarText.replace(/\r?\n[ \t]/g, "").split(/\r?\n/).filter(Boolean);
}

function findCalendarTimeZone(lines: string[]): string | null {
  for (const line of lines) {
    if (line.startsWith("X-WR-TIMEZONE:")) {
      return line.slice("X-WR-TIMEZONE:".length).trim() || null;
    }
  }
  return null;
}

function parseIcalParams(parts: string[]): Record<string, string> {
  const params: Record<string, string> = {};
  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key && value) {
      params[key.toUpperCase()] = value;
    }
  }
  return params;
}

function decodeIcalText(value: string): string {
  return value.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

function compactDateToIso(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function compactLocalDateTime(value: string): string {
  return `${compactDateToIso(value.slice(0, 8))}T${value.slice(9, 11)}:${value.slice(11, 13)}`;
}

function compactUtcDateTimeToIso(value: string): string {
  return `${compactDateToIso(value.slice(0, 8))}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}.000Z`;
}

function formatUtcIsoInTimeZone(utcIso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).formatToParts(new Date(utcIso));

  return `${findPart(parts, "year")}-${findPart(parts, "month")}-${findPart(parts, "day")}T${findPart(parts, "hour")}:${findPart(parts, "minute")}`;
}

function findPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value || "";
}

function daysBetweenDateStrings(left: string, right: string): number {
  const leftDate = new Date(`${left}T12:00:00Z`);
  const rightDate = new Date(`${right}T12:00:00Z`);
  return Math.round((rightDate.getTime() - leftDate.getTime()) / (24 * 60 * 60 * 1000));
}

function monthsBetweenDateStrings(left: string, right: string): number {
  return (getYear(right) - getYear(left)) * 12 + (getMonthOfYear(right) - getMonthOfYear(left));
}

function getWeekdayCode(dateText: string): string {
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(new Date(`${dateText}T12:00:00Z`));
  const mapping: Record<string, string> = {
    Mon: "MO",
    Tue: "TU",
    Wed: "WE",
    Thu: "TH",
    Fri: "FR",
    Sat: "SA",
    Sun: "SU",
  };
  return mapping[weekday] || "";
}

function getDayOfMonth(dateText: string): number {
  return Number.parseInt(dateText.slice(8, 10), 10);
}

function getMonthOfYear(dateText: string): number {
  return Number.parseInt(dateText.slice(5, 7), 10);
}

function getYear(dateText: string): number {
  return Number.parseInt(dateText.slice(0, 4), 10);
}
