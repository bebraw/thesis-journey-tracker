import type { CreateStudentInput, DegreeId, MeetingLog, PhaseId, Student } from "./db";
import { DEGREE_TYPES, PHASES } from "./reference-data";
import { normalizeDate, normalizeDateTime, normalizeDegree, normalizePhase, normalizeString } from "./utils";

export const DATA_EXPORT_SCHEMA_VERSION = 1;

export interface ExportedMeetingLog {
  happenedAt: string;
  discussed: string;
  agreedPlan: string;
  nextStepDeadline: string | null;
}

export interface ExportedStudent {
  name: string;
  email: string | null;
  degreeType: DegreeId;
  thesisTopic: string | null;
  startDate: string;
  targetSubmissionDate: string;
  currentPhase: PhaseId;
  nextMeetingAt: string | null;
  logs: ExportedMeetingLog[];
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
}

interface ImportParseResult {
  data: ImportedStudentBundle[] | null;
  error: string | null;
}

export function createDataExport(studentBundles: Array<{ student: Student; logs: MeetingLog[] }>): DataExportFile {
  return {
    app: "thesis-journey-tracker",
    schemaVersion: DATA_EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    students: studentBundles.map(({ student, logs }) => ({
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

export function buildExportFilename(timestamp = new Date()): string {
  const safeDate = timestamp.toISOString().slice(0, 10);
  return `thesis-journey-tracker-export-${safeDate}.json`;
}

function parseImportedStudent(value: unknown): ImportedStudentBundle | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = normalizeString(value.name as string | null | undefined);
  const email = normalizeString(value.email as string | null | undefined);
  const degreeType = normalizeDegree(value.degreeType as string | null | undefined, DEGREE_TYPES);
  const thesisTopic = normalizeString(value.thesisTopic as string | null | undefined);
  const startDate = normalizeDate(value.startDate as string | null | undefined);
  const targetSubmissionDate = normalizeDate(value.targetSubmissionDate as string | null | undefined);
  const currentPhase = normalizePhase(value.currentPhase as string | null | undefined, PHASES);
  const nextMeetingAt = normalizeDateTime(value.nextMeetingAt as string | null | undefined, true);

  if (!name || !degreeType || !startDate || !targetSubmissionDate || !currentPhase || nextMeetingAt === undefined) {
    return null;
  }

  const rawLogs = value.logs;
  if (rawLogs !== undefined && !Array.isArray(rawLogs)) {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
