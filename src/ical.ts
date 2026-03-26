import type { GoogleCalendarEvent } from "./google-calendar";
import { localDateTimeToUtcIso } from "./scheduling";

export async function listIcalCalendarEvents(
  iCalUrl: string,
  defaultTimeZone: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleCalendarEvent[]> {
  const response = await fetchImpl(iCalUrl);
  if (!response.ok) {
    throw new Error(`iCal download failed with status ${response.status}.`);
  }

  const calendarText = await response.text();
  return parseIcalCalendarEvents(calendarText, defaultTimeZone);
}

export function parseIcalCalendarEvents(calendarText: string, defaultTimeZone: string): GoogleCalendarEvent[] {
  const lines = unfoldIcalLines(calendarText);
  const calendarTimeZone = findCalendarTimeZone(lines) || defaultTimeZone;
  const events: GoogleCalendarEvent[] = [];

  let currentEvent: IcalEventFields | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      currentEvent = {};
      continue;
    }

    if (line === "END:VEVENT") {
      const event = currentEvent ? buildIcalEvent(currentEvent, calendarTimeZone) : null;
      if (event) {
        events.push(event);
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
    }
  }

  return events;
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
}

function buildIcalEvent(fields: IcalEventFields, calendarTimeZone: string): GoogleCalendarEvent | null {
  if (!fields.start) {
    return null;
  }

  const start = parseIcalDateTime(fields.start, calendarTimeZone);
  const end = parseIcalDateTime(fields.end || fields.start, calendarTimeZone);

  return {
    id: fields.uid || "",
    summary: fields.summary || "Untitled event",
    description: fields.description || null,
    htmlLink: fields.url || null,
    startDateTime: start.kind === "dateTime" ? start.value : null,
    startDate: start.kind === "date" ? start.value : null,
    endDateTime: end.kind === "dateTime" ? end.value : null,
    endDate: end.kind === "date" ? end.value : null,
    attendeeEmails: [],
  };
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
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseIcalDateTime(field: IcalDateTimeField, calendarTimeZone: string): { kind: "dateTime" | "date"; value: string } {
  if (field.params.VALUE === "DATE" || /^\d{8}$/.test(field.value)) {
    return {
      kind: "date",
      value: compactDateToIso(field.value),
    };
  }

  if (field.value.endsWith("Z")) {
    return {
      kind: "dateTime",
      value: compactUtcDateTimeToIso(field.value),
    };
  }

  const tzid = field.params.TZID || calendarTimeZone;
  return {
    kind: "dateTime",
    value: localDateTimeToUtcIso(compactLocalDateTime(field.value), tzid),
  };
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
