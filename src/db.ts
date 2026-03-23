export type PhaseId = "research_plan" | "researching" | "first_complete_draft" | "editing" | "submission_ready" | "submitted";

export type DegreeId = "bsc" | "msc" | "dsc";

export interface Student {
  id: number;
  name: string;
  email: string | null;
  degreeType: DegreeId;
  thesisTopic: string | null;
  startDate: string;
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

interface D1PreparedStatement {
  bind(...values: D1Value[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1AllResult<T>>;
  run(): Promise<D1ExecResult>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface StudentRow {
  id: number | string;
  name: string;
  email: string | null;
  degree_type: DegreeId;
  thesis_topic: string | null;
  start_date: string;
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

export interface StudentMutationInput {
  name: string;
  email: string | null;
  degreeType: DegreeId;
  thesisTopic: string | null;
  startDate: string;
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
