import { deleteAppSecret, getAppSecret, upsertAppSecret } from "./store";
import { decryptText, encryptText } from "../encryption";
import { normalizeString } from "../forms/normalize";
import { resolveGoogleCalendarConfig } from "./google";
import { resolveScheduleTimeZone } from "./scheduling";
import type { Env } from "../app-env";

const GOOGLE_CALENDAR_SECRET_KEY = "google_calendar_config";

export interface StoredGoogleCalendarSettings {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  calendarId?: string;
  iCalUrl?: string;
  timeZone?: string;
}

export interface StoredGoogleCalendarSettingsRecord {
  settings: StoredGoogleCalendarSettings;
  updatedAt: string;
}

export type GoogleCalendarSource =
  | {
      mode: "api";
      label: "Google Calendar";
      config: NonNullable<ReturnType<typeof resolveGoogleCalendarConfig>>;
      timeZone: string;
    }
  | {
      mode: "ical";
      label: "Google Calendar iCal";
      iCalUrl: string;
      timeZone: string;
    };

export async function resolveGoogleCalendarSourceForApp(env: Env): Promise<GoogleCalendarSource | null> {
  const storedSettings = await getStoredGoogleCalendarSettings(env);
  if (!storedSettings) {
    return null;
  }

  const apiConfig = resolveGoogleCalendarConfig(storedSettings.settings);
  if (apiConfig) {
    return {
      mode: "api",
      label: "Google Calendar",
      config: apiConfig,
      timeZone: apiConfig.timeZone,
    };
  }

  const iCalUrl = normalizeString(storedSettings.settings.iCalUrl);
  if (!iCalUrl) {
    return null;
  }

  return {
    mode: "ical",
    label: "Google Calendar iCal",
    iCalUrl,
    timeZone: resolveScheduleTimeZone(storedSettings.settings.timeZone),
  };
}

export async function getStoredGoogleCalendarSettings(env: Env): Promise<StoredGoogleCalendarSettingsRecord | null> {
  const storedSecret = await getAppSecret(env.DB, GOOGLE_CALENDAR_SECRET_KEY);
  if (!storedSecret) {
    return null;
  }

  try {
    const decryptedPayload = await decryptText(storedSecret.encryptedValue, resolveAppEncryptionSecret(env));
    return {
      settings: JSON.parse(decryptedPayload) as StoredGoogleCalendarSettings,
      updatedAt: storedSecret.updatedAt,
    };
  } catch (error) {
    console.error("Failed to load stored Google Calendar settings", error);
    return null;
  }
}

export async function getStoredGoogleCalendarSettingsPayload(env: Env): Promise<StoredGoogleCalendarSettings> {
  return (await getStoredGoogleCalendarSettings(env))?.settings || {};
}

export async function saveStoredGoogleCalendarSettings(env: Env, settings: StoredGoogleCalendarSettings, updatedAt: string): Promise<void> {
  await persistOrClearGoogleCalendarSettings(env, settings, updatedAt);
}

export async function clearStoredGoogleCalendarSettings(env: Env): Promise<void> {
  await deleteAppSecret(env.DB, GOOGLE_CALENDAR_SECRET_KEY);
}

function resolveAppEncryptionSecret(env: Env): string {
  return env.APP_ENCRYPTION_SECRET || env.SESSION_SECRET || "";
}

async function persistOrClearGoogleCalendarSettings(env: Env, settings: StoredGoogleCalendarSettings, updatedAt: string): Promise<void> {
  if (!hasAnyStoredGoogleCalendarSettings(settings)) {
    await clearStoredGoogleCalendarSettings(env);
    return;
  }

  const encryptedValue = await encryptText(
    JSON.stringify({
      ...settings,
      clientId: settings.clientId || undefined,
      clientSecret: settings.clientSecret || undefined,
      refreshToken: settings.refreshToken || undefined,
      calendarId: settings.calendarId || undefined,
      iCalUrl: settings.iCalUrl || undefined,
      timeZone: settings.timeZone || undefined,
    }),
    resolveAppEncryptionSecret(env),
  );

  await upsertAppSecret(env.DB, GOOGLE_CALENDAR_SECRET_KEY, encryptedValue, updatedAt);
}

function hasAnyStoredGoogleCalendarSettings(settings: StoredGoogleCalendarSettings): boolean {
  return Boolean(
    settings.clientId ||
      settings.clientSecret ||
      settings.refreshToken ||
      settings.calendarId ||
      settings.iCalUrl ||
      settings.timeZone,
  );
}
