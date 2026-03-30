import type { Env } from "../../app-env";
import {
  buildScheduleEventDescription,
  buildScheduleEventTitle,
  createGoogleCalendarEvent,
  localDateTimeToUtcIso,
  resolveGoogleCalendarSourceForApp,
  resolveScheduleTimeZone,
  resolveWeekStart,
} from "../../calendar";
import { normalizeString } from "../../forms/normalize";
import { redirect } from "../../http/response";
import { getStudentById, updateStudent } from "../../students/store";
import { appendScheduleMessage, getScheduleReturnPath, normalizeScheduleSlotValue } from "./paths";

export async function handleScheduleMeeting(request: Request, env: Env): Promise<Response> {
  const returnPathPromise = getScheduleReturnPath(request);
  const formData = await request.formData();
  const returnPath = await returnPathPromise;
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
  const eventId = buildScheduledMeetingEventId(studentId, slotStart, slotEnd);

  try {
    await createGoogleCalendarEvent(calendarSource.config, {
      eventId,
      summary: title,
      description,
      startLocal: slotStart,
      endLocal: slotEnd,
      attendeeEmails: [meetingEmail],
    });
  } catch (error) {
    console.error("Failed to schedule Google Calendar event", error);
    return redirect(appendScheduleMessage(returnPath, { weekStart, studentId, slotStart, error: "Failed to schedule Google Calendar event" }));
  }

  try {
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
    console.error("Google Calendar invite created but student update failed", error);
    return redirect(
      appendScheduleMessage(returnPath, {
        weekStart,
        studentId,
        slotStart,
        error: "Google Calendar invite was created, but saving it in the app failed. Retrying is safe.",
      }),
    );
  }

  return redirect(appendScheduleMessage(returnPath, { weekStart, studentId, notice: "Meeting scheduled" }));
}

function normalizeScheduleWeekValue(value: FormDataEntryValue | string | null | undefined): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function buildScheduledMeetingEventId(studentId: number, slotStart: string, slotEnd: string): string {
  const hash = hashBase32Hex(`${studentId}|${slotStart}|${slotEnd}`);
  return `tjt${hash.padStart(13, "0")}`;
}

function hashBase32Hex(value: string): string {
  const alphabet = "0123456789abcdefghijklmnopqrstuv";
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  if (hash === 0) {
    return "0";
  }

  let encoded = "";
  let remaining = hash >>> 0;
  while (remaining > 0) {
    encoded = `${alphabet[remaining % 32]}${encoded}`;
    remaining = Math.floor(remaining / 32);
  }

  return encoded;
}
