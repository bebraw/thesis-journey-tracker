import type { CreateStudentInput, DegreeId, MeetingLog, PhaseAuditEntry, PhaseId, Student } from "./db";
import { DEGREE_TYPES, PHASES } from "./reference-data";
import {
  formatDateTime,
  getDegreeLabel,
  getPhaseLabel,
  meetingStatusText,
  normalizeDate,
  normalizeDateTime,
  normalizeDegree,
  normalizePhase,
  normalizeString,
} from "./utils";

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
  startDate: string | null;
  targetSubmissionDate: string;
  currentPhase: PhaseId;
  nextMeetingAt: string | null;
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
  logs: ExportedMeetingLog[];
  phaseAudit: ExportedPhaseAuditEntry[];
}

export interface StatusReportStudentBundle {
  student: Student;
  latestLog: MeetingLog | null;
}

interface ImportParseResult {
  data: ImportedStudentBundle[] | null;
  error: string | null;
}

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
      startDate: student.startDate,
      targetSubmissionDate: student.targetSubmissionDate,
      currentPhase: student.currentPhase,
      nextMeetingAt: student.nextMeetingAt,
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

export function parseDataImport(jsonText: string): ImportParseResult {
  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(jsonText);
  } catch {
    return {
      data: null,
      error: "The uploaded file is not valid JSON.",
    };
  }

  if (!isRecord(parsedValue)) {
    return {
      data: null,
      error: "The uploaded JSON must be an object exported by this app.",
    };
  }

  if (parsedValue.app !== "thesis-journey-tracker") {
    return {
      data: null,
      error: "This JSON file does not look like a Thesis Journey Tracker export.",
    };
  }

  if (parsedValue.schemaVersion !== DATA_EXPORT_SCHEMA_VERSION) {
    return {
      data: null,
      error: `Unsupported export schema version. Expected ${DATA_EXPORT_SCHEMA_VERSION}.`,
    };
  }

  if (!Array.isArray(parsedValue.students)) {
    return {
      data: null,
      error: "The uploaded JSON is missing the students array.",
    };
  }

  const importedStudents: ImportedStudentBundle[] = [];

  for (let index = 0; index < parsedValue.students.length; index += 1) {
    const bundle = parseImportedStudent(parsedValue.students[index]);
    if (!bundle) {
      return {
        data: null,
        error: `Student entry ${index + 1} in the uploaded JSON is invalid.`,
      };
    }
    importedStudents.push(bundle);
  }

  return {
    data: importedStudents,
    error: null,
  };
}

export function countImportedLogs(studentBundles: ImportedStudentBundle[]): number {
  return studentBundles.reduce((total, bundle) => total + bundle.logs.length, 0);
}

export function countImportedPhaseAuditEntries(studentBundles: ImportedStudentBundle[]): number {
  return studentBundles.reduce((total, bundle) => total + bundle.phaseAudit.length, 0);
}

export function buildExportFilename(timestamp = new Date()): string {
  const safeDate = timestamp.toISOString().slice(0, 10);
  return `thesis-journey-tracker-export-${safeDate}.json`;
}

export function buildProfessorReportFilename(timestamp = new Date()): string {
  const safeDate = timestamp.toISOString().slice(0, 10);
  return `thesis-journey-status-report-${safeDate}.md`;
}

