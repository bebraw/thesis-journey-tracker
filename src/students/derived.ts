import type { DegreeId, Student } from "./store";
import type { DegreeDefinition, PhaseDefinition } from "./reference-data";

const TWO_WEEKS_IN_MS = 14 * 24 * 60 * 60 * 1000;
const ASSUMED_PROJECT_DURATION_MONTHS: Record<DegreeId, number> = {
  bsc: 4,
  msc: 6,
  dsc: 12,
};

export function addSixMonths(dateText: string | null): string | null {
  return addMonths(dateText, 6);
}

export function addMonths(dateText: string | null, months: number): string | null {
  if (!dateText) {
    return null;
  }
  const date = new Date(`${dateText}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

export function getTargetSubmissionDate(student: Pick<Student, "degreeType" | "startDate">): string | null {
  if (student.degreeType !== "msc") {
    return null;
  }
  return addSixMonths(student.startDate);
}

export function getAssumedProjectDurationMonths(degreeType: DegreeId): number {
  return ASSUMED_PROJECT_DURATION_MONTHS[degreeType];
}

export function getAssumedProjectEndDate(student: Pick<Student, "degreeType" | "startDate">): string | null {
  return addMonths(student.startDate, getAssumedProjectDurationMonths(student.degreeType));
}

export function isPastTargetSubmissionDate(student: Pick<Student, "degreeType" | "startDate" | "currentPhase">, today: string): boolean {
  const targetSubmissionDate = getTargetSubmissionDate(student);
  return Boolean(targetSubmissionDate && targetSubmissionDate < today && student.currentPhase !== "submitted");
}

export function getPhaseLabel(phaseId: string, phases: readonly PhaseDefinition[]): string {
  const phase = phases.find((item) => item.id === phaseId);
  return phase ? phase.label : phaseId;
}

export function getDegreeLabel(degreeId: DegreeId, degrees: readonly DegreeDefinition[]): string {
  const degree = degrees.find((item) => item.id === degreeId);
  return degree ? degree.label : degreeId;
}

function startsInFuture(student: Pick<Student, "startDate">, now: Date): boolean {
  const today = now.toISOString().slice(0, 10);
  return Boolean(student.startDate && student.startDate > today);
}

export function meetingStatusId(student: Pick<Student, "startDate" | "nextMeetingAt">, now = new Date()): string {
  if (!student.nextMeetingAt) {
    return "not_booked";
  }
  const nextMeeting = new Date(student.nextMeetingAt);
  if (Number.isNaN(nextMeeting.getTime())) {
    return "not_booked";
  }
  if (nextMeeting < now) {
    return startsInFuture(student, now) ? "not_booked" : "overdue";
  }
  if (nextMeeting.getTime() - now.getTime() <= TWO_WEEKS_IN_MS) {
    return "within_2_weeks";
  }
  return "scheduled";
}

export function meetingStatusText(student: Pick<Student, "startDate" | "nextMeetingAt">, now = new Date()): string {
  const statusId = meetingStatusId(student, now);
  return statusId === "overdue"
    ? "Overdue"
    : statusId === "not_booked"
      ? "Not booked"
      : statusId === "within_2_weeks"
        ? "Meeting soon"
        : "Scheduled";
}
