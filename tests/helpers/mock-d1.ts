type D1Value = string | number | null;

interface StudentRowStore {
  id: number;
  name: string;
  email: string | null;
  degree_type: string;
  thesis_topic: string | null;
  student_notes: string | null;
  start_date: string | null;
  current_phase: string;
  next_meeting_at: string | null;
  archived_at?: string | null;
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

interface LoginAttemptStore {
  attempt_key: string;
  failure_count: number;
  first_failed_at: string;
  last_failed_at: string;
  locked_until: string | null;
}

interface AppSecretStore {
  secret_key: string;
  encrypted_value: string;
  updated_at: string;
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
  public loginAttempts: LoginAttemptStore[] = [];
  public appSecrets: AppSecretStore[] = [];
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
      student_notes: "Baseline student note",
      start_date: "2026-01-01",
      current_phase: "researching",
      next_meeting_at: null,
      archived_at: null,
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
      loginAttempts: this.loginAttempts.map((row) => ({ ...row })),
      appSecrets: this.appSecrets.map((row) => ({ ...row })),
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
      this.loginAttempts = snapshot.loginAttempts;
      this.appSecrets = snapshot.appSecrets;
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
      const hasExplicitId = values.length === 10;
      const [idValue, name, email, degreeType, thesisTopic, studentNotes, startDate, phase, nextMeetingAt, archivedAt] = hasExplicitId
        ? values
        : [this.nextStudentId++, ...values, null];
      const id = Number(idValue);
      const row: StudentRowStore = {
        id,
        name: String(name),
        email: email === null ? null : String(email),
        degree_type: String(degreeType),
        thesis_topic: thesisTopic === null ? null : String(thesisTopic),
        student_notes: studentNotes === null ? null : String(studentNotes),
        start_date: startDate === null ? null : String(startDate),
        current_phase: String(phase),
        next_meeting_at: nextMeetingAt === null ? null : String(nextMeetingAt),
        archived_at: archivedAt === null ? null : String(archivedAt),
      };
      this.students.push(row);
      this.nextStudentId = Math.max(this.nextStudentId, id + 1);
      return { success: true, meta: { last_row_id: row.id, changes: 1 } };
    }

    if (q === "UPDATE students SET archived_at = ? WHERE id = ? AND archived_at IS NULL") {
      const archivedAt = values[0] === null ? null : String(values[0]);
      const id = Number(values[1]);
      const row = this.students.find((student) => student.id === id && !student.archived_at);
      if (!row) {
        return { success: true, meta: { changes: 0 } };
      }
      row.archived_at = archivedAt;
      return { success: true, meta: { changes: 1 } };
    }

    if (q.startsWith("UPDATE students")) {
      const [name, email, degreeType, thesisTopic, studentNotes, startDate, phase, nextMeetingAt, studentId] = values;
      const id = Number(studentId);
      const row = this.students.find((student) => student.id === id);
      if (!row) {
        return { success: true, meta: { changes: 0 } };
      }
      row.name = String(name);
      row.email = email === null ? null : String(email);
      row.degree_type = String(degreeType);
      row.thesis_topic = thesisTopic === null ? null : String(thesisTopic);
      row.student_notes = studentNotes === null ? null : String(studentNotes);
      row.start_date = startDate === null ? null : String(startDate);
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

    if (q.startsWith("INSERT INTO login_attempts")) {
      const [attemptKey, failureCount, firstFailedAt, lastFailedAt, lockedUntil] = values;
      const normalizedKey = String(attemptKey);
      const existingAttempt = this.loginAttempts.find((attempt) => attempt.attempt_key === normalizedKey);

      if (existingAttempt) {
        existingAttempt.failure_count = Number(failureCount);
        existingAttempt.first_failed_at = String(firstFailedAt);
        existingAttempt.last_failed_at = String(lastFailedAt);
        existingAttempt.locked_until = lockedUntil === null ? null : String(lockedUntil);
        return { success: true, meta: { changes: 1 } };
      }

      this.loginAttempts.push({
        attempt_key: normalizedKey,
        failure_count: Number(failureCount),
        first_failed_at: String(firstFailedAt),
        last_failed_at: String(lastFailedAt),
        locked_until: lockedUntil === null ? null : String(lockedUntil),
      });
      return { success: true, meta: { changes: 1 } };
    }

    if (q === "DELETE FROM login_attempts WHERE attempt_key = ?") {
      const attemptKey = String(values[0] || "");
      this.loginAttempts = this.loginAttempts.filter((attempt) => attempt.attempt_key !== attemptKey);
      return { success: true, meta: { changes: 1 } };
    }

    if (q.startsWith("INSERT INTO app_secrets")) {
      const [secretKey, encryptedValue, updatedAt] = values;
      const normalizedKey = String(secretKey);
      const existingSecret = this.appSecrets.find((secret) => secret.secret_key === normalizedKey);

      if (existingSecret) {
        existingSecret.encrypted_value = String(encryptedValue);
        existingSecret.updated_at = String(updatedAt);
        return { success: true, meta: { changes: 1 } };
      }

      this.appSecrets.push({
        secret_key: normalizedKey,
        encrypted_value: String(encryptedValue),
        updated_at: String(updatedAt),
      });
      return { success: true, meta: { changes: 1 } };
    }

    if (q === "DELETE FROM app_secrets WHERE secret_key = ?") {
      const secretKey = String(values[0] || "");
      this.appSecrets = this.appSecrets.filter((secret) => secret.secret_key !== secretKey);
      return { success: true, meta: { changes: 1 } };
    }

    throw new Error(`Unsupported run query: ${query}`);
  }