export function createProfessorStatusReport(studentBundles: StatusReportStudentBundle[], generatedAt = new Date()): string {
  const today = generatedAt.toISOString().slice(0, 10);
  const overdueMeetings = studentBundles.filter(({ student }) => student.nextMeetingAt && new Date(student.nextMeetingAt) < generatedAt);
  const upcomingSoon = studentBundles.filter(({ student }) => {
    if (!student.nextMeetingAt) {
      return false;
    }
    const nextMeeting = new Date(student.nextMeetingAt);
    const diff = nextMeeting.getTime() - generatedAt.getTime();
    return diff >= 0 && diff <= 14 * 24 * 60 * 60 * 1000;
  });
  const noMeetingBooked = studentBundles.filter(({ student }) => !student.nextMeetingAt);
  const pastTarget = studentBundles.filter(({ student }) => student.targetSubmissionDate < today && student.currentPhase !== "submitted");

  const phaseLines = PHASES.map((phase) => {
    const count = studentBundles.filter(({ student }) => student.currentPhase === phase.id).length;
    return `- ${phase.label}: ${count}`;
  });

  const needsAttention = studentBundles
    .filter(({ student }) => {
      const meetingStatus = meetingStatusText(student);
      return meetingStatus === "Overdue" || meetingStatus === "Not booked" || student.targetSubmissionDate < today;
    })
    .map(({ student, latestLog }) => {
      const parts = [
        `${student.name} (${getDegreeLabel(student.degreeType, DEGREE_TYPES)})`,
        `phase ${getPhaseLabel(student.currentPhase, PHASES)}`,
        `target ${student.targetSubmissionDate}`,
        `meeting ${meetingStatusText(student).toLowerCase()}`,
      ];

      if (latestLog) {
        parts.push(`last update ${formatDateTime(latestLog.happenedAt)}`);
      }

      return `- ${parts.join("; ")}`;
    });

  const studentLines = studentBundles.map(({ student, latestLog }) => {
    const parts = [
      `${student.name} (${getDegreeLabel(student.degreeType, DEGREE_TYPES)})`,
      `phase ${getPhaseLabel(student.currentPhase, PHASES)}`,
      `target ${student.targetSubmissionDate}`,
      `meeting ${meetingStatusText(student).toLowerCase()}`,
    ];

    if (student.thesisTopic) {
      parts.push(`topic "${student.thesisTopic}"`);
    }

    if (latestLog) {
      parts.push(`last log ${formatDateTime(latestLog.happenedAt)}`);
      parts.push(`agreed next step "${latestLog.agreedPlan}"`);
    } else {
      parts.push("no supervision log yet");
    }

    return `- ${parts.join("; ")}`;
  });

  return [
    "# Thesis Supervision Status Report",
    "",
    `Generated: ${generatedAt.toISOString().slice(0, 10)}`,
    "",
    "## Summary",
    `- Total students: ${studentBundles.length}`,
    `- Submitted: ${studentBundles.filter(({ student }) => student.currentPhase === "submitted").length}`,
    `- Draft ready to submit: ${studentBundles.filter(({ student }) => student.currentPhase === "submission_ready").length}`,
    `- Overdue meetings: ${overdueMeetings.length}`,
    `- Meetings within 2 weeks: ${upcomingSoon.length}`,
    `- No meeting booked: ${noMeetingBooked.length}`,
    `- Past target date and not yet submitted: ${pastTarget.length}`,
    "",
    "## Phase Breakdown",
    ...phaseLines,
    "",
    "## Students Needing Attention",
    ...(needsAttention.length > 0 ? needsAttention : ["- None at the moment."]),
    "",
    "## Student Updates",
    ...studentLines,
    "",
  ].join("\n");
}

function parseImportedStudent(value: unknown): ImportedStudentBundle | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = normalizeString(value.name as string | null | undefined);
  const email = normalizeString(value.email as string | null | undefined);
  const degreeType = normalizeDegree(value.degreeType as string | null | undefined, DEGREE_TYPES);
  const thesisTopic = normalizeString(value.thesisTopic as string | null | undefined);
  const startDate = normalizeDate(value.startDate as string | null | undefined, true);
  const targetSubmissionDate = normalizeDate(value.targetSubmissionDate as string | null | undefined);
  const currentPhase = normalizePhase(value.currentPhase as string | null | undefined, PHASES);
  const nextMeetingAt = normalizeDateTime(value.nextMeetingAt as string | null | undefined, true);

  if (startDate === undefined || !name || !degreeType || !targetSubmissionDate || !currentPhase || nextMeetingAt === undefined) {
    return null;
  }

  const rawLogs = value.logs;
  if (rawLogs !== undefined && !Array.isArray(rawLogs)) {
    return null;
  }

  const rawPhaseAudit = value.phaseAudit;
  if (rawPhaseAudit !== undefined && !Array.isArray(rawPhaseAudit)) {
    return null;
  }

  const logs: ExportedMeetingLog[] = [];
  for (const rawLog of rawLogs || []) {
    const parsedLog = parseImportedLog(rawLog);
    if (!parsedLog) {
      return null;
    }
    logs.push(parsedLog);
  }

  const phaseAudit: ExportedPhaseAuditEntry[] = [];
  for (const rawEntry of rawPhaseAudit || []) {
    const parsedEntry = parseImportedPhaseAudit(rawEntry);
    if (!parsedEntry) {
      return null;
    }
    phaseAudit.push(parsedEntry);
  }

  return {
    student: {
      name,
      email,
      degreeType,
      thesisTopic,
      startDate,
      targetSubmissionDate,
      currentPhase,
      nextMeetingAt,
    },
    logs,
    phaseAudit,
  };
}

function parseImportedLog(value: unknown): ExportedMeetingLog | null {
  if (!isRecord(value)) {
    return null;
  }

  const happenedAt = normalizeDateTime(value.happenedAt as string | null | undefined);
  const discussed = normalizeString(value.discussed as string | null | undefined);
  const agreedPlan = normalizeString(value.agreedPlan as string | null | undefined);
  const nextStepDeadline = normalizeDate(value.nextStepDeadline as string | null | undefined, true);

  if (!happenedAt || !discussed || !agreedPlan || nextStepDeadline === undefined) {
    return null;
  }

  return {
    happenedAt,
    discussed,
    agreedPlan,
    nextStepDeadline,
  };
}

function parseImportedPhaseAudit(value: unknown): ExportedPhaseAuditEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const changedAt = normalizeDateTime(value.changedAt as string | null | undefined);
  const fromPhase = normalizePhase(value.fromPhase as string | null | undefined, PHASES);
  const toPhase = normalizePhase(value.toPhase as string | null | undefined, PHASES);

  if (!changedAt || !fromPhase || !toPhase) {
    return null;
  }

  return {
    changedAt,
    fromPhase,
    toPhase,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
