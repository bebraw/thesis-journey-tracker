import type { CreateStudentInput, DegreeId, MeetingLog, PhaseId, Student } from "../students/store";

export const DATA_EXPORT_SCHEMA_VERSION = 1;

export interface ExportedMeetingLog {
  happenedAt: string;
  discussed: string;
  agreedPlan: string;
  nextStepDeadline: string | null;
}

export interface ExportedPhaseAuditEntry {
  changedAt: string;
  fromPhase: PhaseId;
  toPhase: PhaseId;
}

export interface ExportedStudent {
  name: string;
  email: string | null;
  degreeType: DegreeId;
  thesisTopic: string | null;
  studentNotes?: string | null;
  startDate: string | null;
  currentPhase: PhaseId;
  nextMeetingAt: string | null;
  archivedAt?: string | null;
  logs: ExportedMeetingLog[];
  phaseAudit: ExportedPhaseAuditEntry[];
}

export interface DataExportFile {
  app: "thesis-journey-tracker";
  schemaVersion: number;
  exportedAt: string;
  students: ExportedStudent[];
}

export interface ImportedStudentBundle {
  student: CreateStudentInput;
  archivedAt: string | null;
  logs: ExportedMeetingLog[];
  phaseAudit: ExportedPhaseAuditEntry[];
}

export interface StatusReportStudentBundle {
  student: Student;
  latestLog: MeetingLog | null;
}
