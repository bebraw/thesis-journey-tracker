import type { CreateStudentInput, DegreeId, MeetingLog, PhaseAuditEntry, PhaseId, Student } from "../students/store";
import type { MeetingSchedule } from "../students/recurrence";

export const DATA_EXPORT_SCHEMA_VERSION = 3;

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

export interface ExportedAssignment {
  userId: number;
  name: string;
  role: "supervisor" | "advisor";
}

export interface StudentExportBundle {
  student: Student;
  logs: MeetingLog[];
  phaseAudit: PhaseAuditEntry[];
  assignments: ExportedAssignment[];
}

export interface ExportedStudent {
  assignments: ExportedAssignment[];
  name: string;
  email: string | null;
  degreeType: DegreeId;
  thesisTopic: string | null;
  studentNotes?: string | null;
  startDate: string | null;
  currentPhase: PhaseId;
  nextMeetingAt: string | null;
  meetingSchedule?: MeetingSchedule | null;
  archivedAt?: string | null;
  logs: ExportedMeetingLog[];
  phaseAudit: ExportedPhaseAuditEntry[];
}

export interface DataExportFile {
  app: "thesis-journey-tracker";
  schemaVersion: number;
  installationId: string;
  exportedAt: string;
  students: ExportedStudent[];
}

export interface ImportedStudentBundle {
  assignments: ExportedAssignment[] | null;
  student: CreateStudentInput;
  archivedAt: string | null;
  logs: ExportedMeetingLog[];
  phaseAudit: ExportedPhaseAuditEntry[];
}

export interface StatusReportStudentBundle {
  student: Student;
  latestLog: MeetingLog | null;
}
