import type { R2BucketLike } from "./backup";
import type { D1Database } from "./db";

export interface Env {
  DB: D1Database;
  BACKUP_BUCKET?: R2BucketLike;
  BACKUP_PREFIX?: string;
  APP_ENCRYPTION_SECRET?: string;
  APP_PASSWORD?: string;
  APP_USERS_JSON?: string;
  REPLACE_IMPORT_ENABLED?: string;
  SESSION_SECRET?: string;
}

export interface ScheduledControllerLike {
  cron: string;
}
