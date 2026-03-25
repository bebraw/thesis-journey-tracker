import type { AccessRole } from "./auth";

export type PhaseId = "research_plan" | "researching" | "first_complete_draft" | "editing" | "submission_ready" | "submitted";

export type DegreeId = "bsc" | "msc" | "dsc";

export interface Student {
  id: number;
  name: string;
  email: string | null;
  degreeType: DegreeId;
  thesisTopic: string | null;
  startDate: string | null;
  targetSubmissionDate: string;
  currentPhase: PhaseId;
  nextMeetingAt: string | null;
  logCount: number;
  lastLogAt: string | null;
}

export interface MeetingLog {
  id: number;
  happenedAt: string;
  discussed: string;
  agreedPlan: string;
  nextStepDeadline: string | null;
}

export interface PhaseAuditEntry {
  id: number;
  changedAt: string;
  fromPhase: PhaseId;
  toPhase: PhaseId;
}

export interface StoredAuthUser {
  id: number;
  name: string;
  passwordHash: string;
  role: AccessRole;
}

export interface LoginAttempt {
  attemptKey: string;
  failureCount: number;
  firstFailedAt: string;
  lastFailedAt: string;
  lockedUntil: string | null;
}

type D1Value = string | number | null;

interface D1ExecMeta {
  last_row_id?: number | string;
  changes?: number;
}

interface D1ExecResult {
  success: boolean;
  meta: D1ExecMeta;
}

interface D1AllResult<T> {
  results: T[];
}

