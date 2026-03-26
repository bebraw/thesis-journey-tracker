import styles from "../.generated/styles.css";
import favicon from "./favicon.ico";
import { type AuthUser, isAccessRole, type SessionUser } from "./auth";
import { runAutomatedBackup, type R2BucketLike } from "./backup";
import {
  clearLoginAttempt,
  createMeetingLog,
  createStudent,
  deleteAppSecret,
  deleteStudent,
  type D1Database,
  type D1PreparedStatement,
  getAppSecret,
  getLoginAttempt,
  getStudentById,
  listLogsForStudent,
  listPhaseAuditEntriesForStudent,
  listAuthUsers,
  type LoginAttempt,
  listStudents,
  saveLoginAttempt,
  studentExists,
  upsertAppSecret,
  upsertAuthUser,
  updateStudent,
  updateStudentWithPhaseAudit,
} from "./db";
import { decryptText, encryptText } from "./encryption";
import {
  createGoogleCalendarEvent,
  type GoogleCalendarEvent,
  listGoogleCalendarEvents,
  resolveGoogleCalendarConfig,
} from "./google-calendar";
import { listIcalCalendarEvents } from "./ical";
import {
  addHourToLocalDateTime,
  buildScheduleEventDescription,
  buildScheduleEventTitle,
  buildScheduleWeek,
  localDateTimeToUtcIso,
  resolveScheduleTimeZone,
  resolveWeekStart,
} from "./scheduling";
import { hashPassword, verifyPassword } from "./password";
import { parseStudentFormSubmission } from "./student-form";
import {
  buildExportFilename,
  buildProfessorReportFilename,
  countImportedPhaseAuditEntries,
  countImportedLogs,
  createDataExport,
  createProfessorStatusReport,
  type ImportedStudentBundle,
  parseDataImport,
} from "./import-export";
import {
  buildSessionCookie,
  clearSessionCookie,
  createSessionToken,
  cssResponse,
  getSessionUser,
  javascriptResponse,
  htmlFragmentResponse,
  htmlResponse,
  iconResponse,
  isPastTargetSubmissionDate,
  normalizeDate,
  normalizeDateTime,
  normalizeString,
  redirect,
} from "./utils";
import { DASHBOARD_INTERACTION_SCRIPT } from "./view/dashboard/interaction-script";
import {
  renderAddStudentPage,
  renderDataToolsPage,
  renderDashboardPage,
  renderEmptySelectedPanel,
  renderLoginPage,
  renderSchedulePage,
  renderSelectedStudentPanel,
  renderStyleGuidePage,
} from "./views";
import type { DashboardFilters } from "./view/types";

const DEFAULT_DASHBOARD_SORT_KEY = "nextMeeting";
const DEFAULT_DASHBOARD_SORT_DIRECTION: DashboardFilters["sortDirection"] = "asc";
const DASHBOARD_SORT_KEYS = new Set(["student", "degree", "phase", "target", "nextMeeting", "logs"]);

interface Env {
  DB: D1Database;
  BACKUP_BUCKET?: R2BucketLike;
  BACKUP_PREFIX?: string;
  APP_ENCRYPTION_SECRET?: string;
  APP_PASSWORD?: string;
  APP_USERS_JSON?: string;
  REPLACE_IMPORT_ENABLED?: string;
  SESSION_SECRET?: string;
}

interface ScheduledControllerLike {
  cron: string;
}

