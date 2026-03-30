import type { SessionUser } from "../../auth";
import type { Env } from "../../app-env";
import { getStoredGoogleCalendarSettings, resolveGoogleCalendarSourceForApp } from "../../calendar";
import { htmlResponse } from "../../http/response";
import { listStudents } from "../../students/store";
import { renderDataToolsPage } from "../../views";
import { isReplaceImportEnabled } from "./transfer";

export async function renderDataTools(url: URL, env: Env, sessionUser: SessionUser): Promise<Response> {
  const notice = url.searchParams.get("notice");
  const error = url.searchParams.get("error");
  const students = await listStudents(env.DB, { includeArchived: true });
  const logCount = students.reduce((total, student) => total + student.logCount, 0);
  const storedCalendarSettings = await getStoredGoogleCalendarSettings(env);
  const calendarSource = await resolveGoogleCalendarSourceForApp(env);

  return htmlResponse(
    renderDataToolsPage({
      viewer: {
        name: sessionUser.name,
        role: sessionUser.role,
      },
      notice,
      error,
      studentCount: students.length,
      logCount,
      replaceImportEnabled: isReplaceImportEnabled(env),
      googleCalendarConfigSource: calendarSource?.mode === "api" ? "stored_api" : calendarSource?.mode === "ical" ? "stored_ical" : "none",
      storedGoogleCalendarUpdatedAt: storedCalendarSettings?.updatedAt || null,
      effectiveGoogleCalendarId: calendarSource?.mode === "api" ? calendarSource.config.calendarId : null,
      effectiveGoogleCalendarTimeZone: calendarSource?.timeZone || null,
      googleCalendarClientId: storedCalendarSettings?.settings.clientId || "",
      googleCalendarClientSecret: storedCalendarSettings?.settings.clientSecret || "",
      googleCalendarRefreshToken: storedCalendarSettings?.settings.refreshToken || "",
      googleCalendarCalendarId: storedCalendarSettings?.settings.calendarId || "",
      googleCalendarIcalUrl: storedCalendarSettings?.settings.iCalUrl || "",
      googleCalendarTimeZone: storedCalendarSettings?.settings.timeZone || "",
    }),
  );
}
