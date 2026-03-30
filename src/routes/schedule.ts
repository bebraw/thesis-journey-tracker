import { getStudentById, listStudents, updateStudent } from "../students/store";
import {
  addHourToLocalDateTime,
  buildScheduleEventDescription,
  buildScheduleEventTitle,
  buildScheduleWeek,
  createGoogleCalendarEvent,
  listGoogleCalendarEvents,
  listIcalCalendarEvents,
  localDateTimeToUtcIso,
  resolveGoogleCalendarConfig,
  resolveGoogleCalendarSourceForApp,
  resolveScheduleTimeZone,
  resolveWeekStart,
  type GoogleCalendarEvent,
} from "../calendar";
import { normalizeString } from "../forms/normalize";
import { htmlResponse, redirect } from "../http/response";
import { renderSchedulePage } from "../views";
import type { SessionUser } from "../auth";
import type { Env } from "../app-env";

export async function renderSchedule(url: URL, env: Env, sessionUser: SessionUser, showStyleGuide: boolean): Promise<Response> {
  const students = await listStudents(env.DB);
  const selectedStudentId = Number.parseInt(url.searchParams.get("student") || "", 10);
  const selectedStudent = Number.isFinite(selectedStudentId) ? students.find((student) => student.id === selectedStudentId) || null : null;
  const calendarSource = await resolveGoogleCalendarSourceForApp(env);
  const timeZone = resolveScheduleTimeZone(calendarSource?.timeZone);
  const weekStart = resolveWeekStart(url.searchParams.get("week"), timeZone);
  const selectedSlotStart = normalizeScheduleSlotValue(url.searchParams.get("slot"));
  const selectedSlotEnd = selectedSlotStart ? addHourToLocalDateTime(selectedSlotStart, 1) : null;
  const notice = url.searchParams.get("notice");
  let error = url.searchParams.get("error");
  let syncFailed = false;
  let events: GoogleCalendarEvent[] = [];

  if (calendarSource?.mode === "api") {
    try {
      events = await listGoogleCalendarEventsForWeek(calendarSource.config, weekStart, timeZone);
    } catch (calendarError) {
      console.error("Failed to load Google Calendar events", calendarError);
      syncFailed = true;
      error = error || formatCalendarSyncError(calendarSource.label, calendarError);
    }
  } else if (calendarSource?.mode === "ical") {
    try {
      events = await listIcalCalendarEvents(calendarSource.iCalUrl, timeZone);
    } catch (calendarError) {
      console.error("Failed to load Google Calendar iCal events", calendarError);
      syncFailed = true;
      error = error || formatCalendarSyncError(calendarSource.label, calendarError);
    }
  }

  const week = buildScheduleWeek(weekStart, timeZone, events, selectedSlotStart);

  return htmlResponse(
    renderSchedulePage({
      viewer: {
        name: sessionUser.name,
        role: sessionUser.role,
      },
      notice,
      error,
      showStyleGuide,
      configured: Boolean(calendarSource),
      sourceMode: calendarSource?.mode || null,
      syncFailed,
      timeZone,
      weekLabel: week.label,
      prevWeekHref: buildSchedulePath({ weekStart: week.prevWeekStart, studentId: selectedStudent?.id, slotStart: selectedSlotStart }),
      nextWeekHref: buildSchedulePath({ weekStart: week.nextWeekStart, studentId: selectedStudent?.id, slotStart: selectedSlotStart }),
      currentWeekHref: buildSchedulePath({ studentId: selectedStudent?.id, timeZone }),
      selectedWeek: week.weekStart,
      selectedSlotHref: selectedSlotStart
        ? buildSchedulePath({ weekStart: week.weekStart, studentId: selectedStudent?.id, slotStart: selectedSlotStart })
        : null,
      students: students.map((student) => ({
        value: String(student.id),
        label: student.name,
        selected: selectedStudent?.id === student.id,
      })),
      selectedStudentId: selectedStudent ? String(selectedStudent.id) : "",
      selectedStudentName: selectedStudent?.name || null,
      selectedStudentEmail: selectedStudent?.email || "",
      selectedSlotLabel: selectedSlotStart && selectedSlotEnd ? `${selectedSlotStart.replace("T", " ")} - ${selectedSlotEnd.slice(11, 16)}` : null,
      selectedSlotStart,
      selectedSlotEnd,
      defaultTitle: selectedStudent ? buildScheduleEventTitle(selectedStudent) : "",
      defaultDescription: selectedStudent ? buildScheduleEventDescription(selectedStudent) : "",
      days: week.days.map((day) => ({
        label: day.label,
        hasEvents: day.events.length > 0,
        hasSlots: day.slots.length > 0,
        events: day.events.map((event) => ({
          summary: event.summary,
          timeText: event.timeText,
          description: event.description,
          htmlLink: event.htmlLink,
        })),
        slots: day.slots.map((slot) => ({
          label: slot.label,
          href: buildSchedulePath({ weekStart: week.weekStart, studentId: selectedStudent?.id, slotStart: slot.startLocal }),
          selected: slot.selected,
        })),
      })),
    }),
  );
}

