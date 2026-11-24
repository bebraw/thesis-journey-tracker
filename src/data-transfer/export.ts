import { DATA_EXPORT_SCHEMA_VERSION, type DataExportFile, type StudentExportBundle } from "./types";

export function createDataExport(studentBundles: StudentExportBundle[], installationId: string): DataExportFile {
  return {
    app: "thesis-journey-tracker",
    schemaVersion: DATA_EXPORT_SCHEMA_VERSION,
    installationId,
    exportedAt: new Date().toISOString(),
    students: studentBundles.map(({ student, logs, phaseAudit, assignments }) => ({
      assignments,
      name: student.name,
      email: student.email,
      degreeType: student.degreeType,
      thesisTopic: student.thesisTopic,
      studentNotes: student.studentNotes,
      startDate: student.startDate,
      currentPhase: student.currentPhase,
      nextMeetingAt: student.nextMeetingAt,
      meetingSchedule: student.meetingSchedule || null,
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
