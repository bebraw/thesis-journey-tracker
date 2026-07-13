import { describe, expect, it } from "vitest";
import { normalizeGoogleCalendarEventLink, normalizeGoogleCalendarIcalUrl } from "./urls";

describe("Google Calendar URL policy", () => {
  it("accepts and canonicalizes Google secret iCal addresses", () => {
    expect(
      normalizeGoogleCalendarIcalUrl("https://calendar.google.com/calendar/ical/advisor%40example.com/private-secret_token/basic.ics"),
    ).toBe("https://calendar.google.com/calendar/ical/advisor%40example.com/private-secret_token/basic.ics");
  });

  it.each([
    "http://calendar.google.com/calendar/ical/example/private-secret/basic.ics",
    "https://calendar.google.com.evil.test/calendar/ical/example/private-secret/basic.ics",
    "https://user:password@calendar.google.com/calendar/ical/example/private-secret/basic.ics",
    "https://calendar.google.com:8443/calendar/ical/example/private-secret/basic.ics",
    "https://calendar.google.com/calendar/ical/example/public/basic.ics",
    "https://calendar.google.com/calendar/ical/example/private-secret/basic.ics?redirect=1",
    "https://calendar.google.com/calendar/ical/example/private-secret/basic.ics#fragment",
  ])("rejects unsafe iCal address %s", (value) => {
    expect(normalizeGoogleCalendarIcalUrl(value)).toBeNull();
  });

  it("allows only HTTPS Google Calendar event links", () => {
    expect(normalizeGoogleCalendarEventLink("https://calendar.google.com/calendar/event?eid=123")).toBe(
      "https://calendar.google.com/calendar/event?eid=123",
    );
    expect(normalizeGoogleCalendarEventLink("https://www.google.com/calendar/event?eid=123")).toBe(
      "https://www.google.com/calendar/event?eid=123",
    );
    expect(normalizeGoogleCalendarEventLink("javascript:alert(1)")).toBeNull();
    expect(normalizeGoogleCalendarEventLink("https://calendar.google.com.evil.test/calendar/event?eid=123")).toBeNull();
    expect(normalizeGoogleCalendarEventLink("https://example.com/calendar/event?eid=123")).toBeNull();
    expect(normalizeGoogleCalendarEventLink("https://www.google.com/calendar/url?continue=https://example.com")).toBeNull();
  });
});
