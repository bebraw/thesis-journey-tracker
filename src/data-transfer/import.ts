import { normalizeDate, normalizeDateTime, normalizeDegree, normalizePhase, normalizeString } from "../forms/normalize";
import { DEGREE_TYPES, PHASES } from "../students";
import {
  DATA_EXPORT_SCHEMA_VERSION,
  type ExportedMeetingLog,
  type ExportedPhaseAuditEntry,
  type ImportedStudentBundle,
} from "./types";

interface ImportParseResult {
  data: ImportedStudentBundle[] | null;
  error: string | null;
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

function parseImportedStudent(value: unknown): ImportedStudentBundle | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = normalizeString(value.name as string | null | undefined);
  const email = normalizeString(value.email as string | null | undefined);
  const degreeType = normalizeDegree(value.degreeType as string | null | undefined, DEGREE_TYPES);
  const thesisTopic = normalizeString(value.thesisTopic as string | null | undefined);
  const studentNotes = normalizeString(value.studentNotes as string | null | undefined);
  const startDate = normalizeDate(value.startDate as string | null | undefined, true);
  const currentPhase = normalizePhase(value.currentPhase as string | null | undefined, PHASES);
  const nextMeetingAt = normalizeDateTime(value.nextMeetingAt as string | null | undefined, true);
  const archivedAt = normalizeDateTime(value.archivedAt as string | null | undefined, true);

  if (startDate === undefined || !name || !degreeType || !currentPhase || nextMeetingAt === undefined || archivedAt === undefined) {
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
      studentNotes,
      startDate,
      currentPhase,
      nextMeetingAt,
    },
    archivedAt,
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
