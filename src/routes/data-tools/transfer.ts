import { collectStudentBackupBundles } from "../../backup/data";
import type { ExportedAssignment } from "../../data-transfer/types";
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
import { IMPORT_FILE_LIMIT_BYTES, IMPORT_FORM_BODY_LIMIT_BYTES, readFormData } from "../../http/request-body";
import { redirect } from "../../http/response";
import { logError } from "../../observability/error-logging";
import { listLogsForStudent, listStudents } from "../../students/store";

const MAX_IMPORT_BATCH_STATEMENTS = 750;

export async function handleExportJson(env: Env): Promise<Response> {
  const studentBundles = await collectStudentBackupBundles(env.DB);
  const body = JSON.stringify(createDataExport(studentBundles), null, 2);

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

export async function handleImportJson(request: Request, env: Env): Promise<Response> {
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
    const resolved = await resolveImportAssignments(env.DB, data, formData.get("legacySupervisor"));
    if (typeof resolved === "string") {
      return redirect(`/data-tools?error=${encodeURIComponent(resolved)}`);
    }
    const statements = await buildImportStatements(env.DB, resolved, mode);
    if (statements.length > 0) {
      await env.DB.batch(statements);
    }
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

interface ImportAccount {
  id: number;
  name: string;
  can_supervise: number;
  role: string;
}

type ResolvedBundle = Omit<ImportedStudentBundle, "assignments"> & {
  assignments: ExportedAssignment[];
};

async function resolveImportAssignments(
  db: D1Database,
  data: ImportedStudentBundle[],
  legacySupervisor: FormDataEntryValue | null,
): Promise<ResolvedBundle[] | string> {
  const rows = await db.prepare("SELECT id, name, role, can_supervise FROM app_users WHERE disabled_at IS NULL").all<ImportAccount>();
  const accounts = new Map(rows.results.map((account) => [account.id, account]));
  const legacyOwner = typeof legacySupervisor === "string" ? accounts.get(Number(legacySupervisor)) : undefined;
  const bundles: ResolvedBundle[] = [];
  for (const bundle of data) {
    let team = bundle.assignments;
    if (team === null) {
      if (!legacyOwner) return "Select an active supervisor for theses in a version 1 backup.";
      team = [{ userId: legacyOwner.id, name: legacyOwner.name, role: "supervisor" }];
    }
    for (const assignment of team) {
      const account = accounts.get(assignment.userId);
      if (
        !account ||
        account.name !== assignment.name ||
        (assignment.role === "supervisor" && (!account.can_supervise || account.role !== "editor"))
      ) {
        return `Thesis ${bundles.length + 1} references an unavailable ${assignment.role} account. Check the account ID, exact name, and permissions before importing.`;
      }
    }
    bundles.push({ ...bundle, assignments: team });
  }
  return bundles;
}

async function buildImportStatements(db: D1Database, data: ResolvedBundle[], mode: "append" | "replace"): Promise<D1PreparedStatement[]> {
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
          `INSERT INTO students (id, name, email, degree_type, thesis_topic, student_notes, start_date, current_phase, next_meeting_at, archived_at, meeting_schedule)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          bundle.student.meetingSchedule ? JSON.stringify(bundle.student.meetingSchedule) : null,
        ),
    );

    for (const assignment of bundle.assignments) {
      // A missing or changed account yields NULL and fails the whole restore batch.
      statements.push(
        db
          .prepare(
            `INSERT INTO thesis_assignments (student_id, user_id, assignment_role)
           VALUES (?, (SELECT id FROM app_users WHERE id = ? AND name = ? COLLATE BINARY
             AND disabled_at IS NULL AND (? = 'advisor' OR (role = 'editor' AND can_supervise = 1))), ?)`,
          )
          .bind(studentId, assignment.userId, assignment.name, assignment.role, assignment.role),
      );
    }

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
  const assignmentCount = data.reduce((total, bundle) => total + (bundle.assignments?.length ?? 1), 0);
  const totalStatements = data.length + assignmentCount + logCount + phaseAuditCount + (mode === "replace" ? 1 : 0);

  if (totalStatements > MAX_IMPORT_BATCH_STATEMENTS) {
    return `Import is too large for a single D1 batch. This file would execute ${totalStatements} statements, but the safe limit is ${MAX_IMPORT_BATCH_STATEMENTS}. Split the import into smaller files or reduce meeting logs and phase history.`;
  }

  return null;
}
