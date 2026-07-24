import type { AccessRole } from "./types";
import type { D1Database } from "../db-core";
import { parseDbNumber, requireD1MutationSuccess, requireD1ReturnedId, requireD1ReturnedRow } from "../db-core";

export interface StoredAuthUser {
  id: number;
  name: string;
  passwordHash: string;
  role: AccessRole;
  sessionVersion: number;
}

export interface LoginAttempt {
  attemptKey: string;
  failureCount: number;
  firstFailedAt: string;
  lastFailedAt: string;
  lockedUntil: string | null;
}

export interface UpsertAuthUserInput {
  name: string;
  passwordHash: string;
  role: AccessRole;
}

interface AuthUserRow {
  id: number | string;
  name: string;
  password_hash: string;
  role: AccessRole;
  session_version: number | string;
}

interface ReturnedIdRow {
  id: number | string;
}

interface ReturnedAttemptKeyRow {
  attempt_key: string;
}

interface LoginAttemptRow {
  attempt_key: string;
  failure_count: number | string;
  first_failed_at: string;
  last_failed_at: string;
  locked_until: string | null;
}

export async function listAuthUsers(db: D1Database): Promise<StoredAuthUser[]> {
  const rows = await db
    .prepare(
      `SELECT id, name, password_hash, role, session_version
       FROM app_users
       ORDER BY name ASC`,
    )
    .all<AuthUserRow>();

  return rows.results.map((row) => ({
    id: parseDbNumber(row.id),
    name: row.name,
    passwordHash: row.password_hash,
    role: row.role,
    sessionVersion: parseDbNumber(row.session_version),
  }));
}

export async function upsertAuthUser(db: D1Database, input: UpsertAuthUserInput): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO app_users (name, password_hash, role)
       VALUES (?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET
         password_hash = excluded.password_hash,
         role = excluded.role,
         session_version = app_users.session_version + 1
       RETURNING id`,
    )
    .bind(input.name, input.passwordHash, input.role)
    .run<ReturnedIdRow>();

  return requireD1ReturnedId(result, "Saving auth user");
}

export async function revokeAuthUserSessions(db: D1Database, userId: number): Promise<void> {
  const result = await db
    .prepare(
      `UPDATE app_users
       SET session_version = session_version + 1
       WHERE id = ?
       RETURNING id`,
    )
    .bind(userId)
    .run<ReturnedIdRow>();

  requireD1ReturnedId(result, "Revoking auth user sessions");
}

export async function getLoginAttempt(db: D1Database, attemptKey: string): Promise<LoginAttempt | null> {
  const row = await db
    .prepare(
      `SELECT attempt_key, failure_count, first_failed_at, last_failed_at, locked_until
       FROM login_attempts
       WHERE attempt_key = ?`,
    )
    .bind(attemptKey)
    .first<LoginAttemptRow>();

  if (!row) {
    return null;
  }

  return mapLoginAttemptRow(row);
}

export async function recordLoginFailure(
  db: D1Database,
  attemptKey: string,
  options: {
    now: string;
    failureWindowStart: string;
    maxFailures: number;
    lockedUntil: string;
  },
): Promise<LoginAttempt> {
  const [attempt] = await recordLoginFailures(db, [{ attemptKey, ...options }]);
  if (!attempt) {
    throw new Error("Failed to read recorded login failure.");
  }
  return attempt;
}

export async function recordLoginFailures(
  db: D1Database,
  failures: Array<{
    attemptKey: string;
    now: string;
    failureWindowStart: string;
    maxFailures: number;
    lockedUntil: string;
  }>,
): Promise<LoginAttempt[]> {
  const statements = failures.map((failure) =>
    db
      .prepare(
        `INSERT INTO login_attempts (attempt_key, failure_count, first_failed_at, last_failed_at, locked_until)
         VALUES (?, 1, ?, ?, NULL)
         ON CONFLICT(attempt_key) DO UPDATE SET
           failure_count = CASE
             WHEN login_attempts.last_failed_at >= ? THEN login_attempts.failure_count + 1
             ELSE 1
           END,
           first_failed_at = CASE
             WHEN login_attempts.last_failed_at >= ? THEN login_attempts.first_failed_at
             ELSE ?
           END,
           last_failed_at = ?,
           locked_until = CASE
             WHEN login_attempts.last_failed_at >= ? AND login_attempts.failure_count + 1 >= ? THEN ?
             ELSE NULL
           END
         RETURNING attempt_key`,
      )
      .bind(
        failure.attemptKey,
        failure.now,
        failure.now,
        failure.failureWindowStart,
        failure.failureWindowStart,
        failure.now,
        failure.now,
        failure.failureWindowStart,
        failure.maxFailures,
        failure.lockedUntil,
      ),
  );
  const results = await db.batch<ReturnedAttemptKeyRow>(statements);
  if (results.length !== failures.length) {
    throw new Error("Recording login failures returned an incomplete database batch.");
  }
  for (const result of results) {
    requireD1ReturnedRow(result, "Recording login failure");
  }

  const attempts = await Promise.all(failures.map((failure) => getLoginAttempt(db, failure.attemptKey)));
  if (attempts.some((attempt) => !attempt)) {
    throw new Error("Failed to read recorded login failures.");
  }
  return attempts as LoginAttempt[];
}

export async function clearLoginAttempt(db: D1Database, attemptKey: string): Promise<void> {
  const result = await db.prepare("DELETE FROM login_attempts WHERE attempt_key = ?").bind(attemptKey).run();
  requireD1MutationSuccess(result, "Clearing login attempt");
}

export async function pruneExpiredLoginAttempts(
  db: D1Database,
  options: { lastFailureBefore: string; now: string; limit: number },
): Promise<void> {
  const result = await db
    .prepare(
      `DELETE FROM login_attempts
       WHERE attempt_key IN (
         SELECT attempt_key
         FROM login_attempts
         WHERE last_failed_at < ?
           AND (locked_until IS NULL OR locked_until < ?)
         ORDER BY last_failed_at ASC
         LIMIT ?
       )`,
    )
    .bind(options.lastFailureBefore, options.now, options.limit)
    .run();
  requireD1MutationSuccess(result, "Pruning login attempts");
}

function mapLoginAttemptRow(row: LoginAttemptRow): LoginAttempt {
  return {
    attemptKey: row.attempt_key,
    failureCount: parseDbNumber(row.failure_count),
    firstFailedAt: row.first_failed_at,
    lastFailedAt: row.last_failed_at,
    lockedUntil: row.locked_until,
  };
}
