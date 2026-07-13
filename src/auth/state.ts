import type { Env } from "../app-env";
import {
  clearLoginAttempt,
  getLoginAttempt,
  listAuthUsers,
  pruneExpiredLoginAttempts,
  recordLoginFailure,
  type LoginAttempt,
  type StoredAuthUser,
} from "./store";
import { verifyPassword } from "./password";
import { type SessionUser } from "./types";

const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const ACCOUNT_LOGIN_MAX_FAILURES = 5;
const CLIENT_LOGIN_MAX_FAILURES = 20;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPT_RETENTION_MS = 24 * 60 * 60 * 1000;
const LOGIN_ATTEMPT_PRUNE_LIMIT = 25;
const DUMMY_PASSWORD_HASH =
  "pbkdf2_sha256$100000$AAAAAAAAAAAAAAAAAAAAAA==$hdWn2Z2YPji1MoW1r05A3cRvbd46WyUHU6YxFtRxMXU=";

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

  await pruneExpiredLoginAttempts(env.DB, {
    lastFailureBefore: new Date(now.getTime() - LOGIN_ATTEMPT_RETENTION_MS).toISOString(),
    now: now.toISOString(),
    limit: LOGIN_ATTEMPT_PRUNE_LIMIT,
  });

  const loginAttemptBuckets = await buildLoginAttemptBuckets(request, env.SESSION_SECRET || "", candidateUser);
  const currentAttempts = await Promise.all(
    loginAttemptBuckets.map(async (bucket) => ({
      bucket,
      attempt: await getLoginAttempt(env.DB, bucket.attemptKey),
    })),
  );

  if (currentAttempts.some(({ attempt }) => isLoginAttemptLocked(attempt, now))) {
    return { status: "rate_limited" };
  }

  let passwordVerified = false;
  try {
    passwordVerified = await verifyPassword(password, candidateUser?.passwordHash || DUMMY_PASSWORD_HASH);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Stored password hash uses")) {
      console.error("Password hash requires reset", { user: candidateUser?.name || enteredName, message });
      return { status: "password_reset" };
    }
    throw error;
  }

  if (!candidateUser || !passwordVerified) {
    const nextAttempts = await Promise.all(
      loginAttemptBuckets.map((bucket) =>
        recordLoginFailure(env.DB, bucket.attemptKey, {
          now: now.toISOString(),
          failureWindowStart: new Date(now.getTime() - LOGIN_FAILURE_WINDOW_MS).toISOString(),
          maxFailures: bucket.maxFailures,
          lockedUntil: new Date(now.getTime() + LOGIN_LOCKOUT_MS).toISOString(),
        }),
      ),
    );
    return {
      status: nextAttempts.some((attempt) => isLoginAttemptLocked(attempt, now)) ? "rate_limited" : "invalid",
    };
  }

  const accountBucket = loginAttemptBuckets.find((bucket) => bucket.kind === "account");
  if (accountBucket) {
    await clearLoginAttempt(env.DB, accountBucket.attemptKey);
  }
  return {
    status: "authenticated",
    user: {
      name: candidateUser.name,
      role: candidateUser.role,
    },
  };
}

type LoginVerificationResult = { status: "authenticated"; user: SessionUser } | { status: "invalid" | "password_reset" | "rate_limited" };

interface LoginAttemptBucket {
  kind: "account" | "client";
  attemptKey: string;
  maxFailures: number;
}

async function buildLoginAttemptBuckets(
  request: Request,
  sessionSecret: string,
  candidateUser: StoredAuthUser | null,
): Promise<LoginAttemptBucket[]> {
  const clientSource = readTrustedCloudflareClientIp(request) || "untrusted-direct-client";
  const clientDigest = await hmacClientSource(sessionSecret, clientSource);
  const buckets: LoginAttemptBucket[] = [
    {
      kind: "client",
      attemptKey: `client:${clientDigest}`,
      maxFailures: CLIENT_LOGIN_MAX_FAILURES,
    },
  ];
  if (candidateUser) {
    buckets.unshift({
      kind: "account",
      attemptKey: `account:${candidateUser.id}`,
      maxFailures: ACCOUNT_LOGIN_MAX_FAILURES,
    });
  }
  return buckets;
}

function readTrustedCloudflareClientIp(request: Request): string | null {
  const cloudflareMetadata = (request as Request & { cf?: unknown }).cf;
  if (!cloudflareMetadata) {
    return null;
  }

  return normalizeIpAddress(request.headers.get("cf-connecting-ip"));
}

function normalizeIpAddress(value: string | null): string | null {
  const normalized = (value || "").trim();
  if (!normalized || normalized.length > 64 || !/^[0-9a-f:.]+$/i.test(normalized)) {
    return null;
  }
  return normalized.toLocaleLowerCase();
}

async function hmacClientSource(secret: string, source: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(`login-client:${source}`));
  return bytesToBase64Url(new Uint8Array(digest));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function isLoginAttemptLocked(attempt: LoginAttempt | null, now: Date): boolean {
  if (!attempt?.lockedUntil) {
    return false;
  }

  const lockedUntilTime = Date.parse(attempt.lockedUntil);
  return Number.isFinite(lockedUntilTime) && lockedUntilTime > now.getTime();
}
