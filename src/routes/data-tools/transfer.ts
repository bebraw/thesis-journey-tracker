import type { Env } from "../../app-env";
import {
  buildExportFilename,
  buildProfessorReportFilename,
  countImportedLogs,
  countImportedPhaseAuditEntries,
  createDataExport,
  createProfessorStatusReport,
  parseDataImport,
  type ImportedStudentBundle,
} from "../../data-transfer";
import type { D1Database, D1PreparedStatement } from "../../db-core";
import { redirect } from "../../http/response";
import { listLogsForStudent, listPhaseAuditEntriesForStudent, listStudents } from "../../students/store";

const MAX_IMPORT_BATCH_STATEMENTS = 750;

export async function handleExportJson(env: Env): Promise<Response> {
  const students = await listStudents(env.DB, { includeArchived: true });
  const studentBundles = await Promise.all(
    students.map(async (student) => ({
      student,
      logs: await listLogsForStudent(env.DB, student.id),
      phaseAudit: await listPhaseAuditEntriesForStudent(env.DB, student.id),
    })),
  );

  const body = JSON.stringify(createDataExport(studentBundles), null, 2);

  return new Response(body, {
    headers: {
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="${buildExportFilename()}"`,
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export async function handleProfessorReportExport(env: Env): Promise<Response> {
  const students = await listStudents(env.DB);
  const studentBundles = await Promise.all(
    students.map(async (student) => {
      const logs = await listLogsForStudent(env.DB, student.id);
      return {
        student,
        latestLog: logs[0] || null,
      };
    }),
  );

  const body = createProfessorStatusReport(studentBundles);

  return new Response(body, {
    headers: {
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="${buildProfessorReportFilename()}"`,
      "content-type": "text/markdown; charset=utf-8",
    },
  });
}

export async function handleImportJson(request: Request, env: Env): Promise<Response> {
  const formData = await request.formData();
  const file = formData.get("importFile");
  const mode = formData.get("mode") === "replace" ? "replace" : "append";
  const replaceConfirmed = formData.get("confirmReplace") === "yes";
  const replaceImportEnabled = isReplaceImportEnabled(env);

  if (!file || typeof file !== "object" || !("text" in file) || typeof file.text !== "function") {
    return redirect("/data-tools?error=Choose+a+JSON+file+to+import");
  }

  const { data, error } = parseDataImport(await file.text());
  if (!data || error) {
    return redirect(`/data-tools?error=${encodeURIComponent(error || "Import+failed")}`);
  }

  if (mode === "replace" && !replaceConfirmed) {
    return redirect("/data-tools?error=Confirm+replacement+before+importing");
  }

  if (mode === "replace" && !replaceImportEnabled) {
    return redirect("/data-tools?error=Replacement+imports+are+disabled+in+this+environment");
  }

  const importSizeError = validateImportBatchSize(data, mode);
  if (importSizeError) {
    return redirect(`/data-tools?error=${encodeURIComponent(importSizeError)}`);
  }

  try {
    const statements = await buildImportStatements(env.DB, data, mode);
    if (statements.length > 0) {
      await env.DB.batch(statements);
    }
  } catch (error) {
    console.error("Import failed", error);
    const errorMessage =
      mode === "replace" ? "Replacement import failed. Existing data was left unchanged." : "Import failed. No changes were saved.";
    return redirect(`/data-tools?error=${encodeURIComponent(errorMessage)}`);
  }

  const logCount = countImportedLogs(data);
  const phaseAuditCount = countImportedPhaseAuditEntries(data);
  const modeText = mode === "replace" ? "replaced existing data" : "appended to existing data";
  return redirect(
    `/data-tools?notice=${encodeURIComponent(`Imported ${data.length} students, ${logCount} logs, and ${phaseAuditCount} phase changes; ${modeText}.`)}`,
  );
}

export function isReplaceImportEnabled(env: Env): boolean {
  const rawValue = (env.REPLACE_IMPORT_ENABLED || "").trim().toLocaleLowerCase();
  return rawValue === "1" || rawValue === "true" || rawValue === "yes";
}

async function buildImportStatements(
  db: D1Database,
  data: ImportedStudentBundle[],
  mode: "append" | "replace",
): Promise<D1PreparedStatement[]> {
  const baseIds = mode === "replace" ? { student: 0, log: 0, phaseAudit: 0 } : await readCurrentImportIds(db);
  let nextStudentId = baseIds.student + 1;
  let nextLogId = baseIds.log + 1;
  let nextPhaseAuditId = baseIds.phaseAudit + 1;

  const statements: D1PreparedStatement[] = [];

  if (mode === "replace") {
    statements.push(db.prepare("DELETE FROM students"));
  }

  for (const bundle of data) {
    const studentId = nextStudentId;
    nextStudentId += 1;

    statements.push(
      db
        .prepare(
          `INSERT INTO students (id, name, email, degree_type, thesis_topic, student_notes, start_date, current_phase, next_meeting_at, archived_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          studentId,
          bundle.student.name,
          bundle.student.email,
          bundle.student.degreeType,
          bundle.student.thesisTopic,
          bundle.student.studentNotes,
          bundle.student.startDate,
          bundle.student.currentPhase,
          bundle.student.nextMeetingAt,
          bundle.archivedAt,
        ),
    );

    for (const log of bundle.logs) {
      statements.push(
        db
          .prepare(
            `INSERT INTO meeting_logs (id, student_id, happened_at, discussed, agreed_plan, next_step_deadline)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .bind(nextLogId, studentId, log.happenedAt, log.discussed, log.agreedPlan, log.nextStepDeadline),
      );
      nextLogId += 1;
    }

    for (const entry of bundle.phaseAudit) {
      statements.push(
        db
          .prepare(
            `INSERT INTO student_phase_audit (id, student_id, changed_at, from_phase, to_phase)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .bind(nextPhaseAuditId, studentId, entry.changedAt, entry.fromPhase, entry.toPhase),
      );
      nextPhaseAuditId += 1;
    }
  }

  return statements;
}

async function readCurrentImportIds(db: D1Database): Promise<{ student: number; log: number; phaseAudit: number }> {
  const [studentRow, logRow, phaseAuditRow] = await Promise.all([
    db.prepare("SELECT COALESCE(MAX(id), 0) AS max_id FROM students").first<{ max_id: number | string | null }>(),
    db.prepare("SELECT COALESCE(MAX(id), 0) AS max_id FROM meeting_logs").first<{ max_id: number | string | null }>(),
    db.prepare("SELECT COALESCE(MAX(id), 0) AS max_id FROM student_phase_audit").first<{ max_id: number | string | null }>(),
  ]);

  return {
    student: parseMaxIdValue(studentRow?.max_id),
    log: parseMaxIdValue(logRow?.max_id),
    phaseAudit: parseMaxIdValue(phaseAuditRow?.max_id),
  };
}

function parseMaxIdValue(value: number | string | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function validateImportBatchSize(data: ImportedStudentBundle[], mode: "append" | "replace"): string | null {
  const logCount = countImportedLogs(data);
  const phaseAuditCount = countImportedPhaseAuditEntries(data);
  const totalStatements = data.length + logCount + phaseAuditCount + (mode === "replace" ? 1 : 0);

  if (totalStatements > MAX_IMPORT_BATCH_STATEMENTS) {
    return `Import is too large for a single D1 batch. This file would execute ${totalStatements} statements, but the safe limit is ${MAX_IMPORT_BATCH_STATEMENTS}. Split the import into smaller files or reduce meeting logs and phase history.`;
  }

  return null;
}
