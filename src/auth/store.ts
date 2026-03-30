import type { AccessRole } from "./types";
import type { D1Database } from "../db-core";
import { parseDbNumber } from "../db-core";

export interface StoredAuthUser {
  id: number;
  name: string;
  passwordHash: string;
  role: AccessRole;
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
      `SELECT id, name, password_hash, role
       FROM app_users
       ORDER BY name ASC`,
    )
    .all<AuthUserRow>();

  return rows.results.map((row) => ({
    id: parseDbNumber(row.id),
    name: row.name,
    passwordHash: row.password_hash,
    role: row.role,
  }));
}

export async function upsertAuthUser(db: D1Database, input: UpsertAuthUserInput): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO app_users (name, password_hash, role)
       VALUES (?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET
         password_hash = excluded.password_hash,
         role = excluded.role`,
    )
    .bind(input.name, input.passwordHash, input.role)
    .run();

  if (!result.success) {
    throw new Error("Failed to save auth user.");
  }

  const row = await db
    .prepare(
      `SELECT id, name, password_hash, role
       FROM app_users
       WHERE name = ? COLLATE NOCASE`,
    )
    .bind(input.name)
    .first<AuthUserRow>();

  if (!row) {
    throw new Error("Failed to read saved auth user.");
  }

  return parseDbNumber(row.id);
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

  return {
    attemptKey: row.attempt_key,
    failureCount: parseDbNumber(row.failure_count),
    firstFailedAt: row.first_failed_at,
    lastFailedAt: row.last_failed_at,
    lockedUntil: row.locked_until,
  };
}

export async function saveLoginAttempt(db: D1Database, attempt: LoginAttempt): Promise<void> {
  await db
    .prepare(
      `INSERT INTO login_attempts (attempt_key, failure_count, first_failed_at, last_failed_at, locked_until)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(attempt_key) DO UPDATE SET
         failure_count = excluded.failure_count,
         first_failed_at = excluded.first_failed_at,
         last_failed_at = excluded.last_failed_at,
         locked_until = excluded.locked_until`,
    )
    .bind(attempt.attemptKey, attempt.failureCount, attempt.firstFailedAt, attempt.lastFailedAt, attempt.lockedUntil)
    .run();
}

export async function clearLoginAttempt(db: D1Database, attemptKey: string): Promise<void> {
  await db.prepare("DELETE FROM login_attempts WHERE attempt_key = ?").bind(attemptKey).run();
}
