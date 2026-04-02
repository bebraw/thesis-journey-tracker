import styles from "../.generated/styles.css";
import favicon from "./favicon.ico";
import { getSessionUser, isReadonlyUser, resolveAuthState, SESSION_COOKIE, SESSION_TTL_SECONDS } from "./auth";
import { runAutomatedBackup } from "./backup";
import type { Env, ScheduledControllerLike } from "./app-env";
import type { D1Database } from "./db-core";
import { cssResponse, htmlResponse, iconResponse, javascriptResponse, redirect } from "./http/response";
import { handleLoginRequest, handleLogout, readonlyRedirect } from "./routes/auth";
import {
  handleAddLog,
  handleAddStudent,
  handleArchiveStudent,
  getDashboardReturnPath,
  handleUpdateStudent,
  renderAddStudent,
  renderDashboard,
  renderStudentPanelPartial,
} from "./routes/dashboard";
import {
  handleClearGoogleCalendarIcalSettings,
  handleClearGoogleCalendarOAuthSettings,
  handleClearGoogleCalendarSettings,
  handleExportJson,
  handleImportJson,
  handleProfessorReportExport,
  handleSaveGoogleCalendarIcalSettings,
  handleSaveGoogleCalendarSettings,
  renderDataTools,
} from "./routes/data-tools";
import { getScheduleReturnPath, handleScheduleMeeting, renderSchedule } from "./routes/schedule";
import { DASHBOARD_INTERACTION_SCRIPT } from "./view/dashboard/interaction-script";
import { renderStyleGuidePage } from "./views";

const D1_BOOKMARK_COOKIE = "thesis_d1_bookmark";

