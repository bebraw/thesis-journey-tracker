import type { D1Database } from "../db-core";

export interface AppSecret {
  secretKey: string;
  encryptedValue: string;
  updatedAt: string;
}

interface AppSecretRow {
  secret_key: string;
  encrypted_value: string;
  updated_at: string;
}

export async function getAppSecret(db: D1Database, secretKey: string): Promise<AppSecret | null> {
  const row = await db
    .prepare(
      `SELECT secret_key, encrypted_value, updated_at
       FROM app_secrets
       WHERE secret_key = ?`,
    )
    .bind(secretKey)
    .first<AppSecretRow>();

  if (!row) {
    return null;
  }

  return {
    secretKey: row.secret_key,
    encryptedValue: row.encrypted_value,
    updatedAt: row.updated_at,
  };
}

export async function upsertAppSecret(db: D1Database, secretKey: string, encryptedValue: string, updatedAt: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO app_secrets (secret_key, encrypted_value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(secret_key) DO UPDATE SET
         encrypted_value = excluded.encrypted_value,
         updated_at = excluded.updated_at`,
    )
    .bind(secretKey, encryptedValue, updatedAt)
    .run();
}

export async function deleteAppSecret(db: D1Database, secretKey: string): Promise<void> {
  await db.prepare("DELETE FROM app_secrets WHERE secret_key = ?").bind(secretKey).run();
}
