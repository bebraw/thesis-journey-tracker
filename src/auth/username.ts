import type { D1Database } from "../db-core";
import type { SessionUser } from "./types";

export const MAX_USERNAME_CHARACTERS = 100;

export function parseUsername(value: unknown): string | null {
  if (typeof value !== "string" || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(value)) return null;
  const name = value.trim();
  return name && [...name].length <= MAX_USERNAME_CHARACTERS ? name : null;
}

export function normalizeLoginName(value: string): string {
  return value.toLocaleLowerCase();
}

// D1's NOCASE collation only folds ASCII. Use the same comparison as login,
// then guard the write with the directory we checked so concurrent renames and
// account creations cannot introduce a Unicode-equivalent login.
export const usernameDirectorySql = `(SELECT json_group_array(json_array(id, name))
  FROM (SELECT id, name FROM app_users ORDER BY id))`;

export function isUsernameAvailable(directory: string, name: string, ownId?: number): boolean {
  const names: [number, string][] = JSON.parse(directory);
  // Existing accounts may differ only in Unicode case. A rights-only change
  // can retain the account's exact name without introducing another collision.
  if (names.some(([id, current]) => id === ownId && current === name)) return true;
  const normalized = normalizeLoginName(name);
  return names.every(([id, other]) => id === ownId || normalizeLoginName(other) !== normalized);
}

export async function availableUsernameDirectory(db: D1Database, name: string, ownId?: number): Promise<string | null> {
  const row = await db.prepare(`SELECT ${usernameDirectorySql} AS directory`).first<{ directory: string }>();
  if (!row) return null;
  return isUsernameAvailable(row.directory, name, ownId) ? row.directory : null;
}

export async function renameOwnAccount(db: D1Database, user: SessionUser, originalName: string, name: string): Promise<number | null> {
  if (originalName !== user.name) return null;
  if (name === originalName) return user.sessionVersion;
  const directory = await availableUsernameDirectory(db, name, user.id);
  if (directory === null) return null;
  const result = await db
    .prepare(
      `UPDATE app_users SET name = ?1, session_version = session_version + 1
    WHERE id = ?2 AND session_version = ?3 AND disabled_at IS NULL AND name = ?4 COLLATE BINARY
      AND ${usernameDirectorySql} = ?5 RETURNING session_version`,
    )
    .bind(name, user.id, user.sessionVersion, originalName, directory)
    .run<{ session_version: number }>();
  return result.results?.[0]?.session_version ?? null;
}