interface D1SessionState {
  session: globalThis.D1DatabaseSession;
  database: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const sessionState = createRequestD1Session(request, env.DB);
      const response = await handleRequest(request, sessionState ? { ...env, DB: sessionState.database } : env);
      return finalizeD1SessionResponse(response, request.url, sessionState);
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

function createRequestD1Session(request: Request, db: D1Database | null | undefined): D1SessionState | null {
  if (!db || !hasD1SessionApi(db)) {
    return null;
  }

  const bookmark = readCookie(request.headers.get("cookie") || "", D1_BOOKMARK_COOKIE);
  const session = db.withSession(bookmark || "first-primary");
  return {
    session,
    database: session,
  };
}

function finalizeD1SessionResponse(response: Response, requestUrl: string, sessionState: D1SessionState | null): Response {
  if (!sessionState) {
    return response;
  }

  const existingSetCookie = response.headers.get("set-cookie") || "";
  if (existingSetCookie.includes(`${D1_BOOKMARK_COOKIE}=`)) {
    return response;
  }

  const bookmark = sessionState.session.getBookmark();
  if (!bookmark) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.append("Set-Cookie", buildBookmarkCookie(requestUrl, bookmark));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function hasD1SessionApi(db: D1Database): db is globalThis.D1Database {
  return "withSession" in db && typeof db.withSession === "function";
}

function buildBookmarkCookie(requestUrl: string, bookmark: string): string {
  const securePart = new URL(requestUrl).protocol === "https:" ? " Secure;" : "";
  return `${D1_BOOKMARK_COOKIE}=${encodeURIComponent(bookmark)}; HttpOnly;${securePart} Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

function clearBookmarkCookie(requestUrl: string): string {
  const securePart = new URL(requestUrl).protocol === "https:" ? " Secure;" : "";
  return `${D1_BOOKMARK_COOKIE}=; HttpOnly;${securePart} Path=/; SameSite=Lax; Max-Age=0`;
}

function readCookie(cookieHeader: string, name: string): string | null {
  for (const item of cookieHeader.split(";")) {
    const [key, ...valueParts] = item.trim().split("=");
    if (key === name) {
      const rawValue = valueParts.join("=");
      try {
        return decodeURIComponent(rawValue);
      } catch {
        return rawValue;
      }
    }
  }
  return null;
}

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

  if (pathname === "/login" && (request.method === "GET" || request.method === "POST")) {
    return await handleLoginRequest(request, env, authState, sessionUser);
  }

  if (pathname === "/logout" && request.method === "POST") {
    return handleLogout(request.url, clearBookmarkCookie(request.url));
  }

  if (!sessionUser) {
    return redirect("/login");
  }

  const ensureEditor = (pathname: string): Response | null => {
    return isReadonlyUser(sessionUser) ? readonlyRedirect(pathname) : null;
  };

  if (pathname === "/" && request.method === "GET") {
    return await renderDashboard(env, url, sessionUser, showStyleGuide);
  }

  if (pathname === "/students/new" && request.method === "GET") {
    const readonlyResponse = ensureEditor("/");
    if (readonlyResponse) return readonlyResponse;
    return renderAddStudent(url, sessionUser, showStyleGuide);
  }

  if (pathname === "/style-guide" && request.method === "GET") {
    const readonlyResponse = ensureEditor("/");
    if (readonlyResponse) return readonlyResponse;
    return htmlResponse(
      renderStyleGuidePage({
        name: sessionUser.name,
        role: sessionUser.role,
      }),
    );
  }

  if (pathname === "/data-tools" && request.method === "GET") {
    const readonlyResponse = ensureEditor("/");
    if (readonlyResponse) return readonlyResponse;
    return await renderDataTools(url, env, sessionUser);
  }

  if (pathname === "/schedule" && request.method === "GET") {
    const readonlyResponse = ensureEditor("/");
    if (readonlyResponse) return readonlyResponse;
    return await renderSchedule(url, env, sessionUser, showStyleGuide);
  }

  const partialStudentMatch = pathname.match(/^\/partials\/student\/(\d+)$/);
  if (partialStudentMatch && request.method === "GET") {
    return await renderStudentPanelPartial(env, url, Number(partialStudentMatch[1]), sessionUser);
  }

  if (pathname === "/actions/export-json" && request.method === "GET") {
    const readonlyResponse = ensureEditor("/");
    if (readonlyResponse) return readonlyResponse;
    return await handleExportJson(env);
  }

  if (pathname === "/actions/export-professor-report" && request.method === "GET") {
    const readonlyResponse = ensureEditor("/");
    if (readonlyResponse) return readonlyResponse;
    return await handleProfessorReportExport(env);
  }

  if (pathname === "/actions/add-student" && request.method === "POST") {
    const readonlyResponse = ensureEditor("/");
    if (readonlyResponse) return readonlyResponse;
    return await handleAddStudent(request, env);
  }

  if (pathname === "/actions/import-json" && request.method === "POST") {
    const readonlyResponse = ensureEditor("/");
    if (readonlyResponse) return readonlyResponse;
    return await handleImportJson(request, env);
  }

  if (pathname === "/actions/save-google-calendar-settings" && request.method === "POST") {
    const readonlyResponse = ensureEditor("/");
    if (readonlyResponse) return readonlyResponse;
    return await handleSaveGoogleCalendarSettings(request, env);
  }

  if (pathname === "/actions/save-google-calendar-ical-settings" && request.method === "POST") {
    const readonlyResponse = ensureEditor("/");
    if (readonlyResponse) return readonlyResponse;
    return await handleSaveGoogleCalendarIcalSettings(request, env);
  }

  if (pathname === "/actions/clear-google-calendar-oauth-settings" && request.method === "POST") {
    const readonlyResponse = ensureEditor("/");
    if (readonlyResponse) return readonlyResponse;
    return await handleClearGoogleCalendarOAuthSettings(env);
  }

  if (pathname === "/actions/clear-google-calendar-ical-settings" && request.method === "POST") {
    const readonlyResponse = ensureEditor("/");
    if (readonlyResponse) return readonlyResponse;
    return await handleClearGoogleCalendarIcalSettings(env);
  }

  if (pathname === "/actions/clear-google-calendar-settings" && request.method === "POST") {
    const readonlyResponse = ensureEditor("/");
    if (readonlyResponse) return readonlyResponse;
    return await handleClearGoogleCalendarSettings(env);
  }

  if (pathname === "/actions/schedule-meeting" && request.method === "POST") {
    const readonlyResponse = ensureEditor(await getScheduleReturnPath(request));
    if (readonlyResponse) return readonlyResponse;
    return await handleScheduleMeeting(request, env);
  }

  const updateMatch = pathname.match(/^\/actions\/update-student\/(\d+)$/);
  if (updateMatch && request.method === "POST") {
    const readonlyResponse = ensureEditor(await getDashboardReturnPath(request, { selectedId: Number(updateMatch[1]) }));
    if (readonlyResponse) return readonlyResponse;
    return await handleUpdateStudent(request, env, Number(updateMatch[1]));
  }

  const addLogMatch = pathname.match(/^\/actions\/add-log\/(\d+)$/);
  if (addLogMatch && request.method === "POST") {
    const readonlyResponse = ensureEditor(await getDashboardReturnPath(request, { selectedId: Number(addLogMatch[1]) }));
    if (readonlyResponse) return readonlyResponse;
    return await handleAddLog(request, env, Number(addLogMatch[1]));
  }

  const archiveMatch = pathname.match(/^\/actions\/archive-student\/(\d+)$/);
  if (archiveMatch && request.method === "POST") {
    const readonlyResponse = ensureEditor(await getDashboardReturnPath(request, { selectedId: Number(archiveMatch[1]) }));
    if (readonlyResponse) return readonlyResponse;
    return await handleArchiveStudent(request, env, Number(archiveMatch[1]));
  }

  return new Response("Not found", { status: 404 });
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

  if (result.skipped) {
    const matchedManifestMessage = result.matchedManifestKey ? `: ${result.matchedManifestKey}` : "";
    console.log(`Automated backup skipped because exported data is unchanged${matchedManifestMessage}`);
    return;
  }

  console.log(`Automated backup completed: ${result.manifestKey}`);
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
