import { describe, expect, it } from "vitest";
import { parseIcalCalendarEvents } from "./ical";

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
});
