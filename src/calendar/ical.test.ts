import { describe, expect, it, vi } from "vitest";
import { IcalCalendarError, listIcalCalendarEvents, parseIcalCalendarEvents } from "./ical";

const GOOGLE_ICAL_URL = "https://calendar.google.com/calendar/ical/example/private-secret/basic.ics";

function calendarResponse(lines: string[], init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "text/calendar; charset=utf-8");
  }
  return new Response(lines.join("\r\n"), { ...init, headers });
}

describe("iCal recurrence parsing", () => {
  it("expands recurring events with EXDATE omissions and RECURRENCE-ID overrides inside the requested window", () => {
    const calendarText = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "X-WR-TIMEZONE:Europe/Helsinki",
      "BEGIN:VEVENT",
      "UID:series-1",
      "DTSTART;TZID=Europe/Helsinki:20260324T130000",
      "DTEND;TZID=Europe/Helsinki:20260324T140000",
      "RRULE:FREQ=WEEKLY;BYDAY=TU;COUNT=4",
      "EXDATE;TZID=Europe/Helsinki:20260331T130000",
      "SUMMARY:Weekly supervision",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:series-1",
      "RECURRENCE-ID;TZID=Europe/Helsinki:20260407T130000",
      "DTSTART;TZID=Europe/Helsinki:20260407T150000",
      "DTEND;TZID=Europe/Helsinki:20260407T160000",
      "SUMMARY:Moved supervision",
      "DESCRIPTION:Rescheduled instance",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parseIcalCalendarEvents(calendarText, "Europe/Helsinki", {
      timeMinIso: "2026-03-30T00:00:00.000Z",
      timeMaxIso: "2026-04-13T00:00:00.000Z",
    });

    expect(events).toEqual([
      expect.objectContaining({
        id: "series-1",
        summary: "Moved supervision",
        description: "Rescheduled instance",
        startDateTime: "2026-04-07T12:00:00.000Z",
        endDateTime: "2026-04-07T13:00:00.000Z",
      }),
    ]);
  });

  it("fails instead of partially returning an unbounded recurrence", () => {
    const calendarText = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:unbounded-series",
      "DTSTART:20000101T100000Z",
      "DTEND:20000101T110000Z",
      "RRULE:FREQ=DAILY;UNTIL=20991231T100000Z",
      "SUMMARY:Long-running series",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    expect(() => parseIcalCalendarEvents(calendarText, "Europe/Helsinki")).toThrow(
      "iCal recurrence expansion exceeds the safe iteration limit.",
    );
  });

  it("bounds an old recurring series to the requested window", () => {
    const calendarText = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:old-weekly-series",
      "DTSTART:20100105T110000Z",
      "DTEND:20100105T120000Z",
      "RRULE:FREQ=WEEKLY;BYDAY=TU;UNTIL=20300101T110000Z",
      "SUMMARY:Long-running supervision",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parseIcalCalendarEvents(calendarText, "Europe/Helsinki", {
      timeMinIso: "2026-03-23T00:00:00.000Z",
      timeMaxIso: "2026-03-30T00:00:00.000Z",
    });

    expect(events).toEqual([
      expect.objectContaining({
        id: "old-weekly-series",
        startDateTime: "2026-03-24T11:00:00.000Z",
      }),
    ]);
  });

  it("drops unsafe event URLs while preserving Google Calendar links", () => {
    const calendarText = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:unsafe-link",
      "DTSTART:20260324T110000Z",
      "DTEND:20260324T120000Z",
      "URL:javascript:alert(1)",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:safe-link",
      "DTSTART:20260325T110000Z",
      "DTEND:20260325T120000Z",
      "URL:https://www.google.com/calendar/event?eid=safe",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    expect(parseIcalCalendarEvents(calendarText, "Europe/Helsinki").map((event) => event.htmlLink)).toEqual([
      null,
      "https://www.google.com/calendar/event?eid=safe",
    ]);
  });
});

