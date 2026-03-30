import type { MeetingLog, PhaseAuditEntry, Student } from "../students/store";
import { DATA_EXPORT_SCHEMA_VERSION, type DataExportFile } from "./types";

export function createDataExport(
  studentBundles: Array<{ student: Student; logs: MeetingLog[]; phaseAudit: PhaseAuditEntry[] }>,
): DataExportFile {
  return {
    app: "thesis-journey-tracker",
    schemaVersion: DATA_EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    students: studentBundles.map(({ student, logs, phaseAudit }) => ({
      name: student.name,
      email: student.email,
      degreeType: student.degreeType,
      thesisTopic: student.thesisTopic,
      studentNotes: student.studentNotes,
      startDate: student.startDate,
      currentPhase: student.currentPhase,
      nextMeetingAt: student.nextMeetingAt,
      archivedAt: student.archivedAt,
      logs: logs.map((log) => ({
        happenedAt: log.happenedAt,
        discussed: log.discussed,
        agreedPlan: log.agreedPlan,
        nextStepDeadline: log.nextStepDeadline,
      })),
      phaseAudit: phaseAudit.map((entry) => ({
        changedAt: entry.changedAt,
        fromPhase: entry.fromPhase,
        toPhase: entry.toPhase,
      })),
    })),
  };
}

export function buildExportFilename(timestamp = new Date()): string {
  const safeDate = timestamp.toISOString().slice(0, 10);
  return `thesis-journey-tracker-export-${safeDate}.json`;
}
