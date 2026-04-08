import { normalizeDate, normalizeDateTime, normalizeString } from "../forms/normalize";
import { toDateTimeLocalInput } from "../formatting";
import type { DegreeId, PhaseId, Student, StudentMutationInput } from "./store";

const DEGREE_IDS: DegreeId[] = ["bsc", "msc", "dsc"];
const PHASE_IDS: PhaseId[] = ["research_plan", "researching", "editing", "submitted"];

export const STUDENT_FORM_FIELDS = {
  name: "name",
  email: "studentEmail",
  degreeType: "degreeType",
  thesisTopic: "thesisTopic",
  studentNotes: "studentNotes",
  startDate: "startDate",
  currentPhase: "currentPhase",
  nextMeetingAt: "nextMeetingAt",
  clearNextMeetingAt: "clearNextMeetingAt",
} as const;

export type StudentFormMode = "create" | "update";

export interface StudentFormValues {
  name: string;
  email: string;
  degreeType: DegreeId;
  thesisTopic: string;
  studentNotes: string;
  startDate: string;
  currentPhase: PhaseId;
  nextMeetingAt: string;
}

interface ParseStudentFormOptions {
  mode: StudentFormMode;
  existingStudent?: Student;
  timeZone?: string;
}

export function getDefaultStudentFormValues(): StudentFormValues {
  return {
    name: "",
    email: "",
    degreeType: "msc",
    thesisTopic: "",
    studentNotes: "",
    startDate: "",
    currentPhase: "research_plan",
    nextMeetingAt: "",
  };
}

export function getStudentFormValues(student: Student, timeZone?: string): StudentFormValues {
  return {
    name: student.name,
    email: student.email || "",
    degreeType: student.degreeType,
    thesisTopic: student.thesisTopic || "",
    studentNotes: student.studentNotes || "",
    startDate: student.startDate || "",
    currentPhase: student.currentPhase,
    nextMeetingAt: toDateTimeLocalInput(student.nextMeetingAt, timeZone),
  };
}

export function parseStudentFormSubmission(formData: FormData, options: ParseStudentFormOptions): StudentMutationInput | null {
  const { mode, existingStudent, timeZone } = options;

  const name = normalizeString(readRequiredField(formData, STUDENT_FORM_FIELDS.name, existingStudent?.name));
  const email = normalizeString(readOptionalField(formData, STUDENT_FORM_FIELDS.email, existingStudent?.email ?? null));
  const thesisTopic = normalizeString(readOptionalField(formData, STUDENT_FORM_FIELDS.thesisTopic, existingStudent?.thesisTopic ?? null));
  const studentNotes = normalizeString(
    readOptionalField(formData, STUDENT_FORM_FIELDS.studentNotes, existingStudent?.studentNotes ?? null),
  );

  const startDate = normalizeDate(readOptionalField(formData, STUDENT_FORM_FIELDS.startDate, existingStudent?.startDate ?? null), true);

  const degreeType = normalizeDegreeId(
    readRequiredField(formData, STUDENT_FORM_FIELDS.degreeType, existingStudent?.degreeType ?? (mode === "create" ? "msc" : null)),
  );
  const currentPhase = normalizePhaseId(
    readRequiredField(
      formData,
      STUDENT_FORM_FIELDS.currentPhase,
      existingStudent?.currentPhase ?? (mode === "create" ? "research_plan" : null),
    ),
  );
  const clearNextMeetingAt = normalizeString(formData.get(STUDENT_FORM_FIELDS.clearNextMeetingAt)) === "yes";
  const nextMeetingAt = clearNextMeetingAt
    ? null
    : normalizeDateTime(readOptionalField(formData, STUDENT_FORM_FIELDS.nextMeetingAt, existingStudent?.nextMeetingAt ?? null), true, timeZone);

  if (!name || startDate === undefined || !degreeType || !currentPhase || nextMeetingAt === undefined) {
    return null;
  }

  return {
    name,
    email,
    degreeType,
    thesisTopic,
    studentNotes,
    startDate,
    currentPhase,
    nextMeetingAt,
  };
}

function normalizeDegreeId(value: FormDataEntryValue | string | null | undefined): DegreeId | null {
  const text = normalizeString(value);
  if (!text) {
    return null;
  }
  return DEGREE_IDS.includes(text as DegreeId) ? (text as DegreeId) : null;
}

function normalizePhaseId(value: FormDataEntryValue | string | null | undefined): PhaseId | null {
  const text = normalizeString(value);
  if (!text) {
    return null;
  }
  return PHASE_IDS.includes(text as PhaseId) ? (text as PhaseId) : null;
}

function readRequiredField(
  formData: FormData,
  name: string,
  fallbackValue?: string | null,
): FormDataEntryValue | string | null | undefined {
  if (formData.has(name)) {
    return formData.get(name);
  }
  return fallbackValue;
}

function readOptionalField(
  formData: FormData,
  name: string,
  fallbackValue: string | null,
): FormDataEntryValue | string | null {
  if (formData.has(name)) {
    return formData.get(name);
  }
  return fallbackValue;
}
