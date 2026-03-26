import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loginWithPassword, seedTestUsers } from "./helpers/auth";
import { MockD1Database } from "./helpers/mock-d1";

vi.mock("../.generated/styles.css", () => ({ default: "" }));
vi.mock("../src/favicon.ico", () => ({ default: new ArrayBuffer(0) }));

type WorkerFetch = (typeof import("../src/worker"))["default"]["fetch"];

interface TestEnv {
  DB: MockD1Database;
  SESSION_SECRET: string;
  APP_ENCRYPTION_SECRET?: string;
}

describe("google calendar scheduling", () => {
  let env: TestEnv;
  let fetchHandler: WorkerFetch;

  beforeEach(async () => {
    vi.resetModules();
    const workerModule = await import("../src/worker");
    fetchHandler = workerModule.default.fetch;
    env = {
      DB: new MockD1Database(),
      SESSION_SECRET: "test-secret",
      APP_ENCRYPTION_SECRET: "encryption-secret",
    };
    await seedTestUsers(env.DB, [{ name: "Advisor", password: "test-password", role: "editor" }]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows setup guidance when no stored google calendar credentials exist", async () => {
    const cookie = await loginWithPassword(fetchHandler, env, "Advisor", "test-password");
    const response = await fetchHandler(
      new Request("http://localhost/schedule", {
        headers: { cookie },
      }),
      env,
    );

    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain("Google Calendar Setup Needed");
    expect(body).toContain("Google client ID");
    expect(body).toContain("Google refresh token");
    expect(body).toContain("Google Calendar ID");
    expect(body).toContain("Data Tools");
  });

  it("can save encrypted database credentials and use them as the active calendar config", async () => {
    const cookie = await loginWithPassword(fetchHandler, env, "Advisor", "test-password");

    const saveResponse = await fetchHandler(
      new Request("http://localhost/actions/save-google-calendar-settings", {
        method: "POST",
        headers: { cookie },
        body: new URLSearchParams({
          clientId: "stored-client-id",
          clientSecret: "stored-client-secret",
          refreshToken: "stored-refresh-token",
          calendarId: "stored-calendar@example.com",
          timeZone: "America/New_York",
        }),
      }),
      env,
    );

    expect(saveResponse.status).toBe(302);
    expect(saveResponse.headers.get("location")).toBe("/data-tools?notice=Encrypted+Google+Calendar+settings+saved");
    expect(env.DB.appSecrets).toHaveLength(1);
    expect(env.DB.appSecrets[0]?.encrypted_value).not.toContain("stored-client-secret");
    expect(env.DB.appSecrets[0]?.encrypted_value).not.toContain("stored-refresh-token");

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === "https://oauth2.googleapis.com/token") {
        return jsonResponse({ access_token: "stored-access-token" });
      }

      if (url.startsWith("https://www.googleapis.com/calendar/v3/calendars/stored-calendar%40example.com/events")) {
        return jsonResponse({ items: [] });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const scheduleResponse = await fetchHandler(
      new Request("http://localhost/schedule?week=2026-03-23", {
        headers: { cookie },
      }),
      env,
    );

    const scheduleBody = await scheduleResponse.text();
    expect(scheduleResponse.status).toBe(200);
    expect(scheduleBody).toContain("Google Calendar timezone: America/New_York");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const dataToolsResponse = await fetchHandler(
      new Request("http://localhost/data-tools", {
        headers: { cookie },
      }),
      env,
    );

    const dataToolsBody = await dataToolsResponse.text();
    expect(dataToolsBody).toContain("Active source: encrypted database credentials saved from the app.");
    expect(dataToolsBody).toContain("Current calendar ID: stored-calendar@example.com");
    expect(dataToolsBody).toContain("Current timezone: America/New_York");
    expect(dataToolsBody).toContain('name="clientId"');
    expect(dataToolsBody).toContain('value="stored-client-id"');
    expect(dataToolsBody).toContain('name="clientSecret"');
    expect(dataToolsBody).toContain('value="stored-client-secret"');
    expect(dataToolsBody).toContain('name="refreshToken"');
    expect(dataToolsBody).toContain('value="stored-refresh-token"');
    expect(dataToolsBody).toContain('name="calendarId"');
    expect(dataToolsBody).toContain('value="stored-calendar@example.com"');
    expect(dataToolsBody).toContain('name="timeZone"');
    expect(dataToolsBody).toContain('value="America/New_York"');
  });

  it("can clear stored database credentials", async () => {
    const cookie = await loginWithPassword(fetchHandler, env, "Advisor", "test-password");

    await fetchHandler(
      new Request("http://localhost/actions/save-google-calendar-settings", {
        method: "POST",
        headers: { cookie },
        body: new URLSearchParams({
          clientId: "stored-client-id",
          clientSecret: "stored-client-secret",
          refreshToken: "stored-refresh-token",
          calendarId: "primary",
          timeZone: "Europe/Helsinki",
        }),
      }),
      env,
    );

    const clearResponse = await fetchHandler(
      new Request("http://localhost/actions/clear-google-calendar-settings", {
        method: "POST",
        headers: { cookie },
      }),
      env,
    );

    expect(clearResponse.status).toBe(302);
    expect(clearResponse.headers.get("location")).toBe("/data-tools?notice=Stored+Google+Calendar+settings+cleared");
    expect(env.DB.appSecrets).toHaveLength(0);
  });

  it("renders a weekly calendar view with existing events and available slot links", async () => {
    const cookie = await loginWithPassword(fetchHandler, env, "Advisor", "test-password");
    await saveGoogleCalendarSettings(fetchHandler, env, cookie, {
      clientId: "google-client-id",
      clientSecret: "google-client-secret",
      refreshToken: "google-refresh-token",
      calendarId: "primary",
      timeZone: "Europe/Helsinki",
    });
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === "https://oauth2.googleapis.com/token") {
        return jsonResponse({ access_token: "google-access-token" });
      }

      if (url.startsWith("https://www.googleapis.com/calendar/v3/calendars/primary/events")) {
        return jsonResponse({
          items: [
            {
              id: "existing-sync",
              summary: "Existing Sync",
              description: "Already booked",
              htmlLink: "https://calendar.google.com/calendar/event?eid=existing-sync",
              start: { dateTime: "2026-03-24T13:00:00+02:00" },
              end: { dateTime: "2026-03-24T14:00:00+02:00" },
              attendees: [{ email: "base@example.edu" }],
            },
          ],
        });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchHandler(
      new Request("http://localhost/schedule?student=1&week=2026-03-23", {
        headers: { cookie },
      }),
      env,
    );

    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain("Google Calendar Scheduling");
    expect(body).toContain("Scheduling for Base Student in Europe/Helsinki.");
    expect(body).toContain("Existing Sync");
    expect(body).toContain("13:00 - 14:00");
    expect(body).toContain("/schedule?week=2026-03-23&amp;student=1&amp;slot=2026-03-24T09%3A00");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows the sync error reason and hides the calendar grid when calendar sync fails", async () => {
    const cookie = await loginWithPassword(fetchHandler, env, "Advisor", "test-password");
    await saveGoogleCalendarSettings(fetchHandler, env, cookie, {
      clientId: "google-client-id",
      clientSecret: "google-client-secret",
      refreshToken: "google-refresh-token",
      calendarId: "primary",
      timeZone: "Europe/Helsinki",
    });

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === "https://oauth2.googleapis.com/token") {
        return jsonResponse({ access_token: "google-access-token" });
      }

      if (url.startsWith("https://www.googleapis.com/calendar/v3/calendars/primary/events")) {
        return new Response(JSON.stringify({ error: { message: "Forbidden" } }), {
          status: 403,
          headers: { "content-type": "application/json" },
        });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchHandler(
      new Request("http://localhost/schedule?student=1&week=2026-03-23&slot=2026-03-24T09:00", {
        headers: { cookie },
      }),
      env,
    );

    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain("Google Calendar sync failed: Google Calendar event list failed with status 403: Forbidden");
    expect(body).toContain("Google Calendar Sync Unavailable");
    expect(body).not.toContain("Calendar Week");
    expect(body).not.toContain("Create Google Calendar event");
    expect(body).toContain("Calendar availability is unavailable until Google Calendar sync starts working again.");
  });

  it("shows OAuth token refresh details like invalid_grant when token refresh fails", async () => {
    const cookie = await loginWithPassword(fetchHandler, env, "Advisor", "test-password");
    await saveGoogleCalendarSettings(fetchHandler, env, cookie, {
      clientId: "google-client-id",
      clientSecret: "google-client-secret",
      refreshToken: "google-refresh-token",
      calendarId: "primary",
      timeZone: "Europe/Helsinki",
    });

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === "https://oauth2.googleapis.com/token") {
        return new Response(
          JSON.stringify({
            error: "invalid_grant",
            error_description: "Token has been expired or revoked.",
          }),
          {
            status: 400,
            headers: { "content-type": "application/json" },
          },
        );
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchHandler(
      new Request("http://localhost/schedule?week=2026-03-23", {
        headers: { cookie },
      }),
      env,
    );

    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain(
      "Google Calendar sync failed: Google OAuth token refresh failed with status 400: invalid_grant: Token has been expired or revoked.",
    );
    expect(body).toContain("Google Calendar Sync Unavailable");
    expect(body).not.toContain("Calendar Week");
  });

  it("creates an event, stores the invite email, and updates the student's next meeting", async () => {
    env.DB.students[0]!.email = null;

    const cookie = await loginWithPassword(fetchHandler, env, "Advisor", "test-password");
    await saveGoogleCalendarSettings(fetchHandler, env, cookie, {
      clientId: "google-client-id",
      clientSecret: "google-client-secret",
      refreshToken: "google-refresh-token",
      calendarId: "primary",
      timeZone: "Europe/Helsinki",
    });
    let createdEventPayload: Record<string, unknown> | null = null;

    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === "https://oauth2.googleapis.com/token") {
        return jsonResponse({ access_token: "google-access-token" });
      }

      if (url.startsWith("https://www.googleapis.com/calendar/v3/calendars/primary/events")) {
        createdEventPayload = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
        return jsonResponse({
          id: "created-event",
          summary: createdEventPayload.summary,
          description: createdEventPayload.description,
          htmlLink: "https://calendar.google.com/calendar/event?eid=created-event",
          start: { dateTime: "2026-03-24T09:00:00+02:00" },
          end: { dateTime: "2026-03-24T10:00:00+02:00" },
          attendees: [{ email: "student@example.edu" }],
        });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchHandler(
      new Request("http://localhost/actions/schedule-meeting", {
        method: "POST",
        headers: { cookie },
        body: new URLSearchParams({
          returnTo: "/schedule?week=2026-03-23&student=1&slot=2026-03-24T09:00",
          studentId: "1",
          week: "2026-03-23",
          slotStart: "2026-03-24T09:00",
          slotEnd: "2026-03-24T10:00",
          title: "Thesis supervision sync",
          meetingEmail: "student@example.edu",
          description: "Discuss the next milestone",
        }),
      }),
      env,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/schedule?week=2026-03-23&student=1&notice=Meeting+scheduled");
    expect(createdEventPayload).toEqual({
      summary: "Thesis supervision sync",
      description: "Discuss the next milestone",
      start: {
        dateTime: "2026-03-24T09:00",
        timeZone: "Europe/Helsinki",
      },
      end: {
        dateTime: "2026-03-24T10:00",
        timeZone: "Europe/Helsinki",
      },
      attendees: [{ email: "student@example.edu" }],
    });
    expect(env.DB.students[0]?.email).toBe("student@example.edu");
    expect(env.DB.students[0]?.next_meeting_at).toBe("2026-03-24T07:00:00.000Z");
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}

async function saveGoogleCalendarSettings(
  fetchHandler: WorkerFetch,
  env: TestEnv,
  cookie: string,
  input: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    calendarId: string;
    timeZone?: string;
  },
): Promise<void> {
  const response = await fetchHandler(
    new Request("http://localhost/actions/save-google-calendar-settings", {
      method: "POST",
      headers: { cookie },
      body: new URLSearchParams({
        clientId: input.clientId,
        clientSecret: input.clientSecret,
        refreshToken: input.refreshToken,
        calendarId: input.calendarId,
        timeZone: input.timeZone || "",
      }),
    }),
    env,
  );

  expect(response.status).toBe(302);
}
