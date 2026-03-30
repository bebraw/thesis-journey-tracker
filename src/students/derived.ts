import type { DegreeId, Student } from "./store";
import type { DegreeDefinition, PhaseDefinition } from "./reference-data";

export function addSixMonths(dateText: string | null): string | null {
  if (!dateText) {
    return null;
  }
  const date = new Date(`${dateText}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  date.setUTCMonth(date.getUTCMonth() + 6);
  return date.toISOString().slice(0, 10);
}

export function getTargetSubmissionDate(student: Pick<Student, "degreeType" | "startDate">): string | null {
  if (student.degreeType !== "msc") {
    return null;
  }
  return addSixMonths(student.startDate);
}

export function isPastTargetSubmissionDate(student: Pick<Student, "degreeType" | "startDate" | "currentPhase">, today: string): boolean {
  const targetSubmissionDate = getTargetSubmissionDate(student);
  return Boolean(targetSubmissionDate && targetSubmissionDate < today && student.currentPhase !== "submitted");
}

export function getPhaseLabel(phaseId: string, phases: readonly PhaseDefinition[]): string {
  const normalized = mapLegacyPhaseId(phaseId);
  const phase = phases.find((item) => item.id === normalized);
  return phase ? phase.label : normalized;
}

export function getDegreeLabel(degreeId: DegreeId, degrees: readonly DegreeDefinition[]): string {
  const degree = degrees.find((item) => item.id === degreeId);
  return degree ? degree.label : degreeId;
}

export function meetingStatusText(student: Student): string {
  if (!student.nextMeetingAt) {
    return "Not booked";
  }
  const nextMeeting = new Date(student.nextMeetingAt);
  const now = new Date();
  if (nextMeeting < now) {
    return "Overdue";
  }
  if (nextMeeting.getTime() - now.getTime() <= 14 * 24 * 60 * 60 * 1000) {
    return "Meeting soon";
  }
  return "Scheduled";
}

export function meetingStatusId(student: Student): string {
  if (!student.nextMeetingAt) {
    return "not_booked";
  }
  const nextMeeting = new Date(student.nextMeetingAt);
  const now = new Date();
  if (nextMeeting < now) {
    return "overdue";
  }
  if (nextMeeting.getTime() - now.getTime() <= 14 * 24 * 60 * 60 * 1000) {
    return "within_2_weeks";
  }
  return "scheduled";
}

function mapLegacyPhaseId(value: string): string {
  return LEGACY_PHASE_ID_MAP[value] || value;
}

const LEGACY_PHASE_ID_MAP: Record<string, string> = {
  first_complete_draft: "editing",
  submission_ready: "editing",
};