const SESSION_COOKIE = "thesis_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
const GOOGLE_CALENDAR_SECRET_KEY = "google_calendar_config";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      console.error("Unhandled error", error);
      return new Response("Internal server error", { status: 500 });
    }
  },
  async scheduled(controller: ScheduledControllerLike, env: Env): Promise<void> {
    try {
      await handleScheduledBackup(controller, env);
    } catch (error) {
      console.error("Scheduled backup failed", error);
      throw error;
    }
  },
};

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const showStyleGuide = isLocalDevelopmentRequest(request);

  if (pathname === "/styles.css") {
    return cssResponse(styles);
  }

  if (pathname === "/dashboard.js") {
    return javascriptResponse(DASHBOARD_INTERACTION_SCRIPT);
  }

  if (pathname === "/favicon.ico") {
    return iconResponse(favicon);
  }

  if (!env.DB) {
    return new Response("D1 binding is missing. Configure DB in wrangler.toml.", { status: 500 });
  }

  if (!env.SESSION_SECRET) {
    return new Response("SESSION_SECRET must be configured.", { status: 500 });
  }

  if (pathname === "/style-guide" && !showStyleGuide) {
    return new Response("Not found", { status: 404 });
  }

  const authState = await resolveAuthState(env);
  if (authState.error) {
    return new Response(authState.error, { status: 500 });
  }

  const sessionUser = await getSessionUser(request, env.SESSION_SECRET, SESSION_COOKIE);

  if (pathname === "/login" && request.method === "GET") {
    if (sessionUser) {
      return redirect("/");
    }
    const errorState =
      url.searchParams.get("error") === "rate_limit"
        ? "rate_limit"
        : url.searchParams.get("error") === "password_reset"
          ? "password_reset"
          : url.searchParams.get("error")
            ? "invalid"
            : null;
    return htmlResponse(renderLoginPage(errorState, authState.users.length > 1));
  }

  if (pathname === "/login" && request.method === "POST") {
    const formData = await request.formData();
    const enteredName = (formData.get("name") || "").toString().trim();
    const password = (formData.get("password") || "").toString();
    const now = new Date();
    const loginAttemptKey = buildLoginAttemptKey(request);
    const currentAttempt = await getLoginAttempt(env.DB, loginAttemptKey);

    if (isLoginAttemptLocked(currentAttempt, now)) {
      return redirect("/login?error=rate_limit");
    }

    const candidateUser =
      authState.users.length === 1 && !enteredName
        ? authState.users[0] || null
        : authState.users.find((user) => user.name.toLocaleLowerCase() === enteredName.toLocaleLowerCase()) || null;

    let passwordVerified = false;
    try {
      passwordVerified = candidateUser ? await verifyPassword(password, candidateUser.passwordHash) : false;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Stored password hash uses")) {
        console.error("Password hash requires reset", { user: candidateUser?.name || enteredName, message });
        return redirect("/login?error=password_reset");
      }
      throw error;
    }

    if (!candidateUser || !passwordVerified) {
      const nextAttempt = buildFailedLoginAttempt(currentAttempt, loginAttemptKey, now);
      await saveLoginAttempt(env.DB, nextAttempt);
      return redirect(nextAttempt.lockedUntil ? "/login?error=rate_limit" : "/login?error=1");
    }

    await clearLoginAttempt(env.DB, loginAttemptKey);
    const token = await createSessionToken(env.SESSION_SECRET, SESSION_TTL_SECONDS, {
      name: candidateUser.name,
      role: candidateUser.role,
    });
    return redirect("/", {
      "Set-Cookie": buildSessionCookie(token, request.url, {
        cookieName: SESSION_COOKIE,
        ttlSeconds: SESSION_TTL_SECONDS,
      }),
    });
  }

  if (pathname === "/logout" && request.method === "POST") {
    return redirect("/login", {
      "Set-Cookie": clearSessionCookie(request.url, {
        cookieName: SESSION_COOKIE,
        ttlSeconds: SESSION_TTL_SECONDS,
      }),
    });
  }

  if (!sessionUser) {
    return redirect("/login");
  }

  if (pathname === "/" && request.method === "GET") {
    return await renderDashboard(env, url, sessionUser, showStyleGuide);
  }

  if (pathname === "/students/new" && request.method === "GET") {
    if (isReadonlyUser(sessionUser)) {
      return readonlyRedirect("/");
    }
    return renderAddStudent(url, sessionUser, showStyleGuide);
  }

  if (pathname === "/style-guide" && request.method === "GET") {
    if (isReadonlyUser(sessionUser)) {
      return readonlyRedirect("/");
    }
    return htmlResponse(
      renderStyleGuidePage({
        name: sessionUser.name,
        role: sessionUser.role,
      }),
    );
  }

  if (pathname === "/data-tools" && request.method === "GET") {
    if (isReadonlyUser(sessionUser)) {
      return readonlyRedirect("/");
    }
    return await renderDataTools(url, env, sessionUser);
  }

  if (pathname === "/schedule" && request.method === "GET") {
    if (isReadonlyUser(sessionUser)) {
      return readonlyRedirect("/");
    }
    return await renderSchedule(url, env, sessionUser, showStyleGuide);
  }

  const partialStudentMatch = pathname.match(/^\/partials\/student\/(\d+)$/);
  if (partialStudentMatch && request.method === "GET") {
    return await renderStudentPanelPartial(env, url, Number(partialStudentMatch[1]), sessionUser);
  }

  if (pathname === "/actions/export-json" && request.method === "GET") {
    if (isReadonlyUser(sessionUser)) {
      return readonlyRedirect("/");
    }
    return await handleExportJson(env);
  }

  if (pathname === "/actions/export-professor-report" && request.method === "GET") {
    if (isReadonlyUser(sessionUser)) {
      return readonlyRedirect("/");
    }
    return await handleProfessorReportExport(env);
  }

  if (pathname === "/actions/add-student" && request.method === "POST") {
    if (isReadonlyUser(sessionUser)) {
      return readonlyRedirect("/");
    }
    return await handleAddStudent(request, env);
  }

  if (pathname === "/actions/import-json" && request.method === "POST") {
    if (isReadonlyUser(sessionUser)) {
      return readonlyRedirect("/");
    }
    return await handleImportJson(request, env);
  }

  if (pathname === "/actions/save-google-calendar-settings" && request.method === "POST") {
    if (isReadonlyUser(sessionUser)) {
      return readonlyRedirect("/");
    }
    return await handleSaveGoogleCalendarSettings(request, env);
  }

  if (pathname === "/actions/save-google-calendar-ical-settings" && request.method === "POST") {
    if (isReadonlyUser(sessionUser)) {
      return readonlyRedirect("/");
    }
    return await handleSaveGoogleCalendarIcalSettings(request, env);
  }

  if (pathname === "/actions/clear-google-calendar-oauth-settings" && request.method === "POST") {
    if (isReadonlyUser(sessionUser)) {
      return readonlyRedirect("/");
    }
    return await handleClearGoogleCalendarOAuthSettings(env);
  }

  if (pathname === "/actions/clear-google-calendar-ical-settings" && request.method === "POST") {
    if (isReadonlyUser(sessionUser)) {
      return readonlyRedirect("/");
    }
    return await handleClearGoogleCalendarIcalSettings(env);
  }

  if (pathname === "/actions/clear-google-calendar-settings" && request.method === "POST") {
    if (isReadonlyUser(sessionUser)) {
      return readonlyRedirect("/");
    }
    return await handleClearGoogleCalendarSettings(env);
  }

  if (pathname === "/actions/schedule-meeting" && request.method === "POST") {
    if (isReadonlyUser(sessionUser)) {
      return readonlyRedirect(await getScheduleReturnPath(request));
    }
    return await handleScheduleMeeting(request, env);
  }

  const updateMatch = pathname.match(/^\/actions\/update-student\/(\d+)$/);
  if (updateMatch && request.method === "POST") {
    if (isReadonlyUser(sessionUser)) {
      return readonlyRedirect(await getDashboardReturnPath(request, { selectedId: Number(updateMatch[1]) }));
    }
    return await handleUpdateStudent(request, env, Number(updateMatch[1]));
  }

  const addLogMatch = pathname.match(/^\/actions\/add-log\/(\d+)$/);
  if (addLogMatch && request.method === "POST") {
    if (isReadonlyUser(sessionUser)) {
      return readonlyRedirect(await getDashboardReturnPath(request, { selectedId: Number(addLogMatch[1]) }));
    }
    return await handleAddLog(request, env, Number(addLogMatch[1]));
  }

  const deleteMatch = pathname.match(/^\/actions\/delete-student\/(\d+)$/);
  if (deleteMatch && request.method === "POST") {
    if (isReadonlyUser(sessionUser)) {
      return readonlyRedirect(await getDashboardReturnPath(request, { selectedId: Number(deleteMatch[1]) }));
    }
    return await handleDeleteStudent(request, env, Number(deleteMatch[1]));
  }

  return new Response("Not found", { status: 404 });
}

