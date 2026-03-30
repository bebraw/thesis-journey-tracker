import type { Env } from "../app-env";
import { clearLoginAttempt, getLoginAttempt, listAuthUsers, saveLoginAttempt, type LoginAttempt } from "./store";
import { verifyPassword } from "./password";
import { type SessionUser } from "./types";

const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

export interface AuthState {
  users: Awaited<ReturnType<typeof listAuthUsers>>;
  error?: string;
}

export function isReadonlyUser(user: SessionUser): boolean {
  return user.role === "readonly";
}

export async function resolveAuthState(env: Env): Promise<AuthState> {
  try {
    const users = await listAuthUsers(env.DB);
    if (users.length > 0) {
      return { users };
    }
    return {
      users: [],
      error: "No auth users found in the database. Create at least one account and run the latest D1 migrations.",
    };
  } catch {
    return {
      users: [],
      error: "Auth user storage is unavailable. Run the latest D1 migrations before starting the app.",
    };
  }
}

export async function verifyLoginCredentials(
  env: Env,
  request: Request,
  authState: AuthState,
  enteredName: string,
  password: string,
): Promise<LoginVerificationResult> {
  const now = new Date();
  const candidateUser =
    authState.users.length === 1 && !enteredName
      ? authState.users[0] || null
      : authState.users.find((user) => user.name.toLocaleLowerCase() === enteredName.toLocaleLowerCase()) || null;
  const loginAttemptKey = buildLoginAttemptKey(request, enteredName, candidateUser?.name || null);
  const currentAttempt = await getLoginAttempt(env.DB, loginAttemptKey);

  if (isLoginAttemptLocked(currentAttempt, now)) {
    return { status: "rate_limited" };
  }

  let passwordVerified = false;
  try {
    passwordVerified = candidateUser ? await verifyPassword(password, candidateUser.passwordHash) : false;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Stored password hash uses")) {
      console.error("Password hash requires reset", { user: candidateUser?.name || enteredName, message });
      return { status: "password_reset" };
    }
    throw error;
  }

  if (!candidateUser || !passwordVerified) {
    const nextAttempt = buildFailedLoginAttempt(currentAttempt, loginAttemptKey, now);
    await saveLoginAttempt(env.DB, nextAttempt);
    return {
      status: nextAttempt.lockedUntil ? "rate_limited" : "invalid",
    };
  }

  await clearLoginAttempt(env.DB, loginAttemptKey);
  return {
    status: "authenticated",
    user: {
      name: candidateUser.name,
      role: candidateUser.role,
    },
  };
}

type LoginVerificationResult =
  | { status: "authenticated"; user: SessionUser }
  | { status: "invalid" | "password_reset" | "rate_limited" };

function buildLoginAttemptKey(request: Request, enteredName: string, resolvedUserName: string | null): string {
  const ipAddress = readClientIpAddress(request);
  const loginName = normalizeLoginAttemptName(resolvedUserName || enteredName);
  return `ip:${ipAddress}|user:${loginName}`;
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

function normalizeLoginAttemptName(value: string | null | undefined): string {
  const normalized = (value || "").trim().toLocaleLowerCase();
  return normalized || "anonymous";
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
