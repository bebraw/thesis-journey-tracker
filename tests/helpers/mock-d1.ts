type D1Value = string | number | null;

interface StudentRowStore {
  id: number;
  name: string;
  email: string | null;
  degree_type: string;
  thesis_topic: string | null;
  start_date: string | null;
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

interface PhaseAuditEntryStore {
  id: number;
  student_id: number;
  changed_at: string;
  from_phase: string;
  to_phase: string;
}

interface AppUserStore {
  id: number;
  name: string;
  password_hash: string;
  role: string;
}

interface QueryCall {
  query: string;
  values: D1Value[];
  method: "run" | "first" | "all";
}

export class MockD1Database {
  public students: StudentRowStore[] = [];
  public meetingLogs: MeetingLogStore[] = [];
  public phaseAuditEntries: PhaseAuditEntryStore[] = [];
  public appUsers: AppUserStore[] = [];
  public calls: QueryCall[] = [];
  public failQueries: Array<string | RegExp> = [];

  private nextStudentId = 1;
  private nextLogId = 1;
  private nextPhaseAuditId = 1;
  private nextAppUserId = 1;

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

  async batch(statements: MockPreparedStatement[]) {
    const snapshot = {
      students: this.students.map((row) => ({ ...row })),
      meetingLogs: this.meetingLogs.map((row) => ({ ...row })),
      phaseAuditEntries: this.phaseAuditEntries.map((row) => ({ ...row })),
      appUsers: this.appUsers.map((row) => ({ ...row })),
      nextStudentId: this.nextStudentId,
      nextLogId: this.nextLogId,
      nextPhaseAuditId: this.nextPhaseAuditId,
      nextAppUserId: this.nextAppUserId,
    };

    try {
      const results = [];
      for (const statement of statements) {
        results.push(await statement.run());
      }
      return results;
    } catch (error) {
      this.students = snapshot.students;
      this.meetingLogs = snapshot.meetingLogs;
      this.phaseAuditEntries = snapshot.phaseAuditEntries;
      this.appUsers = snapshot.appUsers;
      this.nextStudentId = snapshot.nextStudentId;
      this.nextLogId = snapshot.nextLogId;
      this.nextPhaseAuditId = snapshot.nextPhaseAuditId;
      this.nextAppUserId = snapshot.nextAppUserId;
      throw error;
    }
  }

  seedAuthUser(user: Omit<AppUserStore, "id">) {
    const row: AppUserStore = {
      id: this.nextAppUserId++,
      ...user,
    };
    this.appUsers.push(row);
    return row.id;
  }

