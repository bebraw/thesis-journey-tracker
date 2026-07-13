import { describe, expect, it, vi } from "vitest";
import { listGoogleCalendarEvents, type GoogleCalendarConfig } from "./google";

const CONFIG: GoogleCalendarConfig = {
  clientId: "client-id",
  clientSecret: "client-secret",
  refreshToken: "refresh-token",
  calendarId: "primary",
  timeZone: "Europe/Helsinki",
};

describe("Google Calendar API event links", () => {
  it("keeps only exact HTTPS Google Calendar event links", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-token" }), {
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              { id: "safe", htmlLink: "https://www.google.com/calendar/event?eid=safe" },
              { id: "unsafe", htmlLink: "javascript:alert(1)" },
              { id: "redirect", htmlLink: "https://www.google.com/calendar/url?continue=https://example.com" },
            ],
          }),
          { headers: { "content-type": "application/json" } },
        ),
      );

    const events = await listGoogleCalendarEvents(
      CONFIG,
      {
        timeMinIso: "2026-03-23T00:00:00.000Z",
        timeMaxIso: "2026-03-30T00:00:00.000Z",
      },
      fetchMock,
    );

    expect(events.map((event) => event.htmlLink)).toEqual(["https://www.google.com/calendar/event?eid=safe", null, null]);
  });
});
