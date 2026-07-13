import { describe, expect, it, vi } from "vitest";
import { listGoogleCalendarEvents, type GoogleCalendarConfig } from "./google";

const CONFIG: GoogleCalendarConfig = {
  clientId: "client-id",
  clientSecret: "client-secret",
  refreshToken: "refresh-token",
  calendarId: "primary",
  timeZone: "Europe/Helsinki",
};

describe("Google Calendar API availability reads", () => {
  it("requests only the event fields needed to calculate busy times", async () => {
    let eventsRequestUrl = "";
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === "https://oauth2.googleapis.com/token") {
        return new Response(JSON.stringify({ access_token: "access-token" }), {
          headers: { "content-type": "application/json" },
        });
      }

      eventsRequestUrl = url;
      return new Response(
        JSON.stringify({
          items: [
            {
              id: "event-1",
              summary: "Private appointment",
              description: "Private description",
              htmlLink: "https://www.google.com/calendar/event?eid=private",
              start: { dateTime: "2026-03-24T13:00:00+02:00" },
              end: { dateTime: "2026-03-24T14:00:00+02:00" },
              attendees: [{ email: "private@example.com" }],
            },
          ],
        }),
        { headers: { "content-type": "application/json" } },
      );
    });

    const events = await listGoogleCalendarEvents(
      CONFIG,
      {
        timeMinIso: "2026-03-23T00:00:00.000Z",
        timeMaxIso: "2026-03-30T00:00:00.000Z",
      },
      fetchMock,
    );

    const requestUrl = new URL(eventsRequestUrl);
    expect(requestUrl.searchParams.get("fields")).toBe("items(id,start,end)");
    expect(events).toHaveLength(1);
    expect(events[0]?.startDateTime).toBe("2026-03-24T13:00:00+02:00");
    expect(events[0]?.endDateTime).toBe("2026-03-24T14:00:00+02:00");
  });
});
