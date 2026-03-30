import { resolveScheduleTimeZone, resolveWeekStart } from "../../calendar";

export function buildSchedulePath(options: {
  weekStart?: string | null;
  studentId?: number | null;
  slotStart?: string | null;
  notice?: string;
  error?: string;
  timeZone?: string;
}): string {
  const weekStart = normalizeScheduleWeekValue(options.weekStart) || resolveWeekStart(null, resolveScheduleTimeZone(options.timeZone));
  const searchParams = new URLSearchParams();
  searchParams.set("week", weekStart);

  if (options.studentId) {
    searchParams.set("student", String(options.studentId));
  }
  if (options.slotStart && normalizeScheduleSlotValue(options.slotStart)) {
    searchParams.set("slot", options.slotStart);
  }
  if (options.notice) {
    searchParams.set("notice", options.notice);
  }
  if (options.error) {
    searchParams.set("error", options.error);
  }

  return `/schedule?${searchParams.toString()}`;
}

export function appendScheduleMessage(
  pathname: string,
  options: { weekStart?: string | null; studentId?: number | null; slotStart?: string | null; notice?: string; error?: string },
): string {
  const url = new URL(pathname, "https://schedule.local");
  const currentStudentId = Number.parseInt(url.searchParams.get("student") || "", 10);
  return buildSchedulePath({
    weekStart: options.weekStart || url.searchParams.get("week"),
    studentId: options.studentId ?? (Number.isFinite(currentStudentId) ? currentStudentId : null),
    slotStart: options.slotStart,
    notice: options.notice,
    error: options.error,
  });
}

export async function getScheduleReturnPath(request: Request): Promise<string> {
  const formData = await request.clone().formData();
  return parseScheduleReturnTo(formData.get("returnTo"));
}

function parseScheduleReturnTo(rawValue: FormDataEntryValue | null): string {
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    return buildSchedulePath({});
  }

  try {
    const url = new URL(rawValue, "https://schedule.local");
    return url.pathname === "/schedule" ? `${url.pathname}${url.search}` : buildSchedulePath({});
  } catch {
    return buildSchedulePath({});
  }
}

export function normalizeScheduleWeekValue(value: FormDataEntryValue | string | null | undefined): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

export function normalizeScheduleSlotValue(value: FormDataEntryValue | string | null | undefined): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text) ? text : null;
}
