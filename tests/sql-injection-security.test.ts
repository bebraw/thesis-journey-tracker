import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/styles.css", () => ({ default: "" }));

type D1Value = string | number | null;

interface StudentRowStore {
  id: number;
  name: string;
  email: string | null;
  start_date: string;
  target_submission_date: string;
  current_phase: string;
  next_meeting_at: string | null;
  is_mock: number;
}

interface MeetingLogStore {
  id: number;
  student_id: number;
  happened_at: string;
  discussed: string;
  agreed_plan: string;
  next_step_deadline: string | null;
  is_mock: number;
}

interface QueryCall {
  query: string;
  values: D1Value[];
  method: "run" | "first" | "all";
}

class MockD1Database {
  public students: StudentRowStore[] = [];
  public meetingLogs: MeetingLogStore[] = [];
  public settings = new Map<string, string>([["show_mock_data", "0"]]);
  public calls: QueryCall[] = [];

  private nextStudentId = 1;
  private nextLogId = 1;

  constructor() {
    this.students.push({
      id: this.nextStudentId++,
      name: "Base Student",
      email: "base@example.edu",
      start_date: "2026-01-01",
      target_submission_date: "2026-07-01",
      current_phase: "researching",
      next_meeting_at: null,
      is_mock: 0
    });
  }

  prepare(query: string) {
    return new MockPreparedStatement(this, query);
  }

  runQuery(query: string, values: D1Value[]) {
    const q = normalizeQuery(query);

    if (q.startsWith("INSERT INTO students")) {
      const [name, email, startDate, targetDate, phase, nextMeetingAt] = values;
      const row: StudentRowStore = {
        id: this.nextStudentId++,
        name: String(name),
        email: email === null ? null : String(email),
        start_date: String(startDate),
        target_submission_date: String(targetDate),
        current_phase: String(phase),
        next_meeting_at: nextMeetingAt === null ? null : String(nextMeetingAt),
        is_mock: 0
      };
      this.students.push(row);
      return { success: true, meta: { last_row_id: row.id, changes: 1 } };
    }

    if (q.startsWith("UPDATE students")) {
      const [name, email, startDate, targetDate, phase, nextMeetingAt, studentId] = values;
      const id = Number(studentId);
      const row = this.students.find((student) => student.id === id);
      if (!row) {
        return { success: true, meta: { changes: 0 } };
      }
      row.name = String(name);
      row.email = email === null ? null : String(email);
      row.start_date = String(startDate);
      row.target_submission_date = String(targetDate);
      row.current_phase = String(phase);
      row.next_meeting_at = nextMeetingAt === null ? null : String(nextMeetingAt);
      return { success: true, meta: { changes: 1 } };
    }

    if (q.startsWith("INSERT INTO meeting_logs")) {
      const [studentId, happenedAt, discussed, agreedPlan, nextStepDeadline] = values;
      const row: MeetingLogStore = {
        id: this.nextLogId++,
        student_id: Number(studentId),
        happened_at: String(happenedAt),
        discussed: String(discussed),
        agreed_plan: String(agreedPlan),
        next_step_deadline: nextStepDeadline === null ? null : String(nextStepDeadline),
        is_mock: 0
      };
      this.meetingLogs.push(row);
      return { success: true, meta: { last_row_id: row.id, changes: 1 } };
    }

    if (q.startsWith("INSERT INTO settings")) {
      const [value] = values;
      this.settings.set("show_mock_data", String(value));
      return { success: true, meta: { changes: 1 } };
    }

    throw new Error(`Unsupported run query: ${query}`);
  }

  firstQuery(query: string, values: D1Value[]) {
    const q = normalizeQuery(query);

    if (q === "SELECT id FROM students WHERE id = ?") {
      const id = Number(values[0]);
      const row = this.students.find((student) => student.id === id);
      return row ? { id: row.id } : null;
    }

    if (q === "SELECT value FROM settings WHERE key = 'show_mock_data'") {
      return { value: this.settings.get("show_mock_data") ?? "0" };
    }

    throw new Error(`Unsupported first query: ${query}`);
  }

  allQuery(query: string, values: D1Value[]) {
    const q = normalizeQuery(query);

    if (q.startsWith("SELECT s.*, COUNT(ml.id) AS log_count,")) {
      const includeMock = Number(values[0]) === 1 && Number(values[1]) === 1;
      const filteredStudents = this.students.filter((student) => includeMock || student.is_mock === 0);

      const results = filteredStudents.map((student) => {
        const logs = this.meetingLogs.filter(
          (log) => log.student_id === student.id && (includeMock || log.is_mock === 0)
        );
        const lastLog = logs.length ? logs[logs.length - 1] : null;
        return {
          ...student,
          log_count: logs.length,
          last_log_at: lastLog ? lastLog.happened_at : null
        };
      });

      return { results };
    }

    if (q.startsWith("SELECT * FROM meeting_logs")) {
      const studentId = Number(values[0]);
      const includeMock = Number(values[1]) === 1;
      const results = this.meetingLogs
        .filter((log) => log.student_id === studentId && (includeMock || log.is_mock === 0))
        .sort((a, b) => (a.happened_at < b.happened_at ? 1 : -1));
      return { results };
    }

    throw new Error(`Unsupported all query: ${query}`);
  }
}