async function renderDashboard(env: Env, url: URL, sessionUser: SessionUser, showStyleGuide: boolean): Promise<Response> {
  const students = await listStudents(env.DB);
  const filters = getDashboardFilters(url.searchParams);

  const selectedIdParam = url.searchParams.get("selected");
  const parsedSelectedId = selectedIdParam ? Number.parseInt(selectedIdParam, 10) : 0;
  const selectedId = Number.isFinite(parsedSelectedId) ? parsedSelectedId : 0;
  const selectedStudent = students.find((student) => student.id === selectedId) || null;
  const logs = selectedStudent ? await listLogsForStudent(env.DB, selectedStudent.id) : [];
  const phaseAudit = selectedStudent ? await listPhaseAuditEntriesForStudent(env.DB, selectedStudent.id) : [];

  const notice = url.searchParams.get("notice");
  const error = url.searchParams.get("error");

  const today = new Date().toISOString().slice(0, 10);
  const metrics = {
    total: students.length,
    noMeeting: students.filter((student) => !student.nextMeetingAt).length,
    pastTarget: students.filter((student) => isPastTargetSubmissionDate(student, today)).length,
    submitted: students.filter((student) => student.currentPhase === "submitted").length,
  };

  return htmlResponse(
    renderDashboardPage({
      viewer: {
        name: sessionUser.name,
        role: sessionUser.role,
      },
      students,
      selectedStudent,
      logs,
      phaseAudit,
      filters,
      notice,
      error,
      metrics,
      showStyleGuide,
    }),
  );
}

function renderAddStudent(url: URL, sessionUser: SessionUser, showStyleGuide: boolean): Response {
  const notice = url.searchParams.get("notice");
  const error = url.searchParams.get("error");

  return htmlResponse(
    renderAddStudentPage({
      viewer: {
        name: sessionUser.name,
        role: sessionUser.role,
      },
      notice,
      error,
      showStyleGuide,
    }),
  );
}

