import type { DegreeId, PhaseId } from "../students/store";
import type { DegreeDefinition, PhaseDefinition } from "../students/reference-data";
import { DEFAULT_SCHEDULE_TIMEZONE, localDateTimeToUtcIso } from "../calendar/scheduling";

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
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) {
    return localDateTimeToUtcIso(text, DEFAULT_SCHEDULE_TIMEZONE);
  }

  const date = new Date(text);
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
  return phases.some((phase) => phase.id === text) ? (text as PhaseId) : null;
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