class MockPreparedStatement {
  private values: D1Value[] = [];

  constructor(
    private readonly db: MockD1Database,
    private readonly query: string
  ) {}

  bind(...values: D1Value[]) {
    this.values = values;
    return this;
  }

  async run() {
    this.db.calls.push({ query: this.query, values: this.values, method: "run" });
    return this.db.runQuery(this.query, this.values);
  }

  async first<T>() {
    this.db.calls.push({ query: this.query, values: this.values, method: "first" });
    return this.db.firstQuery(this.query, this.values) as T | null;
  }

  async all<T>() {
    this.db.calls.push({ query: this.query, values: this.values, method: "all" });
    return this.db.allQuery(this.query, this.values) as { results: T[] };
  }
}

function normalizeQuery(query: string): string {
  return query.replace(/\s+/g, " ").trim();
}

async function login(
  fetchHandler: (request: Request, env: unknown) => Promise<Response>,
  env: Record<string, unknown>
): Promise<string> {
  const response = await fetchHandler(
    new Request("http://localhost/login", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ password: String(env.APP_PASSWORD) })
    }),
    env
  );

  const setCookie = response.headers.get("set-cookie") || "";
  const cookie = setCookie.split(";")[0];
  expect(cookie.startsWith("thesis_session=")).toBe(true);
  return cookie;
}

describe("SQL injection safety", () => {
  let env: { DB: MockD1Database; APP_PASSWORD: string; SESSION_SECRET: string };
  let fetchHandler: (request: Request, env: unknown) => Promise<Response>;

  beforeEach(async () => {
    vi.resetModules();
    const workerModule = await import("../src/worker");
    fetchHandler = workerModule.default.fetch;
    env = {
      DB: new MockD1Database(),
      APP_PASSWORD: "test-password",
      SESSION_SECRET: "test-secret"
    };
  });

  it.each([
    "Robert'); DROP TABLE students;--",
    "'; DELETE FROM meeting_logs; --",
    "\"; UPDATE students SET name='pwned' WHERE id=1; --"
  ])("treats add-student payload as data (%s)", async (payload) => {
    const cookie = await login(fetchHandler, env);

    const response = await fetchHandler(
      new Request("http://localhost/actions/add-student", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie
        },
        body: new URLSearchParams({
          name: payload,
          email: "safe@example.edu",
          startDate: "2026-02-01",
          targetSubmissionDate: "2026-08-01",
          currentPhase: "research_plan",
          nextMeetingAt: ""
        })
      }),
      env
    );

    expect(response.status).toBe(302);
    expect(env.DB.students.some((student) => student.name === payload)).toBe(true);
    expect(env.DB.students.length).toBe(2);
    expect(env.DB.calls.some((call) => call.query.includes(payload))).toBe(false);
  });

  it("treats update-student payload as data and keeps schema intact", async () => {
    const cookie = await login(fetchHandler, env);
    const payload = "'; DROP TABLE students; --";

    const response = await fetchHandler(
      new Request("http://localhost/actions/update-student/1", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie
        },
        body: new URLSearchParams({
          name: payload,
          email: "updated@example.edu",
          startDate: "2026-01-01",
          targetSubmissionDate: "2026-07-01",
          currentPhase: "editing",
          nextMeetingAt: ""
        })
      }),
      env
    );

    expect(response.status).toBe(302);
    expect(env.DB.students[0]?.name).toBe(payload);
    expect(env.DB.students.length).toBe(1);
    expect(env.DB.calls.some((call) => call.query.includes(payload))).toBe(false);
  });

  it.each([
    "'); DROP TABLE meeting_logs;--",
    "'; UPDATE settings SET value='1' WHERE key='show_mock_data';--"
  ])("treats add-log payload as data (%s)", async (payload) => {
    const cookie = await login(fetchHandler, env);

    const response = await fetchHandler(
      new Request("http://localhost/actions/add-log/1", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie
        },
        body: new URLSearchParams({
          happenedAt: "",
          discussed: payload,
          agreedPlan: "Complete chapter 2",
          nextStepDeadline: "2026-03-30"
        })
      }),
      env
    );

    expect(response.status).toBe(302);
    expect(env.DB.meetingLogs.length).toBe(1);
    expect(env.DB.meetingLogs[0]?.discussed).toBe(payload);
    expect(env.DB.calls.some((call) => call.query.includes(payload))).toBe(false);
  });

  it("ignores injection-like selected value in mock-toggle action", async () => {
    const cookie = await login(fetchHandler, env);

    const response = await fetchHandler(
      new Request("http://localhost/actions/toggle-mock", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie
        },
        body: new URLSearchParams({
          showMockData: "1",
          selected: "1; DROP TABLE students;--"
        })
      }),
      env
    );

    expect(response.status).toBe(302);
    expect(env.DB.settings.get("show_mock_data")).toBe("1");
    expect(env.DB.students.length).toBe(1);
  });
});