describe("iCal downloads", () => {
  it("downloads a bounded Google Calendar feed with defensive fetch options", async () => {
    const fetchMock = vi.fn(async () =>
      calendarResponse([
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "BEGIN:VEVENT",
        "UID:event-1",
        "DTSTART:20260324T110000Z",
        "DTEND:20260324T120000Z",
        "SUMMARY:Supervision",
        "END:VEVENT",
        "END:VCALENDAR",
      ]),
    );

    await expect(listIcalCalendarEvents(GOOGLE_ICAL_URL, "Europe/Helsinki", {}, fetchMock)).resolves.toEqual([
      expect.objectContaining({ id: "event-1", summary: "Supervision" }),
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      GOOGLE_ICAL_URL,
      expect.objectContaining({
        headers: { Accept: "text/calendar" },
        redirect: "manual",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("rejects non-Google source URLs before fetching", async () => {
    const fetchMock = vi.fn();

    await expect(listIcalCalendarEvents("https://example.com/private-secret/basic.ics", "Europe/Helsinki", {}, fetchMock)).rejects.toThrow(
      "not an allowed Google Calendar secret address",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not follow redirects outside the Google Calendar allowlist", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://internal.example.test/calendar.ics" },
        }),
    );

    await expect(listIcalCalendarEvents(GOOGLE_ICAL_URL, "Europe/Helsinki", {}, fetchMock)).rejects.toThrow(
      "redirect was not an allowed Google Calendar secret address",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("requires the calendar content type and a complete VCALENDAR document", async () => {
    const wrongTypeFetch = vi.fn(
      async () =>
        new Response("BEGIN:VCALENDAR\r\nEND:VCALENDAR", {
          headers: { "content-type": "text/html" },
        }),
    );
    await expect(listIcalCalendarEvents(GOOGLE_ICAL_URL, "Europe/Helsinki", {}, wrongTypeFetch)).rejects.toThrow(
      "did not use the text/calendar content type",
    );

    const incompleteFetch = vi.fn(async () => calendarResponse(["BEGIN:VCALENDAR", "VERSION:2.0"]));
    await expect(listIcalCalendarEvents(GOOGLE_ICAL_URL, "Europe/Helsinki", {}, incompleteFetch)).rejects.toThrow(
      "not a complete VCALENDAR document",
    );

    const spoofedEndMarkerFetch = vi.fn(async () => calendarResponse(["BEGIN:VCALENDAR", "VERSION:2.0", "DESCRIPTION:END:VCALENDAR"]));
    await expect(listIcalCalendarEvents(GOOGLE_ICAL_URL, "Europe/Helsinki", {}, spoofedEndMarkerFetch)).rejects.toThrow(
      "not a complete VCALENDAR document",
    );
  });

  it("rejects oversized responses before reading their bodies", async () => {
    const fetchMock = vi.fn(async () =>
      calendarResponse(["BEGIN:VCALENDAR", "END:VCALENDAR"], {
        headers: { "content-length": String(5 * 1024 * 1024 + 1) },
      }),
    );

    await expect(listIcalCalendarEvents(GOOGLE_ICAL_URL, "Europe/Helsinki", {}, fetchMock)).rejects.toThrow(
      "iCal response exceeds the 5 MiB limit",
    );
  });

  it("counts streamed bytes when content-length is absent", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(new Uint8Array(5 * 1024 * 1024 + 1), {
          headers: { "content-type": "text/calendar" },
        }),
    );

    await expect(listIcalCalendarEvents(GOOGLE_ICAL_URL, "Europe/Helsinki", {}, fetchMock)).rejects.toThrow(
      "iCal response exceeds the 5 MiB limit",
    );
  });

  it("aborts downloads that exceed the configured timeout", async () => {
    const fetchMock = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit): Promise<Response> =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {
            once: true,
          });
        }),
    );

    await expect(listIcalCalendarEvents(GOOGLE_ICAL_URL, "Europe/Helsinki", { fetchTimeoutMs: 5 }, fetchMock)).rejects.toEqual(
      new IcalCalendarError("iCal download timed out."),
    );
  });
});
