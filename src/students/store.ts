import type { D1Database, D1PreparedStatement } from "../db-core";
import { parseDbNumber, requireD1MutationSuccess, requireD1ReturnedId } from "../db-core";
import type { MeetingSchedule } from "./recurrence";

export type PhaseId = "research_plan" | "researching" | "editing" | "submitted";

export type DegreeId = "bsc" | "msc" | "dsc";

export interface Student {
  id: number;
  name: string;
  email: string | null;
  degreeType: DegreeId;
  thesisTopic: string | null;
  studentNotes: string | null;
  startDate: string | null;
  currentPhase: PhaseId;
  nextMeetingAt: string | null;
  meetingSchedule?: MeetingSchedule | null;
  archivedAt: string | null;
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

export interface StudentMutationInput {
  name: string;
  email: string | null;
  degreeType: DegreeId;
  thesisTopic: string | null;
  studentNotes: string | null;
  startDate: string | null;
  currentPhase: PhaseId;
  nextMeetingAt: string | null;
  meetingSchedule?: MeetingSchedule | null;
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

export interface StudentQueryOptions {
  userId?: number;
  includeArchived?: boolean;
  onlyArchived?: boolean;
}

export interface StudentRow {
  id: number | string;
  name: string;
  email: string | null;
  degree_type: DegreeId;
  thesis_topic: string | null;
  student_notes: string | null;
  start_date: string | null;
  current_phase: PhaseId;
  next_meeting_at: string | null;
  meeting_schedule?: string | null;
  archived_at: string | null;
  log_count: number | string | null;
  last_log_at: string | null;
}

export interface LogRow {
  id: number | string;
  happened_at: string;
  discussed: string;
  agreed_plan: string;
  next_step_deadline: string | null;
}

export interface PhaseAuditRow {
  id: number | string;
  changed_at: string;
  from_phase: PhaseId;
  to_phase: PhaseId;
}

export function prepareListStudents(db: D1Database, options: StudentQueryOptions): D1PreparedStatement {
  const whereClause = buildStudentVisibilityWhereClause("s", options);
  return db
    .prepare(
      `SELECT
         s.*,
         COUNT(ml.id) AS log_count,
         MAX(ml.happened_at) AS last_log_at
       FROM students s
       LEFT JOIN meeting_logs ml
         ON ml.student_id = s.id
       ${whereClause}
       GROUP BY s.id
       ORDER BY
         CASE WHEN s.archived_at IS NULL THEN 0 ELSE 1 END,
         CASE WHEN s.next_meeting_at IS NULL THEN 1 ELSE 0 END,
         s.next_meeting_at ASC,
         CASE WHEN s.start_date IS NULL THEN 1 ELSE 0 END,
         DATE(s.start_date, '+6 months') ASC,
         s.name ASC`,
    )
    .bind(...actorParameters(options.userId));
}

export async function listStudents(db: D1Database, options: StudentQueryOptions = {}): Promise<Student[]> {
  const rows = await prepareListStudents(db, options).all<StudentRow>();

  return rows.results.map(mapStudentRow);
}

export async function getStudentById(db: D1Database, studentId: number, options: StudentQueryOptions = {}): Promise<Student | null> {
  const whereClause = buildStudentVisibilityWhereClause("s", options, "s.id = ?");
  const row = await db
    .prepare(
      `SELECT
         s.*,
         COUNT(ml.id) AS log_count,
         MAX(ml.happened_at) AS last_log_at
       FROM students s
       LEFT JOIN meeting_logs ml
         ON ml.student_id = s.id
       ${whereClause}
       GROUP BY s.id`,
    )
    .bind(studentId, ...actorParameters(options.userId))
    .first<StudentRow>();

  return row ? mapStudentRow(row) : null;
}

export async function listLogsForStudent(db: D1Database, studentId: number, userId?: number): Promise<MeetingLog[]> {
  const rows = await db
    .prepare(
      `SELECT *
       FROM meeting_logs
       WHERE student_id = ?${assignmentFilter(userId, "meeting_logs.student_id", "read")}
       ORDER BY happened_at DESC, id DESC`,
    )
    .bind(studentId, ...actorParameters(userId))
    .all<LogRow>();

  return rows.results.map(mapLogRow);
}

export function mapLogRow(row: LogRow): MeetingLog {
  return {
    id: parseDbNumber(row.id),
    happenedAt: row.happened_at,
    discussed: row.discussed,
    agreedPlan: row.agreed_plan,
    nextStepDeadline: row.next_step_deadline,
  };
}

export async function listPhaseAuditEntriesForStudent(db: D1Database, studentId: number, userId?: number): Promise<PhaseAuditEntry[]> {
  const rows = await db
    .prepare(
      `SELECT *
       FROM student_phase_audit
       WHERE student_id = ?${assignmentFilter(userId, "student_phase_audit.student_id", "read")}
       ORDER BY changed_at DESC, id DESC`,
    )
    .bind(studentId, ...actorParameters(userId))
    .all<PhaseAuditRow>();

  return rows.results.map(mapPhaseAuditRow);
}

export function mapPhaseAuditRow(row: PhaseAuditRow): PhaseAuditEntry {
  return {
    id: parseDbNumber(row.id),
    changedAt: row.changed_at,
    fromPhase: row.from_phase,
    toPhase: row.to_phase,
  };
}

export async function createStudent(db: D1Database, input: CreateStudentInput, userId?: number): Promise<number> {
  if (userId !== undefined) {
    const supervisor = "EXISTS (SELECT 1 FROM app_users WHERE id = ? AND disabled_at IS NULL AND role = 'editor' AND can_supervise = 1)";
    // The insert and lead assignment share one transaction, including the eligibility check.
    const results = await db.batch<{ id: number }>([
      db
        .prepare(buildInsertStudentQuery(`SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${supervisor}`))
        .bind(...studentMutationValues(input), userId),
      db
        .prepare(
          `INSERT INTO thesis_assignments (student_id, user_id, assignment_role)
                  SELECT id, ?, 'supervisor' FROM students WHERE ${supervisor} ORDER BY id DESC LIMIT 1
                  RETURNING student_id AS id`,
        )
        .bind(userId, userId),
    ]);
    requireD1BatchIds(results, "Creating supervised student", 2);
    return requireD1ReturnedId(results[0]!, "Creating supervised student");
  }
  const result = await db
    .prepare(buildInsertStudentQuery())
    .bind(...studentMutationValues(input))
    .run<{ id: number | string }>();

  return requireD1ReturnedId(result, "Creating student");
}

export async function studentExists(db: D1Database, studentId: number, options: StudentQueryOptions = {}): Promise<boolean> {
  const whereClause = buildStudentVisibilityWhereClause("", options, "id = ?");
  const row = await db
    .prepare(`SELECT id FROM students ${whereClause}`)
    .bind(studentId, ...actorParameters(options.userId))
    .first();
  return Boolean(row);
}

export async function canManageStudent(db: D1Database, studentId: number, userId: number): Promise<boolean> {
  const row = await db
    .prepare(`SELECT id FROM students WHERE id = ?${assignmentFilter(userId, "students.id", "manage")}`)
    .bind(studentId, userId)
    .first();
  return Boolean(row);
}

export async function updateStudent(db: D1Database, studentId: number, input: UpdateStudentInput, userId?: number): Promise<void> {
  const result = await buildUpdateStudentStatement(db, studentId, input, userId).run<{ id: number | string }>();
  requireD1ReturnedId(result, "Updating student");
}

export async function updateStudentWithPhaseAudit(
  db: D1Database,
  studentId: number,
  input: UpdateStudentInput,
  auditEntry: CreatePhaseAuditInput,
  userId?: number,
): Promise<void> {
  if (auditEntry.studentId !== studentId) throw new Error("The phase history must belong to the updated student.");
  const results = await db.batch<{ id: number | string }>([
    buildUpdateStudentStatement(db, studentId, input, userId),
    buildCreatePhaseAuditStatement(db, auditEntry, userId),
  ]);
  requireD1BatchIds(results, "Updating student with phase audit", 2);
}

export async function archiveStudent(db: D1Database, studentId: number, archivedAt: string, userId?: number): Promise<void> {
  const result = await db
    .prepare(
      `UPDATE students SET archived_at = ? WHERE id = ? AND archived_at IS NULL${assignmentFilter(userId, "students.id", "manage")} RETURNING id`,
    )
    .bind(archivedAt, studentId, ...actorParameters(userId))
    .run<{ id: number | string }>();
  requireD1ReturnedId(result, "Archiving student");
}

export async function restoreStudent(db: D1Database, studentId: number, userId?: number): Promise<void> {
  const result = await db
    .prepare(
      `UPDATE students SET archived_at = NULL WHERE id = ? AND archived_at IS NOT NULL${assignmentFilter(userId, "students.id", "manage")} RETURNING id`,
    )
    .bind(studentId, ...actorParameters(userId))
    .run<{ id: number | string }>();
  requireD1ReturnedId(result, "Restoring student");
}

export async function deleteArchivedStudent(db: D1Database, studentId: number, userId: number): Promise<boolean> {
  const result = await db
    .prepare(
      `DELETE FROM students WHERE id = ? AND archived_at IS NOT NULL${assignmentFilter(userId, "students.id", "manage")} RETURNING id`,
    )
    .bind(studentId, userId)
    .run();
  requireD1MutationSuccess(result, "Deleting archived student");
  return Boolean(result.results?.length);
}

export async function deleteAllStudents(db: D1Database): Promise<void> {
  const result = await db.prepare("DELETE FROM students").run();
  requireD1MutationSuccess(result, "Deleting all students");
}

export async function createMeetingLog(db: D1Database, input: CreateLogInput, userId?: number): Promise<void> {
  const result = await buildCreateMeetingLogStatement(db, input, userId).run<{ id: number | string }>();
  requireD1ReturnedId(result, "Creating meeting log");
}

export async function createMeetingLogWithNextMeeting(
  db: D1Database,
  input: CreateLogInput,
  nextMeetingAt: string | null,
  clearSchedule = false,
  userId?: number,
): Promise<void> {
  const results = await db.batch<{ id: number | string }>([
    buildCreateMeetingLogStatement(db, input, userId),
    db
      .prepare(
        `UPDATE students SET next_meeting_at = ?${clearSchedule ? ", meeting_schedule = NULL" : ""} WHERE id = ?${activeEditFilter(userId)} RETURNING id`,
      )
      .bind(nextMeetingAt, input.studentId, ...actorParameters(userId)),
  ]);
  requireD1BatchIds(results, "Creating meeting log with next meeting", 2);
}

export async function createPhaseAuditEntry(db: D1Database, input: CreatePhaseAuditInput): Promise<void> {
  const result = await buildCreatePhaseAuditStatement(db, input).run<{ id: number | string }>();
  requireD1ReturnedId(result, "Creating phase audit entry");
}

export function mapStudentRow(row: StudentRow): Student {
  return {
    id: parseDbNumber(row.id),
    name: row.name,
    email: row.email,
    degreeType: row.degree_type,
    thesisTopic: row.thesis_topic,
    studentNotes: row.student_notes,
    startDate: row.start_date,
    currentPhase: row.current_phase,
    nextMeetingAt: row.next_meeting_at,
    meetingSchedule: row.meeting_schedule ? (JSON.parse(row.meeting_schedule) as MeetingSchedule) : null,
    archivedAt: row.archived_at || null,
    logCount: parseDbNumber(row.log_count),
    lastLogAt: row.last_log_at || null,
  };
}

function buildInsertStudentQuery(values = "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"): string {
  return `INSERT INTO students (name, email, degree_type, thesis_topic, student_notes, start_date, current_phase, next_meeting_at, meeting_schedule)
       ${values}
       RETURNING id`;
}

function buildUpdateStudentStatement(db: D1Database, studentId: number, input: UpdateStudentInput, userId?: number): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE students
       SET name = ?, email = ?, degree_type = ?, thesis_topic = ?, student_notes = ?, start_date = ?, current_phase = ?, next_meeting_at = ?, meeting_schedule = CASE WHEN ? THEN ? ELSE meeting_schedule END
       WHERE id = ?${activeEditFilter(userId)}
       RETURNING id`,
    )
    .bind(
      ...studentMutationValues(input).slice(0, 8),
      input.meetingSchedule !== undefined ? 1 : 0,
      input.meetingSchedule ? JSON.stringify(input.meetingSchedule) : null,
      studentId,
      ...actorParameters(userId),
    );
}

function buildCreatePhaseAuditStatement(db: D1Database, input: CreatePhaseAuditInput, userId?: number): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO student_phase_audit (student_id, changed_at, from_phase, to_phase)
       ${userId === undefined ? "VALUES (?, ?, ?, ?)" : `SELECT ?, ?, ?, ? FROM students WHERE id = ?${activeEditFilter(userId)}`}
       RETURNING id`,
    )
    .bind(input.studentId, input.changedAt, input.fromPhase, input.toPhase, ...(userId === undefined ? [] : [input.studentId, userId]));
}

