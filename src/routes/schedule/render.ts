import type { SessionUser } from "../../auth";
import type { Env } from "../../app-env";
import {
  addHourToLocalDateTime,
  buildScheduleEventDescription,
  buildScheduleEventTitle,
  buildScheduleWeek,
  listGoogleCalendarEvents,
  listIcalCalendarEvents,
  localDateTimeToUtcIso,
  resolveGoogleCalendarConfig,
  resolveGoogleCalendarSourceForApp,
  resolveScheduleTimeZone,
  resolveWeekStart,
  type GoogleCalendarEvent,
} from "../../calendar";
import { htmlResponse } from "../../http/response";
import { listStudents } from "../../students/store";
import { renderSchedulePage } from "../../views";
import { buildSchedulePath, normalizeScheduleSlotValue } from "./paths";

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
      events = await listIcalCalendarEventsForWeek(calendarSource.iCalUrl, weekStart, timeZone);
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

async function listGoogleCalendarEventsForWeek(
  config: NonNullable<ReturnType<typeof resolveGoogleCalendarConfig>>,
  weekStart: string,
  timeZone: string,
) {
  const window = buildScheduleWeekWindow(weekStart, timeZone);
  return await listGoogleCalendarEvents(config, {
    timeMinIso: window.timeMinIso,
    timeMaxIso: window.timeMaxIso,
  });
}

async function listIcalCalendarEventsForWeek(iCalUrl: string, weekStart: string, timeZone: string) {
  const window = buildScheduleWeekWindow(weekStart, timeZone);
  return await listIcalCalendarEvents(iCalUrl, timeZone, window);
}

function buildScheduleWeekWindow(weekStart: string, timeZone: string) {
  const weekEndExclusive = addHourToLocalDateTime(`${weekStart}T00:00`, 24 * 7);
  return {
    timeMinIso: localDateTimeToUtcIso(`${weekStart}T00:00`, timeZone),
    timeMaxIso: localDateTimeToUtcIso(weekEndExclusive, timeZone),
  };
}

function formatCalendarSyncError(sourceLabel: string, error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return `${sourceLabel} sync failed: ${error.message.trim()}`;
  }

  return `${sourceLabel} sync failed: unknown error`;
}
