type D1Value = string | number | null;

interface StudentRowStore {
  id: number;
  name: string;
  email: string | null;
  degree_type: string;
  thesis_topic: string | null;
  start_date: string;
  target_submission_date: string;
  current_phase: string;
  next_meeting_at: string | null;
}

interface MeetingLogStore {
  id: number;
  student_id: number;
  happened_at: string;
  discussed: string;
  agreed_plan: string;
  next_step_deadline: string | null;
}

interface QueryCall {
  query: string;
  values: D1Value[];
  method: "run" | "first" | "all";
}

export class MockD1Database {
  public students: StudentRowStore[] = [];
  public meetingLogs: MeetingLogStore[] = [];
  public calls: QueryCall[] = [];

  private nextStudentId = 1;
  private nextLogId = 1;

  constructor() {
    this.students.push({
      id: this.nextStudentId++,
      name: "Base Student",
      email: "base@example.edu",
      degree_type: "msc",
      thesis_topic: "Baseline supervision topic",
      start_date: "2026-01-01",
      target_submission_date: "2026-07-01",
      current_phase: "researching",
      next_meeting_at: null,
    });
  }

  prepare(query: string) {
    return new MockPreparedStatement(this, query);
  }

  runQuery(query: string, values: D1Value[]) {
    const q = normalizeQuery(query);

    if (q.startsWith("INSERT INTO students")) {
      const [name, email, degreeType, thesisTopic, startDate, targetDate, phase, nextMeetingAt] = values;
      const row: StudentRowStore = {
        id: this.nextStudentId++,
        name: String(name),
        email: email === null ? null : String(email),
        degree_type: String(degreeType),
        thesis_topic: thesisTopic === null ? null : String(thesisTopic),
        start_date: String(startDate),
        target_submission_date: String(targetDate),
        current_phase: String(phase),
        next_meeting_at: nextMeetingAt === null ? null : String(nextMeetingAt),
      };
      this.students.push(row);
      return { success: true, meta: { last_row_id: row.id, changes: 1 } };
    }

    if (q.startsWith("UPDATE students")) {
      const [name, email, degreeType, thesisTopic, startDate, targetDate, phase, nextMeetingAt, studentId] = values;
      const id = Number(studentId);
      const row = this.students.find((student) => student.id === id);
      if (!row) {
        return { success: true, meta: { changes: 0 } };
      }
      row.name = String(name);
      row.email = email === null ? null : String(email);
      row.degree_type = String(degreeType);
      row.thesis_topic = thesisTopic === null ? null : String(thesisTopic);
      row.start_date = String(startDate);
      row.target_submission_date = String(targetDate);
      row.current_phase = String(phase);
      row.next_meeting_at = nextMeetingAt === null ? null : String(nextMeetingAt);
      return { success: true, meta: { changes: 1 } };
    }

    if (q === "DELETE FROM students WHERE id = ?") {
      const id = Number(values[0]);
      this.students = this.students.filter((student) => student.id !== id);
      this.meetingLogs = this.meetingLogs.filter((log) => log.student_id !== id);
      return { success: true, meta: { changes: 1 } };
    }

    if (q === "DELETE FROM students") {
      this.students = [];
      this.meetingLogs = [];
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
      };
      this.meetingLogs.push(row);
      return { success: true, meta: { last_row_id: row.id, changes: 1 } };
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

    if (q.startsWith("SELECT s.*, COUNT(ml.id) AS log_count,")) {
      const studentId = Number(values[0]);
      const row = this.students.find((student) => student.id === studentId);

      if (!row) {
        return null;
      }

      const logs = this.meetingLogs.filter((log) => log.student_id === row.id);
      const lastLog = logs.length ? logs[logs.length - 1] : null;

      return {
        ...row,
        log_count: logs.length,
        last_log_at: lastLog ? lastLog.happened_at : null,
      };
    }

    throw new Error(`Unsupported first query: ${query}`);
  }

  allQuery(query: string, values: D1Value[]) {
    const q = normalizeQuery(query);

    if (q.startsWith("SELECT s.*, COUNT(ml.id) AS log_count,")) {
      const results = this.students.map((student) => {
        const logs = this.meetingLogs.filter((log) => log.student_id === student.id);
        const lastLog = logs.length ? logs[logs.length - 1] : null;
        return {
          ...student,
          log_count: logs.length,
          last_log_at: lastLog ? lastLog.happened_at : null,
        };
      });

      return { results };
    }

    if (q.startsWith("SELECT * FROM meeting_logs")) {
      const studentId = Number(values[0]);
      const results = this.meetingLogs
        .filter((log) => log.student_id === studentId)
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
    private readonly query: string,
  ) {}

  bind(...values: D1Value[]) {
    this.values = values;
    return this;
  }

  async run() {
    this.db.calls.push({
      query: this.query,
      values: this.values,
      method: "run",
    });
    return this.db.runQuery(this.query, this.values);
  }

  async first<T>() {
    this.db.calls.push({
      query: this.query,
      values: this.values,
      method: "first",
    });
    return this.db.firstQuery(this.query, this.values) as T | null;
  }

  async all<T>() {
    this.db.calls.push({
      query: this.query,
      values: this.values,
      method: "all",
    });
    return this.db.allQuery(this.query, this.values) as { results: T[] };
  }
}

function normalizeQuery(query: string): string {
  return query.replace(/\s+/g, " ").trim();
}