export async function handleScheduleMeeting(request: Request, env: Env): Promise<Response> {
  const formData = await request.formData();
  const returnPath = parseScheduleReturnTo(formData.get("returnTo"));
  const studentId = Number.parseInt(String(formData.get("studentId") || ""), 10);
  const calendarSource = await resolveGoogleCalendarSourceForApp(env);
  const weekStart = normalizeScheduleWeekValue(formData.get("week")) || resolveWeekStart(null, resolveScheduleTimeZone(calendarSource?.timeZone));
  const slotStart = normalizeScheduleSlotValue(formData.get("slotStart"));
  const slotEnd = normalizeScheduleSlotValue(formData.get("slotEnd"));

  if (!calendarSource) {
    return redirect(appendScheduleMessage(returnPath, { weekStart, studentId, slotStart, error: "Google Calendar is not configured" }));
  }

  if (calendarSource.mode !== "api") {
    return redirect(
      appendScheduleMessage(returnPath, {
        weekStart,
        studentId,
        slotStart,
        error: "Google Calendar iCal fallback mode is read-only. Add full Google OAuth credentials to create invitations from the app.",
      }),
    );
  }

  if (!Number.isFinite(studentId) || !slotStart || !slotEnd) {
    return redirect(appendScheduleMessage(returnPath, { weekStart, error: "Invalid scheduling request" }));
  }

  const student = await getStudentById(env.DB, studentId);
  if (!student) {
    return redirect(appendScheduleMessage(returnPath, { weekStart, error: "Student not found" }));
  }

  const meetingEmail = normalizeString(formData.get("meetingEmail")) || student.email;
  if (!meetingEmail) {
    return redirect(
      appendScheduleMessage(returnPath, {
        weekStart,
        studentId,
        slotStart,
        error: "Student email is required before sending a Google Calendar invite",
      }),
    );
  }

  const title = normalizeString(formData.get("title")) || buildScheduleEventTitle(student);
  const description = normalizeString(formData.get("description")) || buildScheduleEventDescription(student);

  try {
    await createGoogleCalendarEvent(calendarSource.config, {
      summary: title,
      description,
      startLocal: slotStart,
      endLocal: slotEnd,
      attendeeEmails: [meetingEmail],
    });

    await updateStudent(env.DB, studentId, {
      name: student.name,
      email: meetingEmail,
      degreeType: student.degreeType,
      thesisTopic: student.thesisTopic,
      studentNotes: student.studentNotes,
      startDate: student.startDate,
      currentPhase: student.currentPhase,
      nextMeetingAt: localDateTimeToUtcIso(slotStart, calendarSource.config.timeZone),
    });
  } catch (error) {
    console.error("Failed to schedule Google Calendar event", error);
    return redirect(appendScheduleMessage(returnPath, { weekStart, studentId, slotStart, error: "Failed to schedule Google Calendar event" }));
  }

  return redirect(appendScheduleMessage(returnPath, { weekStart, studentId, notice: "Meeting scheduled" }));
}

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

function normalizeScheduleWeekValue(value: FormDataEntryValue | string | null | undefined): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function normalizeScheduleSlotValue(value: FormDataEntryValue | string | null | undefined): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text) ? text : null;
}

async function listGoogleCalendarEventsForWeek(
  config: NonNullable<ReturnType<typeof resolveGoogleCalendarConfig>>,
  weekStart: string,
  timeZone: string,
) {
  const weekEndExclusive = addHourToLocalDateTime(`${weekStart}T00:00`, 24 * 7);
  return await listGoogleCalendarEvents(config, {
    timeMinIso: localDateTimeToUtcIso(`${weekStart}T00:00`, timeZone),
    timeMaxIso: localDateTimeToUtcIso(weekEndExclusive, timeZone),
  });
}

function formatCalendarSyncError(sourceLabel: string, error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return `${sourceLabel} sync failed: ${error.message.trim()}`;
  }

  return `${sourceLabel} sync failed: unknown error`;
}