function buildCreateMeetingLogStatement(db: D1Database, input: CreateLogInput, userId?: number): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO meeting_logs (student_id, happened_at, discussed, agreed_plan, next_step_deadline)
       ${userId === undefined ? "VALUES (?, ?, ?, ?, ?)" : `SELECT ?, ?, ?, ?, ? FROM students WHERE id = ?${activeEditFilter(userId)}`}
       RETURNING id`,
    )
    .bind(
      input.studentId,
      input.happenedAt,
      input.discussed,
      input.agreedPlan,
      input.nextStepDeadline,
      ...(userId === undefined ? [] : [input.studentId, userId]),
    );
}

function actorParameters(userId: number | undefined): number[] {
  return userId === undefined ? [] : [userId];
}

function activeEditFilter(userId: number | undefined): string {
  return userId === undefined ? "" : ` AND archived_at IS NULL${assignmentFilter(userId, "students.id", "edit")}`;
}

function assignmentFilter(userId: number | undefined, studentColumn: string, permission: "read" | "edit" | "manage"): string {
  if (userId === undefined) return "";
  const assignment =
    permission === "manage"
      ? "ta.assignment_role = 'supervisor' AND u.can_supervise = 1"
      : "(ta.assignment_role = 'advisor' OR u.can_supervise = 1)";
  return ` AND EXISTS (SELECT 1 FROM thesis_assignments ta JOIN app_users u ON u.id = ta.user_id
    WHERE ta.student_id = ${studentColumn} AND ta.user_id = ? AND u.disabled_at IS NULL
    AND ${assignment}${permission === "read" ? "" : " AND u.role = 'editor'"})`;
}

function requireD1BatchIds(
  results: Array<{ success: boolean; meta: { changes?: number }; results?: Array<{ id: number | string }> }>,
  operation: string,
  expectedCount: number,
): void {
  if (results.length !== expectedCount) {
    throw new Error(`${operation} returned an incomplete database batch.`);
  }
  results.forEach((result) => requireD1ReturnedId(result, operation));
}

function studentMutationValues(input: StudentMutationInput): Array<string | number | null> {
  return [
    input.name,
    input.email,
    input.degreeType,
    input.thesisTopic,
    input.studentNotes,
    input.startDate,
    input.currentPhase,
    input.nextMeetingAt,
    input.meetingSchedule ? JSON.stringify(input.meetingSchedule) : null,
  ];
}

function buildStudentVisibilityWhereClause(alias: string, options: StudentQueryOptions, baseCondition?: string): string {
  const qualifier = alias ? `${alias}.` : "";
  const conditions: string[] = [];

  if (baseCondition) {
    conditions.push(baseCondition);
  }

  if (options.onlyArchived) {
    conditions.push(`${qualifier}archived_at IS NOT NULL`);
  } else if (!options.includeArchived) {
    conditions.push(`${qualifier}archived_at IS NULL`);
  }

  const assignment = assignmentFilter(options.userId, `${alias || "students"}.id`, "read");
  if (!conditions.length) return assignment ? `WHERE 1 = 1${assignment}` : "";
  return `WHERE ${conditions.join(" AND ")}${assignment}`;
}
