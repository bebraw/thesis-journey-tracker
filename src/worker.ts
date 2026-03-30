import styles from "../.generated/styles.css";
import favicon from "./favicon.ico";
import { type AuthUser, isAccessRole, type SessionUser } from "./auth";
import { runAutomatedBackup } from "./backup";
import type { Env, ScheduledControllerLike } from "./app-env";
import { clearLoginAttempt, type D1Database, getLoginAttempt, listAuthUsers, type LoginAttempt, saveLoginAttempt, upsertAuthUser } from "./db";
import { hashPassword, verifyPassword } from "./password";
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
import {
  buildSessionCookie,
  clearSessionCookie,
  createSessionToken,
  cssResponse,
  getSessionUser,
  htmlResponse,
  iconResponse,
  javascriptResponse,
  redirect,
} from "./utils";
import { DASHBOARD_INTERACTION_SCRIPT } from "./view/dashboard/interaction-script";
import { renderLoginPage, renderStyleGuidePage } from "./views";

const SESSION_COOKIE = "thesis_session";
const D1_BOOKMARK_COOKIE = "thesis_d1_bookmark";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

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
    const headers = new Headers();
    headers.append(
      "Set-Cookie",
      clearSessionCookie(request.url, {
        cookieName: SESSION_COOKIE,
        ttlSeconds: SESSION_TTL_SECONDS,
      }),
    );
    headers.append("Set-Cookie", clearBookmarkCookie(request.url));
    return redirect("/login", headers);
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

  const archiveMatch = pathname.match(/^\/actions\/archive-student\/(\d+)$/);
  if (archiveMatch && request.method === "POST") {
    if (isReadonlyUser(sessionUser)) {
      return readonlyRedirect(await getDashboardReturnPath(request, { selectedId: Number(archiveMatch[1]) }));
    }
    return await handleArchiveStudent(request, env, Number(archiveMatch[1]));
  }

  const legacyDeleteMatch = pathname.match(/^\/actions\/delete-student\/(\d+)$/);
  if (legacyDeleteMatch && request.method === "POST") {
    if (isReadonlyUser(sessionUser)) {
      return readonlyRedirect(await getDashboardReturnPath(request, { selectedId: Number(legacyDeleteMatch[1]) }));
    }
    return await handleArchiveStudent(request, env, Number(legacyDeleteMatch[1]));
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
