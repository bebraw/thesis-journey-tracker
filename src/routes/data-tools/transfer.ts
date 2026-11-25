import { collectStudentBackup } from "../../backup/data";
import { resolveImportAssignments, type ResolvedBundle } from "./import-assignments";
import type { Env } from "../../app-env";
import type { SessionUser } from "../../auth";
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
import { IMPORT_FILE_LIMIT_BYTES, IMPORT_FORM_BODY_LIMIT_BYTES, readFormData } from "../../http/request-body";
import { redirect } from "../../http/response";
import { logError } from "../../observability/error-logging";
import { listLogsForStudent, listStudents } from "../../students/store";

const MAX_IMPORT_BATCH_STATEMENTS = 750;

export async function handleExportJson(env: Env): Promise<Response> {
  const { bundles, installationId } = await collectStudentBackup(env.DB);
  const body = JSON.stringify(createDataExport(bundles, installationId), null, 2);

  return new Response(body, {
    headers: {
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="${buildExportFilename()}"`,
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export async function handleProfessorReportExport(env: Env, userId: number): Promise<Response> {
  const students = await listStudents(env.DB, { userId });
  const studentBundles = await Promise.all(
    students.map(async (student) => {
      const logs = await listLogsForStudent(env.DB, student.id, userId);
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

export async function handleImportJson(request: Request, env: Env, actor: SessionUser): Promise<Response> {
  const formData = await readFormData(request, { maxBytes: IMPORT_FORM_BODY_LIMIT_BYTES });
  const file = formData.get("importFile");
  const mode = formData.get("mode") === "replace" ? "replace" : "append";
  const replaceConfirmed = formData.get("confirmReplace") === "yes";
  const replaceImportEnabled = isReplaceImportEnabled(env);

  if (!file || typeof file !== "object" || !("text" in file) || typeof file.text !== "function") {
    return redirect("/data-tools?error=Choose+a+JSON+file+to+import");
  }

  const fileSize = "size" in file && typeof file.size === "number" ? file.size : Number.POSITIVE_INFINITY;
  if (fileSize > IMPORT_FILE_LIMIT_BYTES) {
    return redirect("/data-tools?error=Import+file+exceeds+the+4+MiB+limit");
  }

  const { data, installationId, error } = parseDataImport(await file.text());
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
    const resolved = await resolveImportAssignments(env.DB, data, { installationId, form: formData, file, mode, actor });
    if (resolved instanceof Response) return resolved;
    if (typeof resolved === "string") {
      return redirect(`/data-tools?error=${encodeURIComponent(resolved)}`);
    }
    const authorize = env.DB.prepare("INSERT INTO student_import_administrators (user_id, session_version) VALUES (?, ?)").bind(
      actor.id,
      actor.sessionVersion,
    );
    await env.DB.batch([authorize, ...buildImportStatements(env.DB, resolved, mode)]);
  } catch (error) {
    logError("data_import.failed", error);
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

function buildImportStatements(db: D1Database, data: ResolvedBundle[], mode: "append" | "replace"): D1PreparedStatement[] {
  const statements: D1PreparedStatement[] = [];
  // AUTOINCREMENT gives the new student the greatest ID, even after a replacement.
  // Its team and history are inserted before the next student in the same D1 transaction.
  const importedStudentId = "(SELECT MAX(id) FROM students)";

  if (mode === "replace") {
    statements.push(db.prepare("DELETE FROM students"));
  }

  for (const bundle of data) {
    statements.push(
      db
        .prepare(
          `INSERT INTO students (name, email, degree_type, thesis_topic, student_notes, start_date, current_phase, next_meeting_at, archived_at, meeting_schedule)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          bundle.student.name,
          bundle.student.email,
          bundle.student.degreeType,
          bundle.student.thesisTopic,
          bundle.student.studentNotes,
          bundle.student.startDate,
          bundle.student.currentPhase,
          bundle.student.nextMeetingAt,
          bundle.archivedAt,
          bundle.student.meetingSchedule ? JSON.stringify(bundle.student.meetingSchedule) : null,
        ),
    );

    for (const assignment of bundle.assignments) {
      // A missing or changed account yields NULL and fails the whole restore batch.
      statements.push(
        db
          .prepare(
            `INSERT INTO thesis_assignments (student_id, user_id, assignment_role)
           VALUES (${importedStudentId}, (SELECT id FROM app_users WHERE id = ? AND COALESCE(backup_name, name) = ? COLLATE BINARY
             AND disabled_at IS NULL AND (? = 'advisor' OR (role = 'editor' AND can_supervise = 1))), ?)`,
          )
          .bind(assignment.userId, assignment.name, assignment.role, assignment.role),
      );
    }

    for (const log of bundle.logs) {
      statements.push(
        db
          .prepare(
            `INSERT INTO meeting_logs (student_id, happened_at, discussed, agreed_plan, next_step_deadline)
             VALUES (${importedStudentId}, ?, ?, ?, ?)`,
          )
          .bind(log.happenedAt, log.discussed, log.agreedPlan, log.nextStepDeadline),
      );
    }

    for (const entry of bundle.phaseAudit) {
      statements.push(
        db
          .prepare(
            `INSERT INTO student_phase_audit (student_id, changed_at, from_phase, to_phase)
             VALUES (${importedStudentId}, ?, ?, ?)`,
          )
          .bind(entry.changedAt, entry.fromPhase, entry.toPhase),
      );
    }
  }

  return statements;
}

function validateImportBatchSize(data: ImportedStudentBundle[], mode: "append" | "replace"): string | null {
  const logCount = countImportedLogs(data);
  const phaseAuditCount = countImportedPhaseAuditEntries(data);
  const assignmentCount = data.reduce((total, bundle) => total + (bundle.assignments?.length ?? 1), 0);
  const totalStatements = 1 + data.length + assignmentCount + logCount + phaseAuditCount + (mode === "replace" ? 1 : 0);

  if (totalStatements > MAX_IMPORT_BATCH_STATEMENTS) {
    return `Import is too large for a single D1 batch. This file would execute ${totalStatements} statements, but the safe limit is ${MAX_IMPORT_BATCH_STATEMENTS}. Split the import into smaller files or reduce meeting logs and phase history.`;
  }

  return null;
}
