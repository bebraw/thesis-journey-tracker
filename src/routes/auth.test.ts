import { beforeEach, describe, expect, it, vi } from "vitest";
import { seedTestUsers, loginWithPassword } from "../../tests/helpers/auth";
import { MockD1Database } from "../../tests/helpers/mock-d1";
import { sameOriginRequest } from "../../tests/helpers/request";

vi.mock("../../.generated/styles.css", () => ({ default: "" }));
vi.mock("../favicon.ico", () => ({ default: new ArrayBuffer(0) }));

type WorkerFetch = (typeof import("../worker"))["default"]["fetch"];

describe("multi-user access control", () => {
  let env: { DB: MockD1Database; SESSION_SECRET: string; APP_ENCRYPTION_SECRET: string };
  let fetchHandler: WorkerFetch;

  beforeEach(async () => {
    vi.resetModules();
    const workerModule = await import("../worker");
    fetchHandler = workerModule.default.fetch;
    env = {
      DB: new MockD1Database(),
      SESSION_SECRET: "test-session-secret-with-at-least-32-bytes",
      APP_ENCRYPTION_SECRET: "test-app-encryption-secret-with-32-bytes",
    };
    await seedTestUsers(env.DB, [
      { name: "Advisor", password: "editor-password", role: "editor" },
      { name: "Professor", password: "readonly-password", role: "readonly" },
    ]);
  });

  it("serves a CSP-compatible application shell with security headers", async () => {
    const loginResponse = await fetchHandler(new Request("http://localhost/login"), env);
    const loginBody = await loginResponse.text();

    expect(loginResponse.headers.get("content-security-policy")).toContain("script-src 'self'");
    expect(loginResponse.headers.get("x-content-type-options")).toBe("nosniff");
    expect(loginResponse.headers.has("strict-transport-security")).toBe(false);
    expect(loginBody).toContain('<script src="/app.js"></script>');
    expect(loginBody).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
    expect(loginBody).not.toMatch(/\son[a-z]+=/i);

    const appScriptResponse = await fetchHandler(new Request("http://localhost/app.js"), env);
    const appScript = await appScriptResponse.text();
    expect(appScriptResponse.headers.get("content-type")).toBe("application/javascript; charset=utf-8");
    expect(appScriptResponse.headers.get("cache-control")).toBe("no-cache");
    expect(appScriptResponse.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(appScript).toContain("data-auto-submit");
    expect(appScript).toContain("data-confirm-message");

    const secureResponse = await fetchHandler(new Request("https://tracker.example.edu/login"), env);
    expect(secureResponse.headers.get("strict-transport-security")).toBe("max-age=31536000");
  });

  it("pins D1 sessions to the primary and retires legacy client bookmarks", async () => {
    const ordinaryResponse = await fetchHandler(new Request("http://localhost/styles.css"), env);
    expect(ordinaryResponse.headers.getSetCookie()).toEqual([]);
    expect(env.DB.sessionConstraints).toEqual(["first-primary"]);

    env.DB.sessionConstraints = [];
    const legacyResponse = await fetchHandler(
      new Request("https://tracker.example.edu/login", {
        headers: { cookie: "thesis_d1_bookmark=attacker-controlled-bookmark" },
      }),
      env,
    );

    expect(env.DB.sessionConstraints).toEqual(["first-primary"]);
    expect(legacyResponse.headers.get("cache-control")).toBe("no-store");
    expect(legacyResponse.headers.getSetCookie()).toEqual([
      expect.stringContaining(
        "thesis_d1_bookmark=; HttpOnly; Secure; Path=/; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0",
      ),
    ]);
  });

  it("rejects missing and cross-origin mutations before any database access", async () => {
    const requests = [
      new Request("https://tracker.example.edu/login", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ name: "Advisor", password: "wrong-password" }),
      }),
      new Request("https://tracker.example.edu/actions/add-student", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          origin: "https://attacker.example",
        },
        body: new URLSearchParams({ name: "Injected Student", degreeType: "msc" }),
      }),
    ];

    for (const request of requests) {
      const response = await fetchHandler(request, env);

      expect(response.status).toBe(403);
      await expect(response.text()).resolves.toBe("Forbidden");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
      expect(response.headers.get("strict-transport-security")).toBe("max-age=31536000");
      expect(response.headers.has("set-cookie")).toBe(false);
    }

    expect(env.DB.calls).toHaveLength(0);
    expect(env.DB.loginAttempts).toHaveLength(0);
    expect(env.DB.students).toHaveLength(1);
    expect(env.DB.appUsers.map((user) => user.session_version)).toEqual([1, 1]);
  });

  it("shows a readonly dashboard for readonly accounts", async () => {
    const cookie = await loginWithPassword(fetchHandler, env, "Professor", "readonly-password");
    expect(cookie.startsWith("thesis_session=")).toBe(true);

    const response = await fetchHandler(
      new Request("http://localhost/", {
        headers: { cookie },
      }),
      env,
    );

    const body = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("script-src-attr 'none'");
    expect(body).toContain("Signed in as Professor");
    expect(body).toContain('<script src="/dashboard.js" defer></script>');
    expect(body).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
    expect(body).not.toMatch(/\son[a-z]+=/i);
    expect(body).toContain("Read-only");
    expect(body).toContain("Base Student");
    expect(body).not.toContain("Add student");
    expect(body).not.toContain("Data tools");
    expect(body).toContain("Select a student from the table to view details, supervision logs, and phase history.");
  });

  it("counts only active students in the dashboard tracked metric", async () => {
    const cookie = await loginWithPassword(fetchHandler, env, "Advisor", "editor-password");
    expect(cookie.startsWith("thesis_session=")).toBe(true);

    env.DB.students.push({
      id: 2,
      name: "Archived Student",
      email: "archived@example.edu",
      degree_type: "msc",
      thesis_topic: "Archived topic",
      student_notes: null,
      start_date: "2025-01-01",
      current_phase: "submitted",
      next_meeting_at: null,
      archived_at: "2026-05-01T00:00:00.000Z",
    });

    const response = await fetchHandler(
      new Request("http://localhost/", {
        headers: { cookie },
      }),
      env,
    );

    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toMatch(/Students tracked[\s\S]*?text-2xl[^>]*>1<\/p>[\s\S]*?Active thesis records\./);
    expect(body).not.toContain("All active and archived thesis records.");
    expect(body).not.toContain("Archived Student");
  });

  it("renders the student partial for readonly accounts", async () => {
    const cookie = await loginWithPassword(fetchHandler, env, "Professor", "readonly-password");
    expect(cookie.startsWith("thesis_session=")).toBe(true);

    env.DB.meetingLogs.push({
      id: 1,
      student_id: 1,
      happened_at: "2026-03-22T09:00:00.000Z",
      discussed: "Initial review",
      agreed_plan: "Write chapter 1",
      next_step_deadline: "2026-03-29",
    });
    env.DB.phaseAuditEntries.push({
      id: 1,
      student_id: 1,
      changed_at: "2026-03-21T12:00:00.000Z",
      from_phase: "research_plan",
      to_phase: "researching",
    });

    const response = await fetchHandler(
      new Request("http://localhost/partials/student/1", {
        headers: { cookie },
      }),
      env,
    );

    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain("Student Overview");
    expect(body).toContain("Read-only access to details, supervision logs, and the phase timeline.");
    expect(body).toContain("Base Student");
    expect(body).toContain("base@example.edu");
    expect(body).toContain("Baseline supervision topic");
    expect(body).toContain("Baseline student note");
    expect(body).toContain("2026-07-01");
    expect(body).toContain("Initial review");
    expect(body).toContain("Planning research -&gt; Researching");
    expect(body).not.toContain("Save student updates");
    expect(body).not.toContain("Delete Student");
    expect(body).not.toContain("Archive Student");
  });

  it("blocks readonly accounts from editor-only pages and mutations", async () => {
    const cookie = await loginWithPassword(fetchHandler, env, "Professor", "readonly-password");
    expect(cookie.startsWith("thesis_session=")).toBe(true);

    const dataToolsResponse = await fetchHandler(
      new Request("http://localhost/data-tools", {
        headers: { cookie },
      }),
      env,
    );

    expect(dataToolsResponse.status).toBe(302);
    expect(dataToolsResponse.headers.get("location")).toBe("/?error=Read-only+access");

    const scheduleResponse = await fetchHandler(
      new Request("http://localhost/schedule", {
        headers: { cookie },
      }),
      env,
    );

    expect(scheduleResponse.status).toBe(302);
    expect(scheduleResponse.headers.get("location")).toBe("/?error=Read-only+access");

    const updateResponse = await fetchHandler(
      sameOriginRequest("http://localhost/actions/update-student/1", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie,
        },
        body: new URLSearchParams({
          name: "Readonly Attempt",
          studentEmail: "readonly@example.edu",
          degreeType: "msc",
          thesisTopic: "Should not save",
          startDate: "",
          currentPhase: "editing",
          nextMeetingAt: "",
        }),
      }),
      env,
    );

    expect(updateResponse.status).toBe(302);
    expect(updateResponse.headers.get("location")).toBe("/?selected=1&error=Read-only+access");

    const scheduleMeetingResponse = await fetchHandler(
      sameOriginRequest("http://localhost/actions/schedule-meeting", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie,
        },
        body: new URLSearchParams({
          returnTo: "/schedule?week=2026-03-23&student=1&slot=2026-03-24T09:00",
          studentId: "1",
          week: "2026-03-23",
          slotStart: "2026-03-24T09:00",
          slotEnd: "2026-03-24T10:00",
          title: "Readonly Attempt",
          meetingEmail: "readonly@example.edu",
        }),
      }),
      env,
    );

    expect(scheduleMeetingResponse.status).toBe(302);
    expect(scheduleMeetingResponse.headers.get("location")).toBe(
      "/schedule?week=2026-03-23&student=1&slot=2026-03-24T09:00&error=Read-only+access",
    );

    const saveCalendarSettingsResponse = await fetchHandler(
      sameOriginRequest("http://localhost/actions/save-google-calendar-settings", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie,
        },
        body: new URLSearchParams({
          clientId: "readonly-client-id",
          clientSecret: "readonly-client-secret",
          refreshToken: "readonly-refresh-token",
          calendarId: "primary",
          timeZone: "Europe/Helsinki",
        }),
      }),
      env,
    );

    expect(saveCalendarSettingsResponse.status).toBe(302);
    expect(saveCalendarSettingsResponse.headers.get("location")).toBe("/?error=Read-only+access");

    const saveCalendarIcalSettingsResponse = await fetchHandler(
      sameOriginRequest("http://localhost/actions/save-google-calendar-ical-settings", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie,
        },
        body: new URLSearchParams({
          iCalUrl: "https://calendar.google.com/calendar/ical/example/basic.ics",
          timeZone: "Europe/Helsinki",
        }),
      }),
      env,
    );

    expect(saveCalendarIcalSettingsResponse.status).toBe(302);
    expect(saveCalendarIcalSettingsResponse.headers.get("location")).toBe("/?error=Read-only+access");

    const saveDashboardLaneSettingsResponse = await fetchHandler(
      sameOriginRequest("http://localhost/actions/save-dashboard-lane-settings", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie,
        },
        body: new URLSearchParams({
          laneLabel0: "Early work",
        }),
      }),
      env,
    );

    expect(saveDashboardLaneSettingsResponse.status).toBe(302);
    expect(saveDashboardLaneSettingsResponse.headers.get("location")).toBe("/?error=Read-only+access");

    const clearCalendarSettingsResponse = await fetchHandler(
      sameOriginRequest("http://localhost/actions/clear-google-calendar-settings", {
        method: "POST",
        headers: {
          cookie,
        },
      }),
      env,
    );

    expect(clearCalendarSettingsResponse.status).toBe(302);
    expect(clearCalendarSettingsResponse.headers.get("location")).toBe("/?error=Read-only+access");

    const clearCalendarOAuthResponse = await fetchHandler(
      sameOriginRequest("http://localhost/actions/clear-google-calendar-oauth-settings", {
        method: "POST",
        headers: {
          cookie,
        },
      }),
      env,
    );

    expect(clearCalendarOAuthResponse.status).toBe(302);
    expect(clearCalendarOAuthResponse.headers.get("location")).toBe("/?error=Read-only+access");

    const clearCalendarIcalResponse = await fetchHandler(
      sameOriginRequest("http://localhost/actions/clear-google-calendar-ical-settings", {
        method: "POST",
        headers: {
          cookie,
        },
      }),
      env,
    );

    expect(clearCalendarIcalResponse.status).toBe(302);
    expect(clearCalendarIcalResponse.headers.get("location")).toBe("/?error=Read-only+access");

    const resetDashboardLaneSettingsResponse = await fetchHandler(
      sameOriginRequest("http://localhost/actions/reset-dashboard-lane-settings", {
        method: "POST",
        headers: {
          cookie,
        },
      }),
      env,
    );

    expect(resetDashboardLaneSettingsResponse.status).toBe(302);
    expect(resetDashboardLaneSettingsResponse.headers.get("location")).toBe("/?error=Read-only+access");
    expect(env.DB.students[0]?.name).toBe("Base Student");
    expect(env.DB.phaseAuditEntries).toHaveLength(0);
  });

  it("still allows editor accounts with database-backed users", async () => {
    const cookie = await loginWithPassword(fetchHandler, env, "Advisor", "editor-password");
    expect(cookie.startsWith("thesis_session=")).toBe(true);

    const response = await fetchHandler(
      sameOriginRequest("http://localhost/actions/add-student", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie,
        },
        body: new URLSearchParams({
          name: "Second Student",
          studentEmail: "second@example.edu",
          degreeType: "msc",
          thesisTopic: "Allowed change",
          studentNotes: "Created from access-control test",
          startDate: "2026-03-01",
          currentPhase: "research_plan",
          nextMeetingAt: "",
        }),
      }),
      env,
    );

    expect(response.status).toBe(302);
    expect(env.DB.students).toHaveLength(2);
    expect(env.DB.students[1]?.name).toBe("Second Student");
    expect(env.DB.students[1]?.student_notes).toBe("Created from access-control test");
    expect(env.DB.students[1]?.start_date).toBe("2026-03-01");
  });

  it("allows creating a student with only the required name field", async () => {
    const cookie = await loginWithPassword(fetchHandler, env, "Advisor", "editor-password");
    expect(cookie.startsWith("thesis_session=")).toBe(true);

    const response = await fetchHandler(
      sameOriginRequest("http://localhost/actions/add-student", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie,
        },
        body: new URLSearchParams({
          name: "Minimal Student",
          studentEmail: "",
          degreeType: "msc",
          thesisTopic: "",
          startDate: "",
          currentPhase: "research_plan",
          nextMeetingAt: "",
        }),
      }),
      env,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/?selected=");
    expect(env.DB.students).toHaveLength(2);
    expect(env.DB.students[1]?.name).toBe("Minimal Student");
    expect(env.DB.students[1]?.start_date).toBeNull();
  });

  it("allows clearing a saved next meeting time from the student update form", async () => {
    const cookie = await loginWithPassword(fetchHandler, env, "Advisor", "editor-password");
    expect(cookie.startsWith("thesis_session=")).toBe(true);

    env.DB.students[0].next_meeting_at = "2026-04-10T09:00:00.000Z";

    const response = await fetchHandler(
      sameOriginRequest("http://localhost/actions/update-student/1", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie,
        },
        body: new URLSearchParams({
          name: "Base Student",
          studentEmail: "base@example.edu",
          degreeType: "msc",
          thesisTopic: "Baseline supervision topic",
          studentNotes: "Baseline student note",
          startDate: "2026-01-01",
          currentPhase: "researching",
          nextMeetingAt: "2026-04-10T12:00",
          clearNextMeetingAt: "yes",
        }),
      }),
      env,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("notice=Student+updated");
    expect(env.DB.students[0]?.next_meeting_at).toBeNull();
  });

  it("can save a possible next meeting time together with a meeting log", async () => {
    const cookie = await loginWithPassword(fetchHandler, env, "Advisor", "editor-password");
    expect(cookie.startsWith("thesis_session=")).toBe(true);

    const response = await fetchHandler(
      sameOriginRequest("http://localhost/actions/add-log/1", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie,
        },
        body: new URLSearchParams({
          returnTo: "/?selected=1",
          happenedAt: "2026-04-01T10:00",
          nextMeetingAt: "2026-04-08T12:00",
          discussed: "Reviewed current draft",
          agreedPlan: "Send revised introduction",
          nextStepDeadline: "",
        }),
      }),
      env,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/?selected=1&notice=Log+saved");
    expect(env.DB.meetingLogs).toHaveLength(1);
    expect(env.DB.students[0]?.next_meeting_at).toBe("2026-04-08T09:00:00.000Z");
  });

  it("returns user-facing errors when dashboard mutations fail", async () => {
    const cookie = await loginWithPassword(fetchHandler, env, "Advisor", "editor-password");
    expect(cookie.startsWith("thesis_session=")).toBe(true);

    env.DB.failQueries.push(/^INSERT INTO students/);
    const addStudentResponse = await fetchHandler(
      sameOriginRequest("http://localhost/actions/add-student", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie,
        },
        body: new URLSearchParams({
          name: "Broken Student",
          studentEmail: "broken@example.edu",
          degreeType: "msc",
          thesisTopic: "Will not save",
          studentNotes: "Should fail cleanly",
          startDate: "2026-03-01",
          currentPhase: "research_plan",
          nextMeetingAt: "",
        }),
      }),
      env,
    );
    expect(addStudentResponse.status).toBe(302);
    expect(addStudentResponse.headers.get("location")).toBe("/students/new?error=Failed+to+save+student");
    expect(env.DB.students).toHaveLength(1);

    env.DB.failQueries = [/^INSERT INTO meeting_logs/];
    const addLogResponse = await fetchHandler(
      sameOriginRequest("http://localhost/actions/add-log/1", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie,
        },
        body: new URLSearchParams({
          returnTo: "/?selected=1",
          happenedAt: "",
          discussed: "Review progress",
          agreedPlan: "Finish chapter 2",
          nextStepDeadline: "",
        }),
      }),
      env,
    );
    expect(addLogResponse.status).toBe(302);
    expect(addLogResponse.headers.get("location")).toBe("/?selected=1&error=Failed+to+save+log");
    expect(env.DB.meetingLogs).toHaveLength(0);
    expect(env.DB.students[0]?.next_meeting_at).toBeNull();

    env.DB.failQueries = ["UPDATE students SET next_meeting_at = ? WHERE id = ?"];
    const addLogWithMeetingUpdateResponse = await fetchHandler(
      sameOriginRequest("http://localhost/actions/add-log/1", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie,
        },
        body: new URLSearchParams({
          returnTo: "/?selected=1",
          happenedAt: "",
          nextMeetingAt: "2026-04-08T12:00",
          discussed: "Review progress",
          agreedPlan: "Finish chapter 2",
          nextStepDeadline: "",
        }),
      }),
      env,
    );
    expect(addLogWithMeetingUpdateResponse.status).toBe(302);
    expect(addLogWithMeetingUpdateResponse.headers.get("location")).toBe("/?selected=1&error=Failed+to+save+log");
    expect(env.DB.meetingLogs).toHaveLength(0);
    expect(env.DB.students[0]?.next_meeting_at).toBeNull();

    env.DB.failQueries = ["UPDATE students SET archived_at = ? WHERE id = ? AND archived_at IS NULL"];
    const archiveResponse = await fetchHandler(
      sameOriginRequest("http://localhost/actions/archive-student/1", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie,
        },
        body: new URLSearchParams(),
      }),
      env,
    );
    expect(archiveResponse.status).toBe(302);
    expect(archiveResponse.headers.get("location")).toBe("/?error=Failed+to+archive+student");
    expect(env.DB.students[0]?.archived_at).toBeNull();

    env.DB.failQueries = [];
  });

  it("throttles repeated failures without allowing an attacker to block valid credentials", async () => {
    const loginHeaders = {
      "cf-connecting-ip": "203.0.113.10",
      "content-type": "application/x-www-form-urlencoded",
    };

    for (let attemptIndex = 0; attemptIndex < 4; attemptIndex += 1) {
      const failedResponse = await fetchHandler(
        sameOriginRequest("https://tracker.example.com/login", {
          method: "POST",
          headers: loginHeaders,
          body: new URLSearchParams({
            name: "Advisor",
            password: "wrong-password",
          }),
        }),
        env,
      );

      expect(failedResponse.status).toBe(302);
      expect(failedResponse.headers.get("location")).toBe("/login?error=1");
    }

    const lockoutResponse = await fetchHandler(
      sameOriginRequest("https://tracker.example.com/login", {
        method: "POST",
        headers: loginHeaders,
        body: new URLSearchParams({
          name: "Advisor",
          password: "wrong-password",
        }),
      }),
      env,
    );

    expect(lockoutResponse.status).toBe(302);
    expect(lockoutResponse.headers.get("location")).toBe("/login?error=rate_limit");
    const accountAttempt = env.DB.loginAttempts.find((attempt) => attempt.attempt_key.startsWith("account:"));
    const clientAttempt = env.DB.loginAttempts.find((attempt) => attempt.attempt_key.startsWith("client:"));
    expect(accountAttempt?.failure_count).toBe(5);
    expect(accountAttempt?.locked_until).toBeTruthy();
    expect(accountAttempt?.attempt_key).toMatch(/^account:[A-Za-z0-9_-]{43}$/);
    expect(accountAttempt?.attempt_key).not.toContain("Advisor");
    expect(accountAttempt?.attempt_key).not.toContain(":1");
    expect(clientAttempt?.failure_count).toBe(5);
    expect(clientAttempt?.locked_until).toBeNull();
    expect(clientAttempt?.attempt_key).not.toContain("203.0.113.10");

    const validLoginResponse = await fetchHandler(
      sameOriginRequest("https://tracker.example.com/login", {
        method: "POST",
        headers: loginHeaders,
        body: new URLSearchParams({
          name: "Advisor",
          password: "editor-password",
        }),
      }),
      env,
    );

    expect(validLoginResponse.status).toBe(302);
    expect(validLoginResponse.headers.get("location")).toBe("/");
    expect(validLoginResponse.headers.get("set-cookie")).toContain("thesis_session=");
    expect(env.DB.loginAttempts).toHaveLength(1);
    expect(env.DB.loginAttempts[0]?.attempt_key).toMatch(/^client:/);
  });

  it("returns the same failure sequence for known and unknown account names", async () => {
    const attemptLocations = async (name: string): Promise<Array<string | null>> => {
      const locations: Array<string | null> = [];
      for (let attemptIndex = 0; attemptIndex < 5; attemptIndex += 1) {
        const response = await fetchHandler(
          sameOriginRequest("https://tracker.example.com/login", {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ name, password: "wrong-password" }),
          }),
          env,
        );
        locations.push(response.headers.get("location"));
      }
      return locations;
    };

    const knownSequence = await attemptLocations("Advisor");
    const unknownSequence = await attemptLocations("Unknown account");

    expect(knownSequence).toEqual(["/login?error=1", "/login?error=1", "/login?error=1", "/login?error=1", "/login?error=rate_limit"]);
    expect(unknownSequence).toEqual(knownSequence);
    const accountKeys = env.DB.loginAttempts
      .filter((attempt) => attempt.attempt_key.startsWith("account:"))
      .map((attempt) => attempt.attempt_key);
    expect(accountKeys).toHaveLength(2);
    expect(accountKeys.every((key) => /^account:[A-Za-z0-9_-]{43}$/.test(key))).toBe(true);
    expect(accountKeys.join(" ")).not.toContain("Advisor");
    expect(accountKeys.join(" ")).not.toContain("Unknown account");
  });

  it("requires password verification for localhost requests", async () => {
    const loginPageResponse = await fetchHandler(new Request("http://localhost/login"), env);
    const loginPageBody = await loginPageResponse.text();

    expect(loginPageResponse.status).toBe(200);
    expect(loginPageBody).toContain("Sign in");
    expect(loginPageBody).toContain('name="password"');

    const missingPasswordResponse = await fetchHandler(
      sameOriginRequest("http://localhost/login", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          name: "Advisor",
        }),
      }),
      env,
    );

    expect(missingPasswordResponse.status).toBe(302);
    expect(missingPasswordResponse.headers.get("location")).toBe("/login?error=1");
    expect(missingPasswordResponse.headers.get("set-cookie")).toBeNull();
    expect(env.DB.loginAttempts).toHaveLength(2);

    const validPasswordResponse = await fetchHandler(
      sameOriginRequest("http://localhost/login", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          name: "Advisor",
          password: "editor-password",
        }),
      }),
      env,
    );

    expect(validPasswordResponse.status).toBe(302);
    expect(validPasswordResponse.headers.get("location")).toBe("/");
    expect(validPasswordResponse.headers.get("set-cookie")).toContain("thesis_session=");
    expect(env.DB.loginAttempts).toHaveLength(1);
    expect(env.DB.loginAttempts[0]?.attempt_key).toMatch(/^client:/);
  });

  it("fails closed without strong independent runtime secrets", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await fetchHandler(new Request("https://tracker.example.com/login"), {
      ...env,
      SESSION_SECRET: "short",
      APP_ENCRYPTION_SECRET: "short",
    });

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Security configuration is invalid.");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(response.headers.get("strict-transport-security")).toBe("max-age=31536000");
    expect(consoleError).toHaveBeenCalledWith("Invalid security configuration", expect.stringContaining("SESSION_SECRET"));
    consoleError.mockRestore();
  });

  it("rejects oversized login requests before password verification", async () => {
    const response = await fetchHandler(
      sameOriginRequest("https://tracker.example.com/login", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          name: "Advisor",
          password: "x".repeat(17 * 1024),
        }),
      }),
      env,
    );

    expect(response.status).toBe(413);
    expect(await response.text()).toBe("Request body too large");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(response.headers.get("strict-transport-security")).toBe("max-age=31536000");
    expect(env.DB.loginAttempts).toHaveLength(0);
  });

  it("does not lock out a different user before the shared client limit is reached", async () => {
    const loginHeaders = {
      "cf-connecting-ip": "203.0.113.10",
      "content-type": "application/x-www-form-urlencoded",
    };

    for (let attemptIndex = 0; attemptIndex < 5; attemptIndex += 1) {
      const failedResponse = await fetchHandler(
        sameOriginRequest("https://tracker.example.com/login", {
          method: "POST",
          headers: loginHeaders,
          body: new URLSearchParams({
            name: "Advisor",
            password: "wrong-password",
          }),
        }),
        env,
      );

      expect(failedResponse.status).toBe(302);
    }

    expect(env.DB.loginAttempts).toHaveLength(2);
    expect(env.DB.loginAttempts.some((attempt) => attempt.attempt_key.startsWith("account:"))).toBe(true);
    expect(env.DB.loginAttempts.some((attempt) => attempt.attempt_key.startsWith("client:"))).toBe(true);

    const differentUserResponse = await fetchHandler(
      sameOriginRequest("https://tracker.example.com/login", {
        method: "POST",
        headers: loginHeaders,
        body: new URLSearchParams({
          name: "Professor",
          password: "readonly-password",
        }),
      }),
      env,
    );

    expect(differentUserResponse.status).toBe(302);
    expect(differentUserResponse.headers.get("location")).toBe("/");
    expect(differentUserResponse.headers.get("set-cookie")).toContain("thesis_session=");
    expect(env.DB.loginAttempts).toHaveLength(2);
  });

  it("keeps a client throttle after valid login and ignores forwarded-header spoofing", async () => {
    let finalResponse: Response | null = null;
    for (let attemptIndex = 0; attemptIndex < 20; attemptIndex += 1) {
      finalResponse = await fetchHandler(
        sameOriginRequest("https://tracker.example.com/login", {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            "x-forwarded-for": `203.0.113.${attemptIndex + 1}`,
            "cf-connecting-ip": `198.51.100.${attemptIndex + 1}`,
          },
          body: new URLSearchParams({
            name: `Unknown user ${attemptIndex}`,
            password: "wrong-password",
          }),
        }),
        env,
      );
    }

    expect(finalResponse?.headers.get("location")).toBe("/login?error=rate_limit");
    const clientAttempt = env.DB.loginAttempts.find((attempt) => attempt.attempt_key.startsWith("client:"));
    const accountAttempts = env.DB.loginAttempts.filter((attempt) => attempt.attempt_key.startsWith("account:"));
    expect(clientAttempt?.failure_count).toBe(20);
    expect(clientAttempt?.locked_until).toBeTruthy();
    expect(accountAttempts).toHaveLength(20);
    expect(accountAttempts.every((attempt) => attempt.failure_count === 1 && attempt.locked_until === null)).toBe(true);

    const validLoginResponse = await fetchHandler(
      sameOriginRequest("https://tracker.example.com/login", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ name: "Advisor", password: "editor-password" }),
      }),
      env,
    );
    expect(validLoginResponse.headers.get("location")).toBe("/");
    expect(validLoginResponse.headers.get("set-cookie")).toContain("thesis_session=");
    expect(clientAttempt?.locked_until).toBeTruthy();

    const nextInvalidResponse = await fetchHandler(
      sameOriginRequest("https://tracker.example.com/login", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ name: "Advisor", password: "wrong-password" }),
      }),
      env,
    );
    expect(nextInvalidResponse.headers.get("location")).toBe("/login?error=rate_limit");
  });

  it("locks an account after failures from different trusted client addresses", async () => {
    for (let attemptIndex = 0; attemptIndex < 5; attemptIndex += 1) {
      const request = sameOriginRequest("https://tracker.example.com/login", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "cf-connecting-ip": `203.0.113.${attemptIndex + 1}`,
        },
        body: new URLSearchParams({ name: "Advisor", password: "wrong-password" }),
      });
      Object.defineProperty(request, "cf", { value: { colo: "HEL" } });
      const response = await fetchHandler(request, env);
      expect(response.status).toBe(302);
    }

    const accountAttempt = env.DB.loginAttempts.find((attempt) => attempt.attempt_key.startsWith("account:"));
    const clientAttempts = env.DB.loginAttempts.filter((attempt) => attempt.attempt_key.startsWith("client:"));
    expect(accountAttempt?.failure_count).toBe(5);
    expect(accountAttempt?.locked_until).toBeTruthy();
    expect(clientAttempts).toHaveLength(5);
  });

  it("clears the session and D1 bookmark cookies on logout", async () => {
    const cookie = await loginWithPassword(fetchHandler, env, "Advisor", "editor-password");
    expect(cookie.startsWith("thesis_session=")).toBe(true);

    const response = await fetchHandler(
      sameOriginRequest("http://localhost/logout", {
        method: "POST",
        headers: {
          cookie: `${cookie}; thesis_d1_bookmark=bookmark-value`,
        },
      }),
      env,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/login");

    const setCookies = response.headers.getSetCookie();
    expect(setCookies).toHaveLength(2);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(
      setCookies.some(
        (value) =>
          value.includes("thesis_session=") && value.includes("Expires=Thu, 01 Jan 1970 00:00:00 GMT") && value.includes("Max-Age=0"),
      ),
    ).toBe(true);
    expect(
      setCookies.some(
        (value) =>
          value.includes("thesis_d1_bookmark=") && value.includes("Expires=Thu, 01 Jan 1970 00:00:00 GMT") && value.includes("Max-Age=0"),
      ),
    ).toBe(true);

    expect(env.DB.appUsers.find((user) => user.name === "Advisor")?.session_version).toBe(2);
    const replayResponse = await fetchHandler(
      new Request("http://localhost/", {
        headers: { cookie },
      }),
      env,
    );
    expect(replayResponse.status).toBe(302);
    expect(replayResponse.headers.get("location")).toBe("/login");
  });

  it("resolves the current role and account existence from D1 for every request", async () => {
    const cookie = await loginWithPassword(fetchHandler, env, "Advisor", "editor-password");
    const advisor = env.DB.appUsers.find((user) => user.name === "Advisor")!;
    advisor.role = "readonly";

    const roleChangedResponse = await fetchHandler(
      new Request("http://localhost/data-tools", { headers: { cookie } }),
      env,
    );
    expect(roleChangedResponse.status).toBe(302);
    expect(roleChangedResponse.headers.get("location")).toBe("/?error=Read-only+access");

    env.DB.appUsers = env.DB.appUsers.filter((user) => user.id !== advisor.id);
    const deletedAccountResponse = await fetchHandler(
      new Request("http://localhost/", { headers: { cookie } }),
      env,
    );
    expect(deletedAccountResponse.status).toBe(302);
    expect(deletedAccountResponse.headers.get("location")).toBe("/login");
  });

  it("shows the style guide only on local development hosts", async () => {
    const cookie = await loginWithPassword(fetchHandler, env, "Advisor", "editor-password");
    expect(cookie.startsWith("thesis_session=")).toBe(true);

    const localDashboardResponse = await fetchHandler(
      new Request("http://localhost/", {
        headers: { cookie },
      }),
      env,
    );

    const localDashboardBody = await localDashboardResponse.text();
    expect(localDashboardResponse.status).toBe(200);
    expect(localDashboardBody).toContain("Style guide");

    const remoteDashboardResponse = await fetchHandler(
      new Request("https://tracker.example.com/", {
        headers: { cookie },
      }),
      env,
    );

    const remoteDashboardBody = await remoteDashboardResponse.text();
    expect(remoteDashboardResponse.status).toBe(200);
    expect(remoteDashboardBody).not.toContain("Style guide");
    expect(remoteDashboardBody).toContain("Data tools");
    expect(remoteDashboardBody).not.toContain(">More<");

    const remoteStyleGuideResponse = await fetchHandler(
      new Request("https://tracker.example.com/style-guide", {
        headers: { cookie },
      }),
      env,
    );

    expect(remoteStyleGuideResponse.status).toBe(404);
  });

  it.each([
    {
      label: "a noncurrent PBKDF2 work factor",
      passwordHash: `pbkdf2_sha256$210000$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(32).toString("base64")}`,
      logsResetRequirement: true,
    },
    { label: "a malformed password hash", passwordHash: "not-a-password-hash", logsResetRequirement: false },
  ])("returns a generic failure for an account with $label", async ({ passwordHash, logsResetRequirement }) => {
    env = {
      DB: new MockD1Database(),
      SESSION_SECRET: "test-session-secret-with-at-least-32-bytes",
      APP_ENCRYPTION_SECRET: "test-app-encryption-secret-with-32-bytes",
    };
    env.DB.seedAuthUser({
      name: "Advisor",
      password_hash: passwordHash,
      role: "editor",
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await fetchHandler(
      sameOriginRequest("https://tracker.example.com/login", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          name: "Advisor",
          password: "any-password",
        }),
      }),
      env,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/login?error=1");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(env.DB.loginAttempts.map((attempt) => attempt.attempt_key).sort()).toEqual([
      expect.stringMatching(/^account:[A-Za-z0-9_-]{43}$/),
      expect.stringMatching(/^client:[A-Za-z0-9_-]{43}$/),
    ]);
    expect(consoleError).toHaveBeenCalledTimes(logsResetRequirement ? 1 : 0);
    consoleError.mockRestore();
  });
});
