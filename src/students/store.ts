import type { D1Database, D1PreparedStatement } from "../db-core";
import { parseDbNumber } from "../db-core";

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
  includeArchived?: boolean;
  onlyArchived?: boolean;
}

interface StudentRow {
  id: number | string;
  name: string;
  email: string | null;
  degree_type: DegreeId;
  thesis_topic: string | null;
  student_notes: string | null;
  start_date: string | null;
  current_phase: PhaseId;
  next_meeting_at: string | null;
  archived_at: string | null;
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

export async function listStudents(db: D1Database, options: StudentQueryOptions = {}): Promise<Student[]> {
  const whereClause = buildStudentVisibilityWhereClause("s", options);
  const rows = await db
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
    .all<StudentRow>();

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
    .bind(studentId)
    .first<StudentRow>();

  return row ? mapStudentRow(row) : null;
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
    fromPhase: row.from_phase,
    toPhase: row.to_phase,
  }));
}

export async function createStudent(db: D1Database, input: CreateStudentInput): Promise<number> {
  const result = await db
    .prepare(buildInsertStudentQuery())
    .bind(...studentMutationValues(input))
    .run();

  return parseDbNumber(result.meta.last_row_id ?? 0);
}

export async function studentExists(db: D1Database, studentId: number, options: StudentQueryOptions = {}): Promise<boolean> {
  const whereClause = buildStudentVisibilityWhereClause("", options, "id = ?");
  const row = await db.prepare(`SELECT id FROM students ${whereClause}`).bind(studentId).first();
  return Boolean(row);
}

export async function updateStudent(db: D1Database, studentId: number, input: UpdateStudentInput): Promise<void> {
  await buildUpdateStudentStatement(db, studentId, input).run();
}

export async function updateStudentWithPhaseAudit(
  db: D1Database,
  studentId: number,
  input: UpdateStudentInput,
  auditEntry: CreatePhaseAuditInput,
): Promise<void> {
  await db.batch([buildUpdateStudentStatement(db, studentId, input), buildCreatePhaseAuditStatement(db, auditEntry)]);
}

export async function archiveStudent(db: D1Database, studentId: number, archivedAt: string): Promise<void> {
  await db.prepare("UPDATE students SET archived_at = ? WHERE id = ? AND archived_at IS NULL").bind(archivedAt, studentId).run();
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
  await buildCreatePhaseAuditStatement(db, input).run();
}

function mapStudentRow(row: StudentRow): Student {
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
    archivedAt: row.archived_at || null,
    logCount: parseDbNumber(row.log_count),
    lastLogAt: row.last_log_at || null,
  };
}

function buildInsertStudentQuery(): string {
  return `INSERT INTO students (name, email, degree_type, thesis_topic, student_notes, start_date, current_phase, next_meeting_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
}

function buildUpdateStudentStatement(db: D1Database, studentId: number, input: UpdateStudentInput): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE students
       SET name = ?, email = ?, degree_type = ?, thesis_topic = ?, student_notes = ?, start_date = ?, current_phase = ?, next_meeting_at = ?
       WHERE id = ?`,
    )
    .bind(...studentMutationValues(input), studentId);
}

function buildCreatePhaseAuditStatement(db: D1Database, input: CreatePhaseAuditInput): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO student_phase_audit (student_id, changed_at, from_phase, to_phase)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(input.studentId, input.changedAt, input.fromPhase, input.toPhase);
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

  if (conditions.length === 0) {
    return "";
  }

  return `WHERE ${conditions.join(" AND ")}`;
}
