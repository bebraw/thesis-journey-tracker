import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockD1Database } from "./helpers/mock-d1";

vi.mock("../.generated/styles.css", () => ({ default: "" }));
vi.mock("../src/favicon.ico", () => ({ default: new ArrayBuffer(0) }));

async function login(fetchHandler: (request: Request, env: unknown) => Promise<Response>, env: Record<string, unknown>): Promise<string> {
  const response = await fetchHandler(
    new Request("http://localhost/login", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ password: String(env.APP_PASSWORD) }),
    }),
    env,
  );

  const setCookie = response.headers.get("set-cookie") || "";
  const cookie = setCookie.split(";")[0];
  expect(cookie.startsWith("thesis_session=")).toBe(true);
  return cookie;
}

describe("data import and export", () => {
  let env: { DB: MockD1Database; APP_PASSWORD: string; SESSION_SECRET: string };
  let fetchHandler: (request: Request, env: unknown) => Promise<Response>;

  beforeEach(async () => {
    vi.resetModules();
    const workerModule = await import("../src/worker");
    fetchHandler = workerModule.default.fetch;
    env = {
      DB: new MockD1Database(),
      APP_PASSWORD: "test-password",
      SESSION_SECRET: "test-secret",
    };

    env.DB.meetingLogs.push({
      id: 1,
      student_id: 1,
      happened_at: "2026-03-22T09:00:00.000Z",
      discussed: "Initial review",
      agreed_plan: "Write chapter 1",
      next_step_deadline: "2026-03-29",
    });
  });

  it("exports the current dataset as a JSON attachment", async () => {
    const cookie = await login(fetchHandler, env);

    const response = await fetchHandler(
      new Request("http://localhost/actions/export-json", {
        headers: { cookie },
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("content-disposition")).toContain("attachment;");

    const body = JSON.parse(await response.text()) as {
      app: string;
      schemaVersion: number;
      students: Array<{ name: string; logs: Array<{ discussed: string }> }>;
    };

    expect(body.app).toBe("thesis-journey-tracker");
    expect(body.schemaVersion).toBe(1);
    expect(body.students).toHaveLength(1);
    expect(body.students[0]?.name).toBe("Base Student");
    expect(body.students[0]?.logs[0]?.discussed).toBe("Initial review");
  });

  it("appends imported students and logs by default", async () => {
    const cookie = await login(fetchHandler, env);
    const formData = new FormData();
    formData.set(
      "importFile",
      new File(
        [
          JSON.stringify({
            app: "thesis-journey-tracker",
            schemaVersion: 1,
            exportedAt: "2026-03-23T08:00:00.000Z",
            students: [
              {
                name: "Imported Student",
                email: "imported@example.edu",
                degreeType: "dsc",
                thesisTopic: "Imported thesis",
                startDate: "2026-02-01",
                targetSubmissionDate: "2026-08-01",
                currentPhase: "editing",
                nextMeetingAt: "2026-04-01T09:00:00.000Z",
                logs: [
                  {
                    happenedAt: "2026-03-20T10:00:00.000Z",
                    discussed: "Imported log",
                    agreedPlan: "Imported next step",
                    nextStepDeadline: "2026-03-30",
                  },
                ],
              },
            ],
          }),
        ],
        "backup.json",
        { type: "application/json" },
      ),
    );

    const response = await fetchHandler(
      new Request("http://localhost/actions/import-json", {
        method: "POST",
        headers: { cookie },
        body: formData,
      }),
      env,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/data-tools?notice=");
    expect(env.DB.students).toHaveLength(2);
    expect(env.DB.students[1]?.name).toBe("Imported Student");
    expect(env.DB.meetingLogs).toHaveLength(2);
    expect(env.DB.meetingLogs[1]?.discussed).toBe("Imported log");
  });

  it("requires confirmation before replacement import", async () => {
    const cookie = await login(fetchHandler, env);
    const formData = new FormData();
    formData.set(
      "importFile",
      new File(
        [
          JSON.stringify({
            app: "thesis-journey-tracker",
            schemaVersion: 1,
            exportedAt: "2026-03-23T08:00:00.000Z",
            students: [],
          }),
        ],
        "backup.json",
        { type: "application/json" },
      ),
    );
    formData.set("mode", "replace");

    const response = await fetchHandler(
      new Request("http://localhost/actions/import-json", {
        method: "POST",
        headers: { cookie },
        body: formData,
      }),
      env,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("Confirm+replacement+before+importing");
    expect(env.DB.students).toHaveLength(1);
    expect(env.DB.meetingLogs).toHaveLength(1);
  });

  it("replaces the current dataset when replacement is confirmed", async () => {
    const cookie = await login(fetchHandler, env);
    const formData = new FormData();
    formData.set(
      "importFile",
      new File(
        [
          JSON.stringify({
            app: "thesis-journey-tracker",
            schemaVersion: 1,
            exportedAt: "2026-03-23T08:00:00.000Z",
            students: [
              {
                name: "Replacement Student",
                email: null,
                degreeType: "bsc",
                thesisTopic: null,
                startDate: "2026-01-15",
                targetSubmissionDate: "2026-06-15",
                currentPhase: "research_plan",
                nextMeetingAt: null,
                logs: [],
              },
            ],
          }),
        ],
        "backup.json",
        { type: "application/json" },
      ),
    );
    formData.set("mode", "replace");
    formData.set("confirmReplace", "yes");

    const response = await fetchHandler(
      new Request("http://localhost/actions/import-json", {
        method: "POST",
        headers: { cookie },
        body: formData,
      }),
      env,
    );

    expect(response.status).toBe(302);
    expect(env.DB.students).toHaveLength(1);
    expect(env.DB.students[0]?.name).toBe("Replacement Student");
    expect(env.DB.meetingLogs).toHaveLength(0);
  });

  it("rejects invalid JSON imports without changing stored data", async () => {
    const cookie = await login(fetchHandler, env);
    const formData = new FormData();
    formData.set("importFile", new File(["not-json"], "broken.json", { type: "application/json" }));

    const response = await fetchHandler(
      new Request("http://localhost/actions/import-json", {
        method: "POST",
        headers: { cookie },
        body: formData,
      }),
      env,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("not%20valid%20JSON");
    expect(env.DB.students).toHaveLength(1);
    expect(env.DB.meetingLogs).toHaveLength(1);
  });
});