  firstQuery(query: string, values: D1Value[]) {
    const q = normalizeQuery(query);

    if (q.startsWith("SELECT id FROM students WHERE id = ?")) {
      const id = Number(values[0]);
      const row = this.students.find(
        (student) =>
          student.id === id &&
          matchesArchivedFilter(q, student.archived_at ?? null, {
            qualifiedColumn: false,
          }),
      );
      return row ? { id: row.id } : null;
    }

    if (q.startsWith("SELECT s.*, COUNT(ml.id) AS log_count,")) {
      const studentId = Number(values[0]);
      const row = this.students.find(
        (student) =>
          student.id === studentId &&
          matchesArchivedFilter(q, student.archived_at ?? null, {
            qualifiedColumn: true,
          }),
      );

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

    if (q === "SELECT attempt_key, failure_count, first_failed_at, last_failed_at, locked_until FROM login_attempts WHERE attempt_key = ?") {
      const attemptKey = String(values[0] || "");
      return this.loginAttempts.find((attempt) => attempt.attempt_key === attemptKey) || null;
    }

    if (q === "SELECT secret_key, encrypted_value, updated_at FROM app_secrets WHERE secret_key = ?") {
      const secretKey = String(values[0] || "");
      return this.appSecrets.find((secret) => secret.secret_key === secretKey) || null;
    }

    throw new Error(`Unsupported first query: ${query}`);
  }

  allQuery(query: string, values: D1Value[]) {
    const q = normalizeQuery(query);

    if (q.startsWith("SELECT s.*, COUNT(ml.id) AS log_count,")) {
      const results = this.students
        .filter((student) =>
          matchesArchivedFilter(q, student.archived_at ?? null, {
            qualifiedColumn: true,
          }),
        )
        .map((student) => {
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
    const result = this.db.runQuery(this.query, this.values);
    return {
      results: [],
      ...result,
      success: true as const,
    };
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
    const result = this.db.allQuery(this.query, this.values) as { results: T[] };
    return {
      meta: {
        changes: 0,
      },
      results: result.results,
      success: true as const,
    };
  }

  async raw<T extends unknown[]>(_options?: { columnNames?: boolean }) {
    throw new Error(`Unsupported raw query: ${this.query}`) as never;
  }
}

function normalizeQuery(query: string): string {
  return query.replace(/\s+/g, " ").trim();
}

function matchesArchivedFilter(
  query: string,
  archivedAt: string | null,
  options: { qualifiedColumn: boolean },
): boolean {
  const nullCheck = options.qualifiedColumn ? "s.archived_at IS NULL" : "archived_at IS NULL";
  const notNullCheck = options.qualifiedColumn ? "s.archived_at IS NOT NULL" : "archived_at IS NOT NULL";
  const nullFilter = new RegExp(`(?:WHERE|AND) ${escapeRegExp(nullCheck)}`);
  const notNullFilter = new RegExp(`(?:WHERE|AND) ${escapeRegExp(notNullCheck)}`);

  if (notNullFilter.test(query)) {
    return Boolean(archivedAt);
  }

  if (nullFilter.test(query)) {
    return !archivedAt;
  }

  return true;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
