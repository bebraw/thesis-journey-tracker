import styles from "../.generated/styles.css";
import favicon from "./favicon.ico";
import {
  getSessionIdentity,
  isReadonlyUser,
  resolveAuthState,
  resolveSessionUser,
  revokeAuthUserSessions,
  SESSION_COOKIE,
} from "./auth";
import { runAutomatedBackup } from "./backup";
import type { Env, ScheduledControllerLike } from "./app-env";
import type { D1Database } from "./db-core";
import { rejectInvalidMutationOrigin } from "./http/origin";
import { RequestBodyTooLargeError } from "./http/request-body";
import { cssResponse, htmlResponse, iconResponse, javascriptResponse, redirect } from "./http/response";
import { applyBrowserSecurityHeaders } from "./http/security";
import { logError } from "./observability/error-logging";
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
  handleResetDashboardLaneSettings,
  handleSaveDashboardLaneSettings,
  handleSaveGoogleCalendarIcalSettings,
  handleSaveGoogleCalendarSettings,
  renderDataTools,
} from "./routes/data-tools";
import { getScheduleReturnPath, handleScheduleMeeting, renderSchedule } from "./routes/schedule";
import { validateRuntimeSecrets } from "./security/secrets";
import { APP_INTERACTION_SCRIPT } from "./view/app-script";
import { DASHBOARD_INTERACTION_SCRIPT } from "./view/dashboard/interaction-script";
import { renderStyleGuidePage } from "./views";

const D1_BOOKMARK_COOKIE = "thesis_d1_bookmark";
const EXPIRED_COOKIE_DATE = "Thu, 01 Jan 1970 00:00:00 GMT";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const httpsRedirect = redirectNonLocalHttpRequest(request);
    if (httpsRedirect) {
      return applyBrowserSecurityHeaders(httpsRedirect, request.url);
    }

    let response: Response;
    try {
      const originRejection = rejectInvalidMutationOrigin(request);
      if (originRejection) {
        response = originRejection;
      } else {
        const requestDatabase = createRequestD1Session(env.DB);
        const requestEnv: Env = requestDatabase ? { ...env, DB: requestDatabase } : env;
        response = await handleRequest(request, requestEnv);
      }
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        response = new Response("Request body too large", {
          status: 413,
          headers: { "cache-control": "no-store" },
        });
      } else {
        const incidentId = getIncidentId(request);
        logError("request.unhandled", error, requestErrorContext(request, incidentId));
        response = isLocalDevelopmentRequest(request)
          ? localInternalErrorResponse(error)
          : productionInternalErrorResponse(incidentId);
      }
    }
    return applyBrowserSecurityHeaders(retireLegacyD1Bookmark(response, request), request.url);
  },
  async scheduled(controller: ScheduledControllerLike, env: Env): Promise<void> {
    try {
      await handleScheduledBackup(controller, env);
    } catch (error) {
      logError("backup.scheduled_failed", error);
      throw error;
    }
  },
};

function redirectNonLocalHttpRequest(request: Request): Response | null {
  const url = new URL(request.url);
  if (url.protocol !== "http:" || isLocalDevelopmentHostname(url.hostname)) {
    return null;
  }

  url.protocol = "https:";
  return new Response(null, {
    status: 308,
    headers: {
      "Cache-Control": "no-store",
      Location: url.toString(),
    },
  });
}

function createRequestD1Session(db: D1Database | null | undefined): D1Database | null | undefined {
  if (!db || !hasD1SessionApi(db)) {
    return db;
  }

  return db.withSession("first-primary");
}

function retireLegacyD1Bookmark(response: Response, request: Request): Response {
  if (!readCookie(request.headers.get("cookie") || "", D1_BOOKMARK_COOKIE)) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.append("Set-Cookie", clearBookmarkCookie(request.url));
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function hasD1SessionApi(db: D1Database): db is globalThis.D1Database {
  return "withSession" in db && typeof db.withSession === "function";
}

function clearBookmarkCookie(requestUrl: string): string {
  const securePart = new URL(requestUrl).protocol === "https:" ? " Secure;" : "";
  return `${D1_BOOKMARK_COOKIE}=; HttpOnly;${securePart} Path=/; SameSite=Lax; Expires=${EXPIRED_COOKIE_DATE}; Max-Age=0`;
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

  if (pathname === "/app.js") {
    return javascriptResponse(APP_INTERACTION_SCRIPT);
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

  const securityConfigurationError = validateRuntimeSecrets(env);
  if (securityConfigurationError) {
    logError("configuration.security_invalid", securityConfigurationError);
    return new Response("Security configuration is invalid.", {
      status: 500,
      headers: { "cache-control": "no-store" },
    });
  }

  if (pathname === "/style-guide" && !showStyleGuide) {
    return new Response("Not found", { status: 404 });
  }

  const authState = await resolveAuthState(env);
  if (authState.error) {
    return new Response(authState.error, { status: 500 });
  }

  const sessionIdentity = await getSessionIdentity(request, env.SESSION_SECRET as string, SESSION_COOKIE);
  const sessionUser = resolveSessionUser(authState, sessionIdentity);

  if (pathname === "/login" && (request.method === "GET" || request.method === "POST")) {
    return await handleLoginRequest(request, env, authState, sessionUser);
  }

  if (pathname === "/logout" && request.method === "POST") {
    if (sessionUser) {
      await revokeAuthUserSessions(env.DB, sessionUser.id);
    }
    return handleLogout(request.url);
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
    return await renderAddStudent(env, url, sessionUser, showStyleGuide);
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

  if (pathname === "/actions/save-dashboard-lane-settings" && request.method === "POST") {
    const readonlyResponse = ensureEditor("/");
    if (readonlyResponse) return readonlyResponse;
    return await handleSaveDashboardLaneSettings(request, env);
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

  if (pathname === "/actions/reset-dashboard-lane-settings" && request.method === "POST") {
    const readonlyResponse = ensureEditor("/");
    if (readonlyResponse) return readonlyResponse;
    return await handleResetDashboardLaneSettings(env);
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
  return isLocalDevelopmentHostname(new URL(request.url).hostname);
}

function isLocalDevelopmentHostname(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase();
  return (
    normalizedHostname === "localhost" ||
    normalizedHostname.endsWith(".localhost") ||
    normalizedHostname === "127.0.0.1" ||
    normalizedHostname === "0.0.0.0" ||
    normalizedHostname === "::1" ||
    normalizedHostname === "[::1]"
  );
}

function localInternalErrorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : null;
  const body = [
    "Internal server error in local development.",
    "",
    message,
    ...(stack && stack !== message ? ["", stack] : []),
  ].join("\n");

  return new Response(body, {
    status: 500,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

function productionInternalErrorResponse(incidentId: string): Response {
  return new Response(`Internal server error\nReference: ${incidentId}`, {
    status: 500,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Incident-ID": incidentId,
    },
  });
}

function getIncidentId(request: Request): string {
  const rayId = request.headers.get("cf-ray") || "";
  return /^[A-Za-z0-9._:-]{1,128}$/.test(rayId) ? rayId : crypto.randomUUID();
}

function requestErrorContext(request: Request, incidentId: string) {
  return {
    incident_id: incidentId,
    method: request.method,
    path: new URL(request.url).pathname,
    ray_id: request.headers.get("cf-ray") || undefined,
  };
}
