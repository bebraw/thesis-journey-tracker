import { type AuthUser, isAccessRole, type SessionUser } from "../auth";
import type { Env } from "../app-env";
import { clearLoginAttempt, getLoginAttempt, listAuthUsers, type LoginAttempt, saveLoginAttempt, upsertAuthUser } from "../db";
import { hashPassword, verifyPassword } from "../password";
import { buildSessionCookie, clearSessionCookie, createSessionToken, htmlResponse, redirect } from "../utils";
import { renderLoginPage } from "../views";

export const SESSION_COOKIE = "thesis_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

export async function handleLoginRequest(request: Request, env: Env, authState: AuthState, sessionUser: SessionUser | null): Promise<Response> {
  if (request.method === "GET") {
    if (sessionUser) {
      return redirect("/");
    }
    const url = new URL(request.url);
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
  const token = await createSessionToken(env.SESSION_SECRET || "", SESSION_TTL_SECONDS, {
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

export function handleLogout(requestUrl: string, clearBookmarkCookie: string): Response {
  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    clearSessionCookie(requestUrl, {
      cookieName: SESSION_COOKIE,
      ttlSeconds: SESSION_TTL_SECONDS,
    }),
  );
  headers.append("Set-Cookie", clearBookmarkCookie);
  return redirect("/login", headers);
}

export async function resolveAuthState(env: Env): Promise<AuthState> {
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

export function isReadonlyUser(user: SessionUser): boolean {
  return user.role === "readonly";
}

export function readonlyRedirect(pathname: string): Response {
  const separator = pathname.includes("?") ? "&" : "?";
  return redirect(`${pathname}${separator}error=Read-only+access`);
}

interface AuthState {
  users: Awaited<ReturnType<typeof listAuthUsers>>;
  error?: string;
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
  const previousLastFailedAt = previousAttempt ? Date.parse(previousAttempt.lastFailedAt) : Number.NaN;
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
