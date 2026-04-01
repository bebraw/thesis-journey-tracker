import { beforeEach, describe, expect, it, vi } from "vitest";
import { seedTestUsers, loginWithPassword } from "../../tests/helpers/auth";
import { MockD1Database } from "../../tests/helpers/mock-d1";

vi.mock("../../.generated/styles.css", () => ({ default: "" }));
vi.mock("../favicon.ico", () => ({ default: new ArrayBuffer(0) }));

type WorkerFetch = (typeof import("../worker"))["default"]["fetch"];

describe("multi-user access control", () => {
  let env: { DB: MockD1Database; SESSION_SECRET: string };
  let fetchHandler: WorkerFetch;

  beforeEach(async () => {
    vi.resetModules();
    const workerModule = await import("../worker");
    fetchHandler = workerModule.default.fetch;
    env = {
      DB: new MockD1Database(),
      SESSION_SECRET: "test-secret",
    };
    await seedTestUsers(env.DB, [
      { name: "Advisor", password: "editor-password", role: "editor" },
      { name: "Professor", password: "readonly-password", role: "readonly" },
    ]);
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
    expect(body).toContain("Signed in as Professor");
    expect(body).toContain("Read-only");
    expect(body).toContain("Base Student");
    expect(body).not.toContain("Add student");
    expect(body).not.toContain("Data tools");
    expect(body).toContain("Select a student from the table to view details, supervision logs, and phase history.");
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
      new Request("http://localhost/actions/update-student/1", {
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
      new Request("http://localhost/actions/schedule-meeting", {
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
    expect(scheduleMeetingResponse.headers.get("location")).toBe("/schedule?week=2026-03-23&student=1&slot=2026-03-24T09:00&error=Read-only+access");

    const saveCalendarSettingsResponse = await fetchHandler(
      new Request("http://localhost/actions/save-google-calendar-settings", {
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
      new Request("http://localhost/actions/save-google-calendar-ical-settings", {
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

    const clearCalendarSettingsResponse = await fetchHandler(
      new Request("http://localhost/actions/clear-google-calendar-settings", {
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
      new Request("http://localhost/actions/clear-google-calendar-oauth-settings", {
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
      new Request("http://localhost/actions/clear-google-calendar-ical-settings", {
        method: "POST",
        headers: {
          cookie,
        },
      }),
      env,
    );

    expect(clearCalendarIcalResponse.status).toBe(302);
    expect(clearCalendarIcalResponse.headers.get("location")).toBe("/?error=Read-only+access");
    expect(env.DB.students[0]?.name).toBe("Base Student");
    expect(env.DB.phaseAuditEntries).toHaveLength(0);
  });

  it("still allows editor accounts with database-backed users", async () => {
    const cookie = await loginWithPassword(fetchHandler, env, "Advisor", "editor-password");
    expect(cookie.startsWith("thesis_session=")).toBe(true);

    const response = await fetchHandler(
      new Request("http://localhost/actions/add-student", {
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
      new Request("http://localhost/actions/add-student", {
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
      new Request("http://localhost/actions/update-student/1", {
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
      new Request("http://localhost/actions/add-log/1", {
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
      new Request("http://localhost/actions/add-student", {
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
      new Request("http://localhost/actions/add-log/1", {
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
      new Request("http://localhost/actions/add-log/1", {
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
      new Request("http://localhost/actions/archive-student/1", {
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

  it("rate limits repeated failed logins from the same client IP", async () => {
    const loginHeaders = {
      "cf-connecting-ip": "203.0.113.10",
      "content-type": "application/x-www-form-urlencoded",
    };

    for (let attemptIndex = 0; attemptIndex < 4; attemptIndex += 1) {
      const failedResponse = await fetchHandler(
        new Request("http://localhost/login", {
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
      new Request("http://localhost/login", {
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
    expect(env.DB.loginAttempts[0]?.failure_count).toBe(5);
    expect(env.DB.loginAttempts[0]?.locked_until).toBeTruthy();
    expect(env.DB.loginAttempts[0]?.attempt_key).toBe("ip:203.0.113.10|user:advisor");

    const blockedValidLoginResponse = await fetchHandler(
      new Request("http://localhost/login", {
        method: "POST",
        headers: loginHeaders,
        body: new URLSearchParams({
          name: "Advisor",
          password: "editor-password",
        }),
      }),
      env,
    );

    expect(blockedValidLoginResponse.status).toBe(302);
    expect(blockedValidLoginResponse.headers.get("location")).toBe("/login?error=rate_limit");
    expect(blockedValidLoginResponse.headers.get("set-cookie")).toBeNull();

    env.DB.loginAttempts[0]!.locked_until = "2000-01-01T00:00:00.000Z";

    const recoveredResponse = await fetchHandler(
      new Request("http://localhost/login", {
        method: "POST",
        headers: loginHeaders,
        body: new URLSearchParams({
          name: "Advisor",
          password: "editor-password",
        }),
      }),
      env,
    );

    expect(recoveredResponse.status).toBe(302);
    expect(recoveredResponse.headers.get("location")).toBe("/");
    expect(recoveredResponse.headers.get("set-cookie")).toContain("thesis_session=");
    expect(env.DB.loginAttempts).toHaveLength(0);
  });

  it("does not lock out a different user from the same shared IP address", async () => {
    const loginHeaders = {
      "cf-connecting-ip": "203.0.113.10",
      "content-type": "application/x-www-form-urlencoded",
    };

    for (let attemptIndex = 0; attemptIndex < 5; attemptIndex += 1) {
      const failedResponse = await fetchHandler(
        new Request("http://localhost/login", {
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

    expect(env.DB.loginAttempts).toHaveLength(1);
    expect(env.DB.loginAttempts[0]?.attempt_key).toBe("ip:203.0.113.10|user:advisor");

    const differentUserResponse = await fetchHandler(
      new Request("http://localhost/login", {
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
    expect(env.DB.loginAttempts).toHaveLength(1);
    expect(env.DB.loginAttempts[0]?.attempt_key).toBe("ip:203.0.113.10|user:advisor");
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

  it("redirects to password reset guidance for accounts hashed above the Cloudflare PBKDF2 limit", async () => {
    env = {
      DB: new MockD1Database(),
      SESSION_SECRET: "test-secret",
    };
    env.DB.seedAuthUser({
      name: "Advisor",
      password_hash: `pbkdf2_sha256$210000$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(32).toString("base64")}`,
      role: "editor",
    });

    const response = await fetchHandler(
      new Request("http://localhost/login", {
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
    expect(response.headers.get("location")).toBe("/login?error=password_reset");
  });
});