async function renderDataTools(url: URL, env: Env, sessionUser: SessionUser): Promise<Response> {
  const notice = url.searchParams.get("notice");
  const error = url.searchParams.get("error");
  const students = await listStudents(env.DB);
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

async function renderSchedule(url: URL, env: Env, sessionUser: SessionUser, showStyleGuide: boolean): Promise<Response> {
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

async function renderStudentPanelPartial(env: Env, url: URL, studentId: number, sessionUser: SessionUser): Promise<Response> {
  const selectedStudent = await getStudentById(env.DB, studentId);

  if (!selectedStudent) {
    return htmlFragmentResponse(renderEmptySelectedPanel("Student not found."), 404);
  }

  const logs = await listLogsForStudent(env.DB, studentId);
  const phaseAudit = await listPhaseAuditEntriesForStudent(env.DB, studentId);
  return htmlFragmentResponse(
    renderSelectedStudentPanel(selectedStudent, logs, phaseAudit, {
      canEdit: !isReadonlyUser(sessionUser),
      filters: getDashboardFilters(url.searchParams),
    }),
  );
}

async function handleAddStudent(request: Request, env: Env): Promise<Response> {
  const formData = await request.formData();
  const studentInput = parseStudentFormSubmission(formData, { mode: "create" });
  if (!studentInput) {
    return redirect("/students/new?error=Invalid+student+input");
  }

  const selected = await createStudent(env.DB, studentInput);
  return redirect(`/?selected=${selected}&notice=Student+added`);
}

async function handleExportJson(env: Env): Promise<Response> {
  const students = await listStudents(env.DB);
  const studentBundles = await Promise.all(
    students.map(async (student) => ({
      student,
      logs: await listLogsForStudent(env.DB, student.id),
      phaseAudit: await listPhaseAuditEntriesForStudent(env.DB, student.id),
    })),
  );

  const body = JSON.stringify(createDataExport(studentBundles), null, 2);

  return new Response(body, {
    headers: {
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="${buildExportFilename()}"`,
      "content-type": "application/json; charset=utf-8",
    },
  });
}

async function handleProfessorReportExport(env: Env): Promise<Response> {
  const students = await listStudents(env.DB);
  const studentBundles = await Promise.all(
    students.map(async (student) => {
      const logs = await listLogsForStudent(env.DB, student.id);
      return {
        student,
        latestLog: logs[0] || null,
      };
    }),
  );

  const body = createProfessorStatusReport(studentBundles);

  return new Response(body, {
    headers: {
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="${buildProfessorReportFilename()}"`,
      "content-type": "text/markdown; charset=utf-8",
    },
  });
}

async function handleScheduledBackup(controller: ScheduledControllerLike, env: Env): Promise<void> {
  if (!env.DB) {
    console.warn("Skipping automated backup because the D1 binding is missing.");
    return;
  }

  if (!env.BACKUP_BUCKET) {
    console.warn("Skipping automated backup because the R2 BACKUP_BUCKET binding is missing.");
    return;
  }

  const result = await runAutomatedBackup(env.DB, env.BACKUP_BUCKET, {
    backupPrefix: env.BACKUP_PREFIX,
    cron: controller.cron,
  });

  console.log(`Automated backup completed: ${result.manifestKey}`);
}

async function handleUpdateStudent(request: Request, env: Env, studentId: number): Promise<Response> {
  const returnPath = await getDashboardReturnPath(request, { selectedId: studentId });
  const existingStudent = await getStudentById(env.DB, studentId);
  if (!existingStudent) {
    return redirect(appendDashboardMessage(returnPath, { error: "Student not found" }));
  }

  const formData = await request.formData();
  const studentInput = parseStudentFormSubmission(formData, {
    mode: "update",
    existingStudent,
  });

  if (!studentInput) {
    return redirect(appendDashboardMessage(returnPath, { selectedId: studentId, error: "Invalid update input" }));
  }

  try {
    if (existingStudent.currentPhase !== studentInput.currentPhase) {
      await updateStudentWithPhaseAudit(env.DB, studentId, studentInput, {
        studentId,
        changedAt: new Date().toISOString(),
        fromPhase: existingStudent.currentPhase,
        toPhase: studentInput.currentPhase,
      });
    } else {
      await updateStudent(env.DB, studentId, studentInput);
    }
  } catch (error) {
    console.error("Failed to save student update", error);
    return redirect(appendDashboardMessage(returnPath, { selectedId: studentId, error: "Failed to save student update" }));
  }

  return redirect(appendDashboardMessage(returnPath, { selectedId: studentId, notice: "Student updated" }));
}

async function handleImportJson(request: Request, env: Env): Promise<Response> {
  const formData = await request.formData();
  const file = formData.get("importFile");
  const mode = formData.get("mode") === "replace" ? "replace" : "append";
  const replaceConfirmed = formData.get("confirmReplace") === "yes";
  const replaceImportEnabled = isReplaceImportEnabled(env);

  if (!file || typeof file !== "object" || !("text" in file) || typeof file.text !== "function") {
    return redirect("/data-tools?error=Choose+a+JSON+file+to+import");
  }

  const { data, error } = parseDataImport(await file.text());
  if (!data || error) {
    return redirect(`/data-tools?error=${encodeURIComponent(error || "Import+failed")}`);
  }

  if (mode === "replace" && !replaceConfirmed) {
    return redirect("/data-tools?error=Confirm+replacement+before+importing");
  }

  if (mode === "replace" && !replaceImportEnabled) {
    return redirect("/data-tools?error=Replacement+imports+are+disabled+in+this+environment");
  }

  try {
    const statements = await buildImportStatements(env.DB, data, mode);
    if (statements.length > 0) {
      await env.DB.batch(statements);
    }
  } catch (error) {
    console.error("Import failed", error);
    const errorMessage =
      mode === "replace" ? "Replacement import failed. Existing data was left unchanged." : "Import failed. No changes were saved.";
    return redirect(`/data-tools?error=${encodeURIComponent(errorMessage)}`);
  }

  const logCount = countImportedLogs(data);
  const phaseAuditCount = countImportedPhaseAuditEntries(data);
  const modeText = mode === "replace" ? "replaced existing data" : "appended to existing data";
  return redirect(
    `/data-tools?notice=${encodeURIComponent(`Imported ${data.length} students, ${logCount} logs, and ${phaseAuditCount} phase changes; ${modeText}.`)}`,
  );
}

async function handleSaveGoogleCalendarSettings(request: Request, env: Env): Promise<Response> {
  const formData = await request.formData();
  const clientId = normalizeString(formData.get("clientId"));
  const clientSecret = normalizeString(formData.get("clientSecret"));
  const refreshToken = normalizeString(formData.get("refreshToken"));
  const calendarId = normalizeString(formData.get("calendarId"));
  const timeZone = normalizeString(formData.get("timeZone"));

  if (!clientId || !clientSecret || !refreshToken || !calendarId) {
    return redirect("/data-tools?error=All+Google+Calendar+credential+fields+except+timezone+are+required");
  }

  const encryptionSecret = resolveAppEncryptionSecret(env);
  const now = new Date().toISOString();

  try {
    await saveStoredGoogleCalendarSettings(env, {
      ...(await getStoredGoogleCalendarSettingsPayload(env)),
      clientId,
      clientSecret,
      refreshToken,
      calendarId,
      timeZone: timeZone || undefined,
    }, now);
  } catch (error) {
    console.error("Failed to save Google Calendar settings", error);
    return redirect("/data-tools?error=Failed+to+save+encrypted+Google+Calendar+settings");
  }

  return redirect("/data-tools?notice=Encrypted+Google+Calendar+settings+saved");
}

async function handleSaveGoogleCalendarIcalSettings(request: Request, env: Env): Promise<Response> {
  const formData = await request.formData();
  const iCalUrl = normalizeString(formData.get("iCalUrl"));
  const timeZone = normalizeString(formData.get("timeZone"));

  if (!iCalUrl) {
    return redirect("/data-tools?error=Google+Calendar+iCal+URL+is+required");
  }

  const now = new Date().toISOString();
  try {
    await saveStoredGoogleCalendarSettings(env, {
      ...(await getStoredGoogleCalendarSettingsPayload(env)),
      iCalUrl,
      timeZone: timeZone || undefined,
    }, now);
  } catch (error) {
    console.error("Failed to save Google Calendar iCal settings", error);
    return redirect("/data-tools?error=Failed+to+save+encrypted+Google+Calendar+iCal+settings");
  }

  return redirect("/data-tools?notice=Encrypted+Google+Calendar+iCal+settings+saved");
}

async function handleClearGoogleCalendarOAuthSettings(env: Env): Promise<Response> {
  try {
    const currentSettings = await getStoredGoogleCalendarSettingsPayload(env);
    const nextSettings: StoredGoogleCalendarSettings = {
      ...currentSettings,
      clientId: undefined,
      clientSecret: undefined,
      refreshToken: undefined,
      calendarId: undefined,
    };
    await persistOrClearGoogleCalendarSettings(env, nextSettings, new Date().toISOString());
  } catch (error) {
    console.error("Failed to clear Google Calendar OAuth settings", error);
    return redirect("/data-tools?error=Failed+to+clear+stored+Google+Calendar+credentials");
  }

  return redirect("/data-tools?notice=Stored+Google+Calendar+credentials+cleared");
}

async function handleClearGoogleCalendarIcalSettings(env: Env): Promise<Response> {
  try {
    const currentSettings = await getStoredGoogleCalendarSettingsPayload(env);
    const nextSettings: StoredGoogleCalendarSettings = {
      ...currentSettings,
      iCalUrl: undefined,
    };
    await persistOrClearGoogleCalendarSettings(env, nextSettings, new Date().toISOString());
  } catch (error) {
    console.error("Failed to clear Google Calendar iCal settings", error);
    return redirect("/data-tools?error=Failed+to+clear+stored+Google+Calendar+iCal+settings");
  }

  return redirect("/data-tools?notice=Stored+Google+Calendar+iCal+settings+cleared");
}

async function saveStoredGoogleCalendarSettings(env: Env, settings: StoredGoogleCalendarSettings, updatedAt: string): Promise<void> {
  await persistOrClearGoogleCalendarSettings(env, settings, updatedAt);
}

async function persistOrClearGoogleCalendarSettings(env: Env, settings: StoredGoogleCalendarSettings, updatedAt: string): Promise<void> {
  if (!hasAnyStoredGoogleCalendarSettings(settings)) {
    await deleteAppSecret(env.DB, GOOGLE_CALENDAR_SECRET_KEY);
    return;
  }

  const encryptedValue = await encryptText(
    JSON.stringify({
      ...settings,
      clientId: settings.clientId || undefined,
      clientSecret: settings.clientSecret || undefined,
      refreshToken: settings.refreshToken || undefined,
      calendarId: settings.calendarId || undefined,
      iCalUrl: settings.iCalUrl || undefined,
      timeZone: settings.timeZone || undefined,
    }),
    resolveAppEncryptionSecret(env),
  );

  await upsertAppSecret(env.DB, GOOGLE_CALENDAR_SECRET_KEY, encryptedValue, updatedAt);
}

async function getStoredGoogleCalendarSettingsPayload(env: Env): Promise<StoredGoogleCalendarSettings> {
  return (await getStoredGoogleCalendarSettings(env))?.settings || {};
}

async function handleClearGoogleCalendarSettings(env: Env): Promise<Response> {
  try {
    await deleteAppSecret(env.DB, GOOGLE_CALENDAR_SECRET_KEY);
  } catch (error) {
    console.error("Failed to clear Google Calendar settings", error);
    return redirect("/data-tools?error=Failed+to+clear+stored+Google+Calendar+settings");
  }

  return redirect("/data-tools?notice=Stored+Google+Calendar+settings+cleared");
}

function hasAnyStoredGoogleCalendarSettings(settings: StoredGoogleCalendarSettings): boolean {
  return Boolean(
    settings.clientId ||
      settings.clientSecret ||
      settings.refreshToken ||
      settings.calendarId ||
      settings.iCalUrl ||
      settings.timeZone,
  );
}

async function handleScheduleMeeting(request: Request, env: Env): Promise<Response> {
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

async function handleAddLog(request: Request, env: Env, studentId: number): Promise<Response> {
  const returnPath = await getDashboardReturnPath(request, { selectedId: studentId });
  const formData = await request.formData();

  const happenedAt = normalizeDateTime(formData.get("happenedAt"), true) || new Date().toISOString();
  const discussed = normalizeString(formData.get("discussed"));
  const agreedPlan = normalizeString(formData.get("agreedPlan"));
  const nextStepDeadlineValue = formData.get("nextStepDeadline");
  const nextStepDeadline =
    nextStepDeadlineValue === null ? null : normalizeDate(nextStepDeadlineValue, true);

  if (!discussed || !agreedPlan || nextStepDeadline === undefined) {
    return redirect(appendDashboardMessage(returnPath, { selectedId: studentId, error: "Invalid log input" }));
  }

  if (!(await studentExists(env.DB, studentId))) {
    return redirect(appendDashboardMessage(returnPath, { error: "Student not found" }));
  }

  await createMeetingLog(env.DB, {
    studentId,
    happenedAt,
    discussed,
    agreedPlan,
    nextStepDeadline,
  });

  return redirect(appendDashboardMessage(returnPath, { selectedId: studentId, notice: "Log saved" }));
}

async function handleDeleteStudent(request: Request, env: Env, studentId: number): Promise<Response> {
  const returnPath = await getDashboardReturnPath(request);
  if (!(await studentExists(env.DB, studentId))) {
    return redirect(appendDashboardMessage(returnPath, { error: "Student not found" }));
  }

  await deleteStudent(env.DB, studentId);
  return redirect(returnPath);
}

function getDashboardFilters(searchParams: URLSearchParams): DashboardFilters {
  const rawSortKey = searchParams.get("sort") || "";
  const rawSortDirection = searchParams.get("dir") === "desc" ? "desc" : "asc";
  const sortKey = DASHBOARD_SORT_KEYS.has(rawSortKey) ? rawSortKey : DEFAULT_DASHBOARD_SORT_KEY;

  return {
    search: (searchParams.get("search") || "").trim(),
    degree: searchParams.get("degree") || "",
    phase: searchParams.get("phase") || "",
    status: searchParams.get("status") || "",
    sortKey,
    sortDirection: rawSortDirection,
  };
}

function buildDashboardPath(filters: DashboardFilters, options: { selectedId?: number; notice?: string; error?: string } = {}): string {
  const searchParams = new URLSearchParams();

  if (options.selectedId) {
    searchParams.set("selected", String(options.selectedId));
  }
  if (filters.search) {
    searchParams.set("search", filters.search);
  }
  if (filters.degree) {
    searchParams.set("degree", filters.degree);
  }
  if (filters.phase) {
    searchParams.set("phase", filters.phase);
  }
  if (filters.status) {
    searchParams.set("status", filters.status);
  }
  if (filters.sortKey !== DEFAULT_DASHBOARD_SORT_KEY || filters.sortDirection !== DEFAULT_DASHBOARD_SORT_DIRECTION) {
    searchParams.set("sort", filters.sortKey);
    searchParams.set("dir", filters.sortDirection);
  }
  if (options.notice) {
    searchParams.set("notice", options.notice);
  }
  if (options.error) {
    searchParams.set("error", options.error);
  }

  const query = searchParams.toString();
  return query ? `/?${query}` : "/";
}

function appendDashboardMessage(pathname: string, options: { selectedId?: number; notice?: string; error?: string }): string {
  const url = new URL(pathname, "https://dashboard.local");
  return buildDashboardPath(getDashboardFilters(url.searchParams), options);
}

function buildSchedulePath(options: {
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

function appendScheduleMessage(
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

function parseDashboardReturnTo(rawValue: FormDataEntryValue | null): DashboardFilters {
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    return getDashboardFilters(new URLSearchParams());
  }

  try {
    const url = new URL(rawValue, "https://dashboard.local");
    if (url.pathname !== "/") {
      return getDashboardFilters(new URLSearchParams());
    }
    return getDashboardFilters(url.searchParams);
  } catch {
    return getDashboardFilters(new URLSearchParams());
  }
}

async function getDashboardReturnPath(request: Request, options: { selectedId?: number } = {}): Promise<string> {
  const formData = await request.clone().formData();
  return buildDashboardPath(parseDashboardReturnTo(formData.get("returnTo")), {
    selectedId: options.selectedId,
  });
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

async function getScheduleReturnPath(request: Request): Promise<string> {
  const formData = await request.clone().formData();
  return parseScheduleReturnTo(formData.get("returnTo"));
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

interface StoredGoogleCalendarSettings {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  calendarId?: string;
  iCalUrl?: string;
  timeZone?: string;
}

interface StoredGoogleCalendarSettingsRecord {
  settings: StoredGoogleCalendarSettings;
  updatedAt: string;
}

type GoogleCalendarSource =
  | {
      mode: "api";
      label: "Google Calendar";
      config: NonNullable<ReturnType<typeof resolveGoogleCalendarConfig>>;
      timeZone: string;
    }
  | {
      mode: "ical";
      label: "Google Calendar iCal";
      iCalUrl: string;
      timeZone: string;
    };

async function resolveGoogleCalendarSourceForApp(env: Env): Promise<GoogleCalendarSource | null> {
  const storedSettings = await getStoredGoogleCalendarSettings(env);
  if (!storedSettings) {
    return null;
  }

  const apiConfig = resolveGoogleCalendarConfig(storedSettings.settings);
  if (apiConfig) {
    return {
      mode: "api",
      label: "Google Calendar",
      config: apiConfig,
      timeZone: apiConfig.timeZone,
    };
  }

  const iCalUrl = normalizeString(storedSettings.settings.iCalUrl);
  if (!iCalUrl) {
    return null;
  }

  return {
    mode: "ical",
    label: "Google Calendar iCal",
    iCalUrl,
    timeZone: resolveScheduleTimeZone(storedSettings.settings.timeZone),
  };
}

async function getStoredGoogleCalendarSettings(env: Env): Promise<StoredGoogleCalendarSettingsRecord | null> {
  const storedSecret = await getAppSecret(env.DB, GOOGLE_CALENDAR_SECRET_KEY);
  if (!storedSecret) {
    return null;
  }

  try {
    const decryptedPayload = await decryptText(storedSecret.encryptedValue, resolveAppEncryptionSecret(env));
    return {
      settings: JSON.parse(decryptedPayload) as StoredGoogleCalendarSettings,
      updatedAt: storedSecret.updatedAt,
    };
  } catch (error) {
    console.error("Failed to load stored Google Calendar settings", error);
    return null;
  }
}

function resolveAppEncryptionSecret(env: Env): string {
  return env.APP_ENCRYPTION_SECRET || env.SESSION_SECRET || "";
}

async function resolveAuthState(env: Env): Promise<{ users: Awaited<ReturnType<typeof listAuthUsers>>; error?: string }> {
  try {
    let users = await listAuthUsers(env.DB);
    if (users.length > 0) {
      return { users };
    }

    const bootstrapUsers = resolveLegacyAuthConfig(env);
    if (!bootstrapUsers) {
      return {
        users: [],
        error: "No auth users found in the database. Create at least one account and run the latest D1 migrations.",
      };
    }

    if (bootstrapUsers.error) {
      return {
        users: [],
        error: bootstrapUsers.error,
      };
    }

    for (const user of bootstrapUsers.users) {
      await upsertAuthUser(env.DB, {
        name: user.name,
        passwordHash: await hashPassword(user.password),
        role: user.role,
      });
    }

    users = await listAuthUsers(env.DB);
    if (users.length === 0) {
      return {
        users: [],
        error: "No auth users found in the database. Create at least one account and run the latest D1 migrations.",
      };
    }

    return { users };
  } catch {
    return {
      users: [],
      error: "Auth user storage is unavailable. Run the latest D1 migrations before starting the app.",
    };
  }
}

function resolveLegacyAuthConfig(env: Env): { users: AuthUser[]; error?: string } | null {
  if (env.APP_USERS_JSON) {
    try {
      const parsed = JSON.parse(env.APP_USERS_JSON) as unknown;
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return {
          users: [],
          error: "APP_USERS_JSON must be a non-empty JSON array.",
        };
      }

      const users = parsed.flatMap((value) => {
        if (!value || typeof value !== "object") {
          return [];
        }

        const candidate = value as Record<string, unknown>;
        const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
        const password = typeof candidate.password === "string" ? candidate.password : "";
        const role = candidate.role;

        if (!name || !password || !isAccessRole(role)) {
          return [];
        }

        return [
          {
            name,
            password,
            role,
          },
        ];
      });

      if (users.length !== parsed.length) {
        return {
          users: [],
          error: 'Each APP_USERS_JSON entry must include "name", "password", and role "editor" or "readonly".',
        };
      }

      return { users };
    } catch {
      return {
        users: [],
        error: "APP_USERS_JSON must be valid JSON.",
      };
    }
  }

  if (env.APP_PASSWORD) {
    return {
      users: [
        {
          name: "Advisor",
          password: env.APP_PASSWORD,
          role: "editor",
        },
      ],
    };
  }

  return null;
}

function isReadonlyUser(user: SessionUser): boolean {
  return user.role === "readonly";
}

function readonlyRedirect(pathname: string): Response {
  const separator = pathname.includes("?") ? "&" : "?";
  return redirect(`${pathname}${separator}error=Read-only+access`);
}

function isReplaceImportEnabled(env: Env): boolean {
  const rawValue = (env.REPLACE_IMPORT_ENABLED || "").trim().toLocaleLowerCase();
  return rawValue === "1" || rawValue === "true" || rawValue === "yes";
}

function isLocalDevelopmentRequest(request: Request): boolean {
  const hostname = new URL(request.url).hostname.toLocaleLowerCase();
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

function buildLoginAttemptKey(request: Request): string {
  return `ip:${readClientIpAddress(request)}`;
}

function readClientIpAddress(request: Request): string {
  const directIp = normalizeIpAddress(request.headers.get("cf-connecting-ip"));
  if (directIp) {
    return directIp;
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const forwardedIp = normalizeIpAddress(forwardedFor.split(",")[0] || "");
    if (forwardedIp) {
      return forwardedIp;
    }
  }

  return "local-development";
}

function normalizeIpAddress(value: string | null | undefined): string | null {
  const normalized = (value || "").trim();
  return normalized.length > 0 ? normalized : null;
}

function isLoginAttemptLocked(attempt: LoginAttempt | null, now: Date): boolean {
  if (!attempt?.lockedUntil) {
    return false;
  }

  const lockedUntilTime = Date.parse(attempt.lockedUntil);
  return Number.isFinite(lockedUntilTime) && lockedUntilTime > now.getTime();
}

function buildFailedLoginAttempt(previousAttempt: LoginAttempt | null, attemptKey: string, now: Date): LoginAttempt {
  const nowIso = now.toISOString();
  const nowTime = now.getTime();
  const previousLastFailedAt = previousAttempt ? Date.parse(previousAttempt.lastFailedAt) : NaN;
  const previousLockExpired =
    previousAttempt?.lockedUntil && Number.isFinite(Date.parse(previousAttempt.lockedUntil))
      ? Date.parse(previousAttempt.lockedUntil) <= nowTime
      : false;
  const isWithinFailureWindow =
    previousAttempt && !previousLockExpired && Number.isFinite(previousLastFailedAt) && nowTime - previousLastFailedAt <= LOGIN_FAILURE_WINDOW_MS;

  const failureCount = isWithinFailureWindow ? previousAttempt.failureCount + 1 : 1;
  const firstFailedAt = isWithinFailureWindow ? previousAttempt.firstFailedAt : nowIso;

  return {
    attemptKey,
    failureCount,
    firstFailedAt,
    lastFailedAt: nowIso,
    lockedUntil: failureCount >= LOGIN_MAX_FAILURES ? new Date(nowTime + LOGIN_LOCKOUT_MS).toISOString() : null,
  };
}

async function buildImportStatements(
  db: D1Database,
  data: ImportedStudentBundle[],
  mode: "append" | "replace",
): Promise<D1PreparedStatement[]> {
  const baseIds = mode === "replace" ? { student: 0, log: 0, phaseAudit: 0 } : await readCurrentImportIds(db);
  let nextStudentId = baseIds.student + 1;
  let nextLogId = baseIds.log + 1;
  let nextPhaseAuditId = baseIds.phaseAudit + 1;

  const statements: D1PreparedStatement[] = [];

  if (mode === "replace") {
    statements.push(db.prepare("DELETE FROM students"));
  }

  for (const bundle of data) {
    const studentId = nextStudentId;
    nextStudentId += 1;

    statements.push(
      db
        .prepare(
          `INSERT INTO students (id, name, email, degree_type, thesis_topic, student_notes, start_date, current_phase, next_meeting_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          studentId,
          bundle.student.name,
          bundle.student.email,
          bundle.student.degreeType,
          bundle.student.thesisTopic,
          bundle.student.studentNotes,
          bundle.student.startDate,
          bundle.student.currentPhase,
          bundle.student.nextMeetingAt,
        ),
    );

    for (const log of bundle.logs) {
      statements.push(
        db
          .prepare(
            `INSERT INTO meeting_logs (id, student_id, happened_at, discussed, agreed_plan, next_step_deadline)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .bind(nextLogId, studentId, log.happenedAt, log.discussed, log.agreedPlan, log.nextStepDeadline),
      );
      nextLogId += 1;
    }

    for (const entry of bundle.phaseAudit) {
      statements.push(
        db
          .prepare(
            `INSERT INTO student_phase_audit (id, student_id, changed_at, from_phase, to_phase)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .bind(nextPhaseAuditId, studentId, entry.changedAt, entry.fromPhase, entry.toPhase),
      );
      nextPhaseAuditId += 1;
    }
  }

  return statements;
}

async function readCurrentImportIds(db: D1Database): Promise<{ student: number; log: number; phaseAudit: number }> {
  const [studentRow, logRow, phaseAuditRow] = await Promise.all([
    db.prepare("SELECT COALESCE(MAX(id), 0) AS max_id FROM students").first<{ max_id: number | string | null }>(),
    db.prepare("SELECT COALESCE(MAX(id), 0) AS max_id FROM meeting_logs").first<{ max_id: number | string | null }>(),
    db.prepare("SELECT COALESCE(MAX(id), 0) AS max_id FROM student_phase_audit").first<{ max_id: number | string | null }>(),
  ]);

  return {
    student: parseMaxIdValue(studentRow?.max_id),
    log: parseMaxIdValue(logRow?.max_id),
    phaseAudit: parseMaxIdValue(phaseAuditRow?.max_id),
  };
}

function parseMaxIdValue(value: number | string | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}
