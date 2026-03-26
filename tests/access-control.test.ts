import { beforeEach, describe, expect, it, vi } from "vitest";
import { seedTestUsers, loginWithPassword } from "./helpers/auth";
import { MockD1Database } from "./helpers/mock-d1";

vi.mock("../.generated/styles.css", () => ({ default: "" }));
vi.mock("../src/favicon.ico", () => ({ default: new ArrayBuffer(0) }));

type WorkerFetch = (typeof import("../src/worker"))["default"]["fetch"];

describe("multi-user access control", () => {
  let env: { DB: MockD1Database; SESSION_SECRET: string; APP_USERS_JSON?: string };
  let fetchHandler: WorkerFetch;

  beforeEach(async () => {
    vi.resetModules();
    const workerModule = await import("../src/worker");
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

    const response = await fetchHandler(
      new Request("http://localhost/partials/student/1", {
        headers: { cookie },
      }),
      env,
    );

    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain("Student Overview");
    expect(body).toContain("Read-only access: student details, supervision logs, and phase history.");
    expect(body).toContain("Base Student");
    expect(body).toContain("base@example.edu");
    expect(body).toContain("Baseline supervision topic");
    expect(body).toContain("Baseline student note");
    expect(body).toContain("2026-07-01");
    expect(body).toContain("Initial review");
    expect(body).not.toContain("Save student updates");
    expect(body).not.toContain("Delete Student");
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

    const updateResponse = await fetchHandler(
      new Request("http://localhost/actions/update-student/1", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie,
        },
        body: new URLSearchParams({
          name: "Readonly Attempt",
          email: "readonly@example.edu",
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
          email: "second@example.edu",
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

    const remoteStyleGuideResponse = await fetchHandler(
      new Request("https://tracker.example.com/style-guide", {
        headers: { cookie },
      }),
      env,
    );

    expect(remoteStyleGuideResponse.status).toBe(404);
  });

  it("bootstraps auth users from legacy APP_USERS_JSON when the auth table is empty", async () => {
    env = {
      DB: new MockD1Database(),
      APP_USERS_JSON: JSON.stringify([
        { name: "Advisor", password: "editor-password", role: "editor" },
        { name: "Professor", password: "readonly-password", role: "readonly" },
      ]),
      SESSION_SECRET: "test-secret",
    };

    const cookie = await loginWithPassword(fetchHandler, env, "Professor", "readonly-password");

    expect(cookie.startsWith("thesis_session=")).toBe(true);
    expect(env.DB.appUsers).toHaveLength(2);
    expect(env.DB.appUsers.some((user) => user.name === "Professor" && user.role === "readonly")).toBe(true);
    expect(env.DB.appUsers.every((user) => !user.password_hash.includes("readonly-password"))).toBe(true);
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
