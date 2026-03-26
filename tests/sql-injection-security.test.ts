import { beforeEach, describe, expect, it, vi } from "vitest";
import { loginWithPassword, seedTestUsers } from "./helpers/auth";
import { MockD1Database } from "./helpers/mock-d1";

vi.mock("../.generated/styles.css", () => ({ default: "" }));
vi.mock("../src/favicon.ico", () => ({ default: new ArrayBuffer(0) }));

type WorkerFetch = (typeof import("../src/worker"))["default"]["fetch"];

describe("SQL injection safety", () => {
  let env: { DB: MockD1Database; SESSION_SECRET: string };
  let fetchHandler: WorkerFetch;

  beforeEach(async () => {
    vi.resetModules();
    const workerModule = await import("../src/worker");
    fetchHandler = workerModule.default.fetch;
    env = {
      DB: new MockD1Database(),
      SESSION_SECRET: "test-secret",
    };
    await seedTestUsers(env.DB, [{ name: "Advisor", password: "test-password", role: "editor" }]);
  });

  it.each(["Robert'); DROP TABLE students;--", "'; DELETE FROM meeting_logs; --", "\"; UPDATE students SET name='pwned' WHERE id=1; --"])(
    "treats add-student payload as data (%s)",
    async (payload) => {
      const cookie = await loginWithPassword(fetchHandler, env, "Advisor", "test-password");
      expect(cookie.startsWith("thesis_session=")).toBe(true);

      const response = await fetchHandler(
        new Request("http://localhost/actions/add-student", {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            cookie,
          },
          body: new URLSearchParams({
            name: payload,
            email: "safe@example.edu",
            degreeType: "msc",
            thesisTopic: "Secure advising workflows",
            studentNotes: "Safe notes payload",
            startDate: "2026-02-01",
            currentPhase: "research_plan",
            nextMeetingAt: "",
          }),
        }),
        env,
      );

      expect(response.status).toBe(302);
      expect(env.DB.students.some((student) => student.name === payload)).toBe(true);
      expect(env.DB.students.length).toBe(2);
      expect(env.DB.calls.some((call) => call.query.includes(payload))).toBe(false);
    },
  );

  it("treats update-student payload as data and keeps schema intact", async () => {
    const cookie = await loginWithPassword(fetchHandler, env, "Advisor", "test-password");
    expect(cookie.startsWith("thesis_session=")).toBe(true);
    const payload = "'; DROP TABLE students; --";

    const response = await fetchHandler(
      new Request("http://localhost/actions/update-student/1", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie,
        },
        body: new URLSearchParams({
          name: payload,
          email: "updated@example.edu",
          degreeType: "dsc",
          thesisTopic: "Updated topic",
          studentNotes: "Updated secure note",
          startDate: "2026-01-01",
          currentPhase: "editing",
          nextMeetingAt: "",
        }),
      }),
      env,
    );

    expect(response.status).toBe(302);
    expect(env.DB.students[0]?.name).toBe(payload);
    expect(env.DB.students[0]?.degree_type).toBe("dsc");
    expect(env.DB.students[0]?.thesis_topic).toBe("Updated topic");
    expect(env.DB.students[0]?.student_notes).toBe("Updated secure note");
    expect(env.DB.students.length).toBe(1);
    expect(env.DB.calls.some((call) => call.query.includes(payload))).toBe(false);
  });

  it.each(["'); DROP TABLE meeting_logs;--", "'; UPDATE students SET name='pwned' WHERE id=1;--"])(
    "treats add-log payload as data (%s)",
    async (payload) => {
      const cookie = await loginWithPassword(fetchHandler, env, "Advisor", "test-password");
      expect(cookie.startsWith("thesis_session=")).toBe(true);

      const response = await fetchHandler(
        new Request("http://localhost/actions/add-log/1", {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            cookie,
          },
          body: new URLSearchParams({
            happenedAt: "",
            discussed: payload,
            agreedPlan: "Complete chapter 2",
          }),
        }),
        env,
      );

      expect(response.status).toBe(302);
      expect(env.DB.meetingLogs.length).toBe(1);
      expect(env.DB.meetingLogs[0]?.discussed).toBe(payload);
      expect(env.DB.calls.some((call) => call.query.includes(payload))).toBe(false);
    },
  );

  it("archives a student and preserves meeting logs", async () => {
    const cookie = await loginWithPassword(fetchHandler, env, "Advisor", "test-password");
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

    expect(response.status).toBe(302);
    expect(env.DB.students).toHaveLength(1);
    expect(env.DB.students[0]?.archived_at).toMatch(/^202\d-/);
    expect(env.DB.meetingLogs).toHaveLength(1);
  });
});
