import { beforeEach, describe, expect, it, vi } from "vitest";
import { seedTestUsers, loginWithPassword } from "./helpers/auth";
import { MockD1Database } from "./helpers/mock-d1";

vi.mock("../.generated/styles.css", () => ({ default: "" }));
vi.mock("../src/favicon.ico", () => ({ default: new ArrayBuffer(0) }));

describe("multi-user access control", () => {
  let env: { DB: MockD1Database; SESSION_SECRET: string; APP_USERS_JSON?: string };
  let fetchHandler: (request: Request, env: unknown) => Promise<Response>;

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
          targetSubmissionDate: "2026-07-01",
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
          startDate: "2026-03-01",
          targetSubmissionDate: "2026-09-01",
          currentPhase: "research_plan",
          nextMeetingAt: "",
        }),
      }),
      env,
    );

    expect(response.status).toBe(302);
    expect(env.DB.students).toHaveLength(2);
    expect(env.DB.students[1]?.name).toBe("Second Student");
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
});