  runQuery(query: string, values: D1Value[]) {
    const q = normalizeQuery(query);

    if (this.failQueries.some((pattern) => (typeof pattern === "string" ? q === pattern : pattern.test(q)))) {
      throw new Error(`Mock query failure for ${q}`);
    }

    if (q.startsWith("INSERT INTO students")) {
      const hasExplicitId = values.length === 9;
      const [idValue, name, email, degreeType, thesisTopic, startDate, targetDate, phase, nextMeetingAt] = hasExplicitId
        ? values
        : [this.nextStudentId++, ...values];
      const id = Number(idValue);
      const row: StudentRowStore = {
        id,
        name: String(name),
        email: email === null ? null : String(email),
        degree_type: String(degreeType),
        thesis_topic: thesisTopic === null ? null : String(thesisTopic),
        start_date: startDate === null ? null : String(startDate),
        target_submission_date: String(targetDate),
        current_phase: String(phase),
        next_meeting_at: nextMeetingAt === null ? null : String(nextMeetingAt),
      };
      this.students.push(row);
      this.nextStudentId = Math.max(this.nextStudentId, id + 1);
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
      row.start_date = startDate === null ? null : String(startDate);
      row.target_submission_date = String(targetDate);
      row.current_phase = String(phase);
      row.next_meeting_at = nextMeetingAt === null ? null : String(nextMeetingAt);
      return { success: true, meta: { changes: 1 } };
    }

    if (q === "DELETE FROM students WHERE id = ?") {
      const id = Number(values[0]);
      this.students = this.students.filter((student) => student.id !== id);
      this.meetingLogs = this.meetingLogs.filter((log) => log.student_id !== id);
      this.phaseAuditEntries = this.phaseAuditEntries.filter((entry) => entry.student_id !== id);
      return { success: true, meta: { changes: 1 } };
    }

    if (q === "DELETE FROM students") {
      this.students = [];
      this.meetingLogs = [];
      this.phaseAuditEntries = [];
      return { success: true, meta: { changes: 1 } };
    }

    if (q.startsWith("INSERT INTO meeting_logs")) {
      const hasExplicitId = values.length === 6;
      const [idValue, studentId, happenedAt, discussed, agreedPlan, nextStepDeadline] = hasExplicitId
        ? values
        : [this.nextLogId++, ...values];
      const id = Number(idValue);
      const row: MeetingLogStore = {
        id,
        student_id: Number(studentId),
        happened_at: String(happenedAt),
        discussed: String(discussed),
        agreed_plan: String(agreedPlan),
        next_step_deadline: nextStepDeadline === null ? null : String(nextStepDeadline),
      };
      this.meetingLogs.push(row);
      this.nextLogId = Math.max(this.nextLogId, id + 1);
      return { success: true, meta: { last_row_id: row.id, changes: 1 } };
    }

    if (q.startsWith("INSERT INTO student_phase_audit")) {
      const hasExplicitId = values.length === 5;
      const [idValue, studentId, changedAt, fromPhase, toPhase] = hasExplicitId ? values : [this.nextPhaseAuditId++, ...values];
      const id = Number(idValue);
      const row: PhaseAuditEntryStore = {
        id,
        student_id: Number(studentId),
        changed_at: String(changedAt),
        from_phase: String(fromPhase),
        to_phase: String(toPhase),
      };
      this.phaseAuditEntries.push(row);
      this.nextPhaseAuditId = Math.max(this.nextPhaseAuditId, id + 1);
      return { success: true, meta: { last_row_id: row.id, changes: 1 } };
    }

    if (q.startsWith("INSERT INTO app_users")) {
      const [name, passwordHash, role] = values;
      const normalizedName = String(name);
      const existingUser = this.appUsers.find((user) => user.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase());

      if (existingUser) {
        existingUser.name = normalizedName;
        existingUser.password_hash = String(passwordHash);
        existingUser.role = String(role);
        return { success: true, meta: { last_row_id: existingUser.id, changes: 1 } };
      }

      const row: AppUserStore = {
        id: this.nextAppUserId++,
        name: normalizedName,
        password_hash: String(passwordHash),
        role: String(role),
      };
      this.appUsers.push(row);
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

    if (q === "SELECT id, name, password_hash, role FROM app_users WHERE name = ? COLLATE NOCASE") {
      const lookupName = String(values[0] || "");
      const row = this.appUsers.find((user) => user.name.toLocaleLowerCase() === lookupName.toLocaleLowerCase());
      return row || null;
    }

    if (q === "SELECT COALESCE(MAX(id), 0) AS max_id FROM students") {
      return {
        max_id: this.students.reduce((max, student) => Math.max(max, student.id), 0),
      };
    }

    if (q === "SELECT COALESCE(MAX(id), 0) AS max_id FROM meeting_logs") {
      return {
        max_id: this.meetingLogs.reduce((max, log) => Math.max(max, log.id), 0),
      };
    }

    if (q === "SELECT COALESCE(MAX(id), 0) AS max_id FROM student_phase_audit") {
      return {
        max_id: this.phaseAuditEntries.reduce((max, entry) => Math.max(max, entry.id), 0),
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

    if (q.startsWith("SELECT * FROM student_phase_audit")) {
      const studentId = Number(values[0]);
      const results = this.phaseAuditEntries
        .filter((entry) => entry.student_id === studentId)
        .sort((a, b) => (a.changed_at < b.changed_at ? 1 : -1));
      return { results };
    }

    if (q === "SELECT id, name, password_hash, role FROM app_users ORDER BY name ASC") {
      const results = [...this.appUsers].sort((left, right) => left.name.localeCompare(right.name));
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