export interface D1PreparedStatement {
  bind(...values: D1Value[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1AllResult<T>>;
  run(): Promise<D1ExecResult>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
}

interface StudentRow {
  id: number | string;
  name: string;
  email: string | null;
  degree_type: DegreeId;
  thesis_topic: string | null;
  start_date: string | null;
  target_submission_date: string;
  current_phase: PhaseId;
  next_meeting_at: string | null;
  log_count: number | string | null;
  last_log_at: string | null;
}

interface LogRow {
  id: number | string;
  happened_at: string;
  discussed: string;
  agreed_plan: string;
  next_step_deadline: string | null;
}

interface PhaseAuditRow {
  id: number | string;
  changed_at: string;
  from_phase: PhaseId;
  to_phase: PhaseId;
}

interface AuthUserRow {
  id: number | string;
  name: string;
  password_hash: string;
  role: AccessRole;
}

interface LoginAttemptRow {
  attempt_key: string;
  failure_count: number | string;
  first_failed_at: string;
  last_failed_at: string;
  locked_until: string | null;
}

export interface StudentMutationInput {
  name: string;
  email: string | null;
  degreeType: DegreeId;
  thesisTopic: string | null;
  startDate: string | null;
  targetSubmissionDate: string;
  currentPhase: PhaseId;
  nextMeetingAt: string | null;
}

export type CreateStudentInput = StudentMutationInput;
export type UpdateStudentInput = StudentMutationInput;

export interface CreateLogInput {
  studentId: number;
  happenedAt: string;
  discussed: string;
  agreedPlan: string;
  nextStepDeadline: string | null;
}

export interface CreatePhaseAuditInput {
  studentId: number;
  changedAt: string;
  fromPhase: PhaseId;
  toPhase: PhaseId;
}

export interface UpsertAuthUserInput {
  name: string;
  passwordHash: string;
  role: AccessRole;
}

export async function listStudents(db: D1Database): Promise<Student[]> {
  const rows = await db
    .prepare(
      `SELECT
         s.*,
         COUNT(ml.id) AS log_count,
         MAX(ml.happened_at) AS last_log_at
       FROM students s
       LEFT JOIN meeting_logs ml
         ON ml.student_id = s.id
       GROUP BY s.id
       ORDER BY
         CASE WHEN s.next_meeting_at IS NULL THEN 1 ELSE 0 END,
         s.next_meeting_at ASC,
         s.target_submission_date ASC,
         s.name ASC`,
    )
    .all<StudentRow>();

  return rows.results.map((row) => ({
    id: parseDbNumber(row.id),
    name: row.name,
    email: row.email,
    degreeType: row.degree_type as DegreeId,
    thesisTopic: row.thesis_topic,
    startDate: row.start_date,
    targetSubmissionDate: row.target_submission_date,
    currentPhase: row.current_phase as PhaseId,
    nextMeetingAt: row.next_meeting_at,
    logCount: parseDbNumber(row.log_count),
    lastLogAt: row.last_log_at || null,
  }));
}

export async function listAuthUsers(db: D1Database): Promise<StoredAuthUser[]> {
  const rows = await db
    .prepare(
      `SELECT id, name, password_hash, role
       FROM app_users
       ORDER BY name ASC`,
    )
    .all<AuthUserRow>();

  return rows.results.map((row) => ({
    id: parseDbNumber(row.id),
    name: row.name,
    passwordHash: row.password_hash,
    role: row.role,
  }));
}

export async function upsertAuthUser(db: D1Database, input: UpsertAuthUserInput): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO app_users (name, password_hash, role)
       VALUES (?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET
         password_hash = excluded.password_hash,
         role = excluded.role`,
    )
    .bind(input.name, input.passwordHash, input.role)
    .run();

  if (!result.success) {
    throw new Error("Failed to save auth user.");
  }

  const row = await db
    .prepare(
      `SELECT id, name, password_hash, role
       FROM app_users
       WHERE name = ? COLLATE NOCASE`,
    )
    .bind(input.name)
    .first<AuthUserRow>();

  if (!row) {
    throw new Error("Failed to read saved auth user.");
  }

  return parseDbNumber(row.id);
}

export async function getLoginAttempt(db: D1Database, attemptKey: string): Promise<LoginAttempt | null> {
  const row = await db
    .prepare(
      `SELECT attempt_key, failure_count, first_failed_at, last_failed_at, locked_until
       FROM login_attempts
       WHERE attempt_key = ?`,
    )
    .bind(attemptKey)
    .first<LoginAttemptRow>();

  if (!row) {
    return null;
  }

  return {
    attemptKey: row.attempt_key,
    failureCount: parseDbNumber(row.failure_count),
    firstFailedAt: row.first_failed_at,
    lastFailedAt: row.last_failed_at,
    lockedUntil: row.locked_until,
  };
}

export async function saveLoginAttempt(db: D1Database, attempt: LoginAttempt): Promise<void> {
  await db
    .prepare(
      `INSERT INTO login_attempts (attempt_key, failure_count, first_failed_at, last_failed_at, locked_until)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(attempt_key) DO UPDATE SET
         failure_count = excluded.failure_count,
         first_failed_at = excluded.first_failed_at,
         last_failed_at = excluded.last_failed_at,
         locked_until = excluded.locked_until`,
    )
    .bind(attempt.attemptKey, attempt.failureCount, attempt.firstFailedAt, attempt.lastFailedAt, attempt.lockedUntil)
    .run();
}

export async function clearLoginAttempt(db: D1Database, attemptKey: string): Promise<void> {
  await db.prepare("DELETE FROM login_attempts WHERE attempt_key = ?").bind(attemptKey).run();
}

export async function getStudentById(db: D1Database, studentId: number): Promise<Student | null> {
  const row = await db
    .prepare(
      `SELECT
         s.*,
         COUNT(ml.id) AS log_count,
         MAX(ml.happened_at) AS last_log_at
       FROM students s
       LEFT JOIN meeting_logs ml
         ON ml.student_id = s.id
       WHERE s.id = ?
       GROUP BY s.id`,
    )
    .bind(studentId)
    .first<StudentRow>();

  if (!row) {
    return null;
  }

  return {
    id: parseDbNumber(row.id),
    name: row.name,
    email: row.email,
    degreeType: row.degree_type as DegreeId,
    thesisTopic: row.thesis_topic,
    startDate: row.start_date,
    targetSubmissionDate: row.target_submission_date,
    currentPhase: row.current_phase as PhaseId,
    nextMeetingAt: row.next_meeting_at,
    logCount: parseDbNumber(row.log_count),
    lastLogAt: row.last_log_at || null,
  };
}

export async function listLogsForStudent(db: D1Database, studentId: number): Promise<MeetingLog[]> {
  const rows = await db
    .prepare(
      `SELECT *
       FROM meeting_logs
       WHERE student_id = ?
       ORDER BY happened_at DESC, id DESC`,
    )
    .bind(studentId)
    .all<LogRow>();

  return rows.results.map((row) => ({
    id: parseDbNumber(row.id),
    happenedAt: row.happened_at,
    discussed: row.discussed,
    agreedPlan: row.agreed_plan,
    nextStepDeadline: row.next_step_deadline,
  }));
}

export async function listPhaseAuditEntriesForStudent(db: D1Database, studentId: number): Promise<PhaseAuditEntry[]> {
  const rows = await db
    .prepare(
      `SELECT *
       FROM student_phase_audit
       WHERE student_id = ?
       ORDER BY changed_at DESC, id DESC`,
    )
    .bind(studentId)
    .all<PhaseAuditRow>();

  return rows.results.map((row) => ({
    id: parseDbNumber(row.id),
    changedAt: row.changed_at,
    fromPhase: row.from_phase as PhaseId,
    toPhase: row.to_phase as PhaseId,
  }));
}

export async function createStudent(db: D1Database, input: CreateStudentInput): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO students (name, email, degree_type, thesis_topic, start_date, target_submission_date, current_phase, next_meeting_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.name,
      input.email,
      input.degreeType,
      input.thesisTopic,
      input.startDate,
      input.targetSubmissionDate,
      input.currentPhase,
      input.nextMeetingAt,
    )
    .run();

  return parseDbNumber(result.meta.last_row_id ?? 0);
}

export async function studentExists(db: D1Database, studentId: number): Promise<boolean> {
  const row = await db.prepare("SELECT id FROM students WHERE id = ?").bind(studentId).first();
  return Boolean(row);
}

export async function updateStudent(db: D1Database, studentId: number, input: UpdateStudentInput): Promise<void> {
  await db
    .prepare(
      `UPDATE students
       SET name = ?, email = ?, degree_type = ?, thesis_topic = ?, start_date = ?, target_submission_date = ?, current_phase = ?, next_meeting_at = ?
       WHERE id = ?`,
    )
    .bind(
      input.name,
      input.email,
      input.degreeType,
      input.thesisTopic,
      input.startDate,
      input.targetSubmissionDate,
      input.currentPhase,
      input.nextMeetingAt,
      studentId,
    )
    .run();
}

export async function deleteStudent(db: D1Database, studentId: number): Promise<void> {
  await db.prepare("DELETE FROM students WHERE id = ?").bind(studentId).run();
}

export async function deleteAllStudents(db: D1Database): Promise<void> {
  await db.prepare("DELETE FROM students").run();
}

export async function createMeetingLog(db: D1Database, input: CreateLogInput): Promise<void> {
  await db
    .prepare(
      `INSERT INTO meeting_logs (student_id, happened_at, discussed, agreed_plan, next_step_deadline)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(input.studentId, input.happenedAt, input.discussed, input.agreedPlan, input.nextStepDeadline)
    .run();
}

export async function createPhaseAuditEntry(db: D1Database, input: CreatePhaseAuditInput): Promise<void> {
  await db
    .prepare(
      `INSERT INTO student_phase_audit (student_id, changed_at, from_phase, to_phase)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(input.studentId, input.changedAt, input.fromPhase, input.toPhase)
    .run();
}

function parseDbNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}
