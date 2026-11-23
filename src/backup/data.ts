import type { D1Database } from "../db-core";
import type { DataExportFile, ExportedAssignment, StudentExportBundle } from "../data-transfer/types";
import {
  mapLogRow,
  mapPhaseAuditRow,
  mapStudentRow,
  prepareListStudents,
  type LogRow,
  type PhaseAuditRow,
  type StudentRow,
} from "../students/store";

function snapshotRows<T>(result: { success: boolean; results?: unknown[] } | undefined): T[] {
  if (!result?.success || !Array.isArray(result.results)) throw new Error("Incomplete thesis backup snapshot.");
  return result.results as T[];
}

export async function collectStudentBackupBundles(db: D1Database): Promise<StudentExportBundle[]> {
  // A replacement restore can reuse thesis IDs. Read all four tables in a single D1 transaction.
  const [students, logs, history, assignments] = await db.batch([
    prepareListStudents(db, { includeArchived: true }),
    db.prepare("SELECT * FROM meeting_logs ORDER BY student_id, happened_at DESC, id DESC"),
    db.prepare("SELECT * FROM student_phase_audit ORDER BY student_id, changed_at DESC, id DESC"),
    db.prepare(`SELECT a.student_id, a.user_id AS userId, u.name, a.assignment_role AS role
      FROM thesis_assignments a JOIN app_users u ON u.id = a.user_id
      ORDER BY a.student_id, a.assignment_role, u.name`),
  ]);
  const bundles = new Map<number, StudentExportBundle>();
  for (const row of snapshotRows<StudentRow>(students)) {
    const student = mapStudentRow(row);
    bundles.set(student.id, { student, assignments: [], logs: [], phaseAudit: [] });
  }
  for (const row of snapshotRows<LogRow & { student_id: number }>(logs)) {
    bundles.get(row.student_id)!.logs.push(mapLogRow(row));
  }
  for (const row of snapshotRows<PhaseAuditRow & { student_id: number }>(history)) {
    bundles.get(row.student_id)!.phaseAudit.push(mapPhaseAuditRow(row));
  }
  for (const { student_id, userId, name, role } of snapshotRows<ExportedAssignment & { student_id: number }>(assignments)) {
    bundles.get(student_id)!.assignments.push({ userId, name, role });
  }
  return [...bundles.values()];
}

export async function createDataExportContentHash(dataExport: DataExportFile): Promise<string> {
  const stableContent = JSON.stringify({
    app: dataExport.app,
    schemaVersion: dataExport.schemaVersion,
    students: dataExport.students,
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stableContent));
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}
