import type { Env } from "../app-env";
import {
  clearLoginAttempt,
  getLoginAttempt,
  listAuthUsers,
  pruneExpiredLoginAttempts,
  recordLoginFailures,
  type LoginAttempt,
  type StoredAuthUser,
} from "./store";
import { inspectPasswordHash, verifyPassword } from "./password";
import { type SessionIdentity, type SessionUser } from "./types";

const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const ACCOUNT_LOGIN_MAX_FAILURES = 5;
const CLIENT_LOGIN_MAX_FAILURES = 20;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPT_RETENTION_MS = 24 * 60 * 60 * 1000;
const LOGIN_ATTEMPT_PRUNE_LIMIT = 25;
const MAX_LOGIN_NAME_CHARACTERS = 100;
const MAX_LOGIN_PASSWORD_BYTES = 1_024;
const DUMMY_PASSWORD_HASH =
  "pbkdf2_sha256$100000$AAAAAAAAAAAAAAAAAAAAAA==$hdWn2Z2YPji1MoW1r05A3cRvbd46WyUHU6YxFtRxMXU=";

export interface AuthState {
  users: Awaited<ReturnType<typeof listAuthUsers>>;
  error?: string;
}

export function isReadonlyUser(user: SessionUser): boolean {
  return user.role === "readonly";
}

export function resolveSessionUser(authState: AuthState, identity: SessionIdentity | null): SessionUser | null {
  if (!identity) {
    return null;
  }
  const storedUser = authState.users.find((user) => user.id === identity.userId);
  if (!storedUser || storedUser.sessionVersion !== identity.sessionVersion) {
    return null;
  }
  return {
    id: storedUser.id,
    name: storedUser.name,
    role: storedUser.role,
    sessionVersion: storedUser.sessionVersion,
  };
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
  const normalizedEnteredName = normalizeLoginName(enteredName);
  const nameWithinLimits = [...enteredName].length <= MAX_LOGIN_NAME_CHARACTERS;
  const passwordWithinLimits = new TextEncoder().encode(password).byteLength <= MAX_LOGIN_PASSWORD_BYTES;
  const candidateUser = !nameWithinLimits
    ? null
    : authState.users.length === 1 && !enteredName
      ? authState.users[0] || null
      : authState.users.find((user) => normalizeLoginName(user.name) === normalizedEnteredName) || null;

  await pruneExpiredLoginAttempts(env.DB, {
    lastFailureBefore: new Date(now.getTime() - LOGIN_ATTEMPT_RETENTION_MS).toISOString(),
    now: now.toISOString(),
    limit: LOGIN_ATTEMPT_PRUNE_LIMIT,
  });

  const loginAttemptBuckets = await buildLoginAttemptBuckets(
    request,
    env.SESSION_SECRET || "",
    candidateUser,
    normalizedEnteredName,
    nameWithinLimits,
  );
  const currentAttempts = await Promise.all(
    loginAttemptBuckets.map(async (bucket) => ({
      bucket,
      attempt: await getLoginAttempt(env.DB, bucket.attemptKey),
    })),
  );

  const passwordHashInspection = candidateUser ? inspectPasswordHash(candidateUser.passwordHash) : null;
  const verifierHash = passwordHashInspection?.status === "current" ? candidateUser?.passwordHash : DUMMY_PASSWORD_HASH;
  const passwordVerified = await verifyPassword(passwordWithinLimits ? password : "", verifierHash || DUMMY_PASSWORD_HASH);
  const credentialsValid = Boolean(
    candidateUser && passwordWithinLimits && passwordHashInspection?.status === "current" && passwordVerified,
  );

  if (!credentialsValid) {
    if (currentAttempts.some(({ attempt }) => isLoginAttemptLocked(attempt, now))) {
      return { status: "rate_limited" };
    }
    const accountAttempt = currentAttempts.find(({ bucket }) => bucket.kind === "account")?.attempt;
    if (!accountAttempt && candidateUser && passwordHashInspection?.status === "upgrade_required") {
      console.error("Password hash requires reset", {
        userId: candidateUser.id,
        storedIterations: passwordHashInspection.iterations,
      });
    }

    const nextAttempts = await recordLoginFailures(
      env.DB,
      loginAttemptBuckets.map((bucket) => ({
        attemptKey: bucket.attemptKey,
        now: now.toISOString(),
        failureWindowStart: new Date(now.getTime() - LOGIN_FAILURE_WINDOW_MS).toISOString(),
        maxFailures: bucket.maxFailures,
        lockedUntil: new Date(now.getTime() + LOGIN_LOCKOUT_MS).toISOString(),
      })),
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
      id: candidateUser!.id,
      name: candidateUser!.name,
      role: candidateUser!.role,
      sessionVersion: candidateUser!.sessionVersion,
    },
  };
}

type LoginVerificationResult = { status: "authenticated"; user: SessionUser } | { status: "invalid" | "rate_limited" };

interface LoginAttemptBucket {
  kind: "account" | "client";
  attemptKey: string;
  maxFailures: number;
}

async function buildLoginAttemptBuckets(
  request: Request,
  sessionSecret: string,
  candidateUser: StoredAuthUser | null,
  normalizedEnteredName: string,
  nameWithinLimits: boolean,
): Promise<LoginAttemptBucket[]> {
  const accountSource = candidateUser
    ? `user-id:${candidateUser.id}`
    : nameWithinLimits
      ? `unknown-name:${normalizedEnteredName}`
      : "over-limit-name";
  const clientSource = readTrustedCloudflareClientIp(request) || "untrusted-direct-client";
  const [accountDigest, clientDigest] = await Promise.all([
    hmacLoginSource(sessionSecret, "account", accountSource),
    hmacLoginSource(sessionSecret, "client", clientSource),
  ]);
  return [
    {
      kind: "account",
      attemptKey: `account:${accountDigest}`,
      maxFailures: ACCOUNT_LOGIN_MAX_FAILURES,
    },
    {
      kind: "client",
      attemptKey: `client:${clientDigest}`,
      maxFailures: CLIENT_LOGIN_MAX_FAILURES,
    },
  ];
}

function normalizeLoginName(value: string): string {
  return value.toLocaleLowerCase();
}

/*
 * Login attempt keys are deliberately opaque. This keeps account names, IDs,
 * and trusted client addresses out of D1 while preserving stable buckets.
 */
async function hmacLoginSource(secret: string, kind: "account" | "client", source: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(`login-${kind}:${source}`));
  return bytesToBase64Url(new Uint8Array(digest));
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
