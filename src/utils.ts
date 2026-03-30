import type { DegreeId, PhaseId, Student } from "./db";
import type { DegreeDefinition, PhaseDefinition } from "./reference-data";

const LEGACY_PHASE_ID_MAP: Record<string, PhaseId> = {
  first_complete_draft: "editing",
  submission_ready: "editing",
};

export function htmlResponse(html: string): Response {
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function htmlFragmentResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function cssResponse(css: string): Response {
  return new Response(css, {
    headers: {
      "content-type": "text/css; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}

export function javascriptResponse(script: string): Response {
  return new Response(script, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}

export function iconResponse(icon: ArrayBuffer): Response {
  return new Response(icon, {
    headers: {
      "content-type": "image/x-icon",
      "cache-control": "public, max-age=604800",
    },
  });
}

export function normalizeString(value: FormDataEntryValue | string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

export function normalizeDate(value: FormDataEntryValue | string | null | undefined, allowNull = false): string | null | undefined {
  if (value === null || value === undefined || value === "") {
    return allowNull ? null : null;
  }
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return allowNull ? undefined : null;
  }
  return text;
}

export function normalizeDateTime(value: FormDataEntryValue | string | null | undefined, allowNull = false): string | null | undefined {
  if (value === null || value === undefined || value === "") {
    return allowNull ? null : null;
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return allowNull ? undefined : null;
  }
  return date.toISOString();
}

export function normalizePhase(value: FormDataEntryValue | string | null | undefined, phases: readonly PhaseDefinition[]): PhaseId | null {
  const text = normalizeString(value);
  if (!text) {
    return null;
  }
  const normalized = mapLegacyPhaseId(text);
  return phases.some((phase) => phase.id === normalized) ? (normalized as PhaseId) : null;
}

export function mapLegacyPhaseId(value: string): string {
  return LEGACY_PHASE_ID_MAP[value] || value;
}

export function normalizeDegree(
  value: FormDataEntryValue | string | null | undefined,
  degrees: readonly DegreeDefinition[],
): DegreeId | null {
  const text = normalizeString(value);
  if (!text) {
    return null;
  }
  return degrees.some((degree) => degree.id === text) ? (text as DegreeId) : null;
}

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

export function formatDateTime(isoValue: string): string {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return isoValue;
  }
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function toDateTimeLocalInput(isoValue: string | null): string {
  if (!isoValue) {
    return "";
  }
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 16);
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

export function escapeHtml(value: string | number): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function escapeJsString(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'").replaceAll("\r", "\\r").replaceAll("\n", "\\n");
}

export function redirect(pathname: string, extraHeaders: HeadersInit = {}): Response {
  const headers = new Headers({ Location: pathname, ...extraHeaders });
  return new Response(null, { status: 302, headers });
}
