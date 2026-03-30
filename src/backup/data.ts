import type { D1Database } from "../db-core";
import { type DataExportFile } from "../data-transfer";
import { listLogsForStudent, listPhaseAuditEntriesForStudent, listStudents } from "../students/store";
import type { StudentBackupBundle } from "./types";

export async function collectStudentBackupBundles(db: D1Database): Promise<StudentBackupBundle[]> {
  const students = await listStudents(db, { includeArchived: true });
  return Promise.all(
    students.map(async (student) => ({
      student,
      logs: await listLogsForStudent(db, student.id),
      phaseAudit: await listPhaseAuditEntriesForStudent(db, student.id),
    })),
  );
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
