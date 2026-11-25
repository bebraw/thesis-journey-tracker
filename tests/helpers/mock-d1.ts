import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

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
  meeting_schedule?: string | null;
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
  session_version: number;
  is_admin: number;
  can_supervise: number;
  disabled_at: string | null;
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

const migrations = readdirSync("migrations")
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(join("migrations", file), "utf8"));

/** D1-shaped test database executing the same SQL and constraints as the app. */
export class MockD1Database {
  readonly sqlite = new DatabaseSync(":memory:");
  calls: QueryCall[] = [];
  failQueries: Array<string | RegExp> = [];
  sessionConstraints: string[] = [];

  constructor() {
    for (const migration of migrations) this.sqlite.exec(migration);
    this.seedRow("students", {
      name: "Base Student",
      email: "base@example.edu",
      degree_type: "msc",
      thesis_topic: "Baseline supervision topic",
      student_notes: "Baseline student note",
      start_date: "2026-01-01",
      current_phase: "researching",
    });
  }

  get students() {
    return this.sqlite.prepare("SELECT * FROM students ORDER BY id").all() as unknown as StudentRowStore[];
  }
  get meetingLogs() {
    return this.sqlite.prepare("SELECT * FROM meeting_logs ORDER BY id").all() as unknown as MeetingLogStore[];
  }
  get phaseAuditEntries() {
    return this.sqlite.prepare("SELECT * FROM student_phase_audit ORDER BY id").all() as unknown as PhaseAuditEntryStore[];
  }
  get appUsers() {
    return this.sqlite.prepare("SELECT * FROM app_users ORDER BY id").all() as unknown as AppUserStore[];
  }
  get appSecrets() {
    return this.sqlite.prepare("SELECT * FROM app_secrets").all() as unknown as AppSecretStore[];
  }
  get loginAttempts() {
    return this.sqlite.prepare("SELECT * FROM login_attempts").all() as unknown as LoginAttemptStore[];
  }

  seedRow(table: "students" | "meeting_logs" | "student_phase_audit" | "app_users" | "thesis_assignments", row: Record<string, D1Value>) {
    const columns = Object.keys(row);
    return Number(
      this.sqlite
        .prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`)
        .run(...Object.values(row)).lastInsertRowid,
    );
  }

  prepare(query: string) {
    return new MockPreparedStatement(this, query);
  }

  withSession(constraint: string) {
    this.sessionConstraints.push(constraint);
    return this;
  }

  async batch<T = unknown>(statements: MockPreparedStatement[]) {
    this.sqlite.exec("BEGIN");
    try {
      const results = statements.map((statement) => statement.runSync<T>());
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
}

class MockPreparedStatement {
  constructor(
    private db: MockD1Database,
    private query: string,
    private values: D1Value[] = [],
  ) {}
  bind(...values: D1Value[]) {
    return new MockPreparedStatement(this.db, this.query, values);
  }

  private statement(method: QueryCall["method"]) {
    const sql = this.query.replace(/\s+/g, " ").trim();
    this.db.calls.push({ method, query: this.query, values: this.values });
    if (this.db.failQueries.some((pattern) => (typeof pattern === "string" ? sql === pattern : pattern.test(sql)))) {
      throw new Error("Simulated database failure");
    }
    return this.db.sqlite.prepare(this.query);
  }

  runSync<T>() {
    const results = this.statement("run").all(...this.values) as T[];
    const meta = this.db.sqlite.prepare("SELECT changes() AS changes, last_insert_rowid() AS last_row_id").get() as {
      changes: number;
      last_row_id: number;
    };
    return { success: true, meta, results };
  }

  async run<T>() {
    return this.runSync<T>();
  }
  async first<T>() {
    return (this.statement("first").get(...this.values) as T | undefined) ?? null;
  }
  async all<T>() {
    return { results: this.statement("all").all(...this.values) as T[] };
  }
}
