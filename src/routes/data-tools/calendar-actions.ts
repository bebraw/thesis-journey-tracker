import type { Env } from "../../app-env";
import {
  clearStoredGoogleCalendarSettings,
  getStoredGoogleCalendarSettingsPayload,
  saveStoredGoogleCalendarSettings,
  normalizeGoogleCalendarIcalUrl,
  type StoredGoogleCalendarSettings,
} from "../../calendar";
import { normalizeString } from "../../forms/normalize";
import { readFormData } from "../../http/request-body";
import { redirect } from "../../http/response";
import { logError } from "../../observability/error-logging";

export async function handleSaveGoogleCalendarSettings(request: Request, env: Env): Promise<Response> {
  const formData = await readFormData(request);
  const clientId = normalizeString(formData.get("clientId"));
  const submittedClientSecret = normalizeString(formData.get("clientSecret"));
  const submittedRefreshToken = normalizeString(formData.get("refreshToken"));
  const calendarId = normalizeString(formData.get("calendarId"));
  const timeZone = normalizeString(formData.get("timeZone"));
  const currentSettings = await getStoredGoogleCalendarSettingsPayload(env);
  const clientSecret = submittedClientSecret || currentSettings.clientSecret;
  const refreshToken = submittedRefreshToken || currentSettings.refreshToken;

  if (!clientId || !clientSecret || !refreshToken || !calendarId) {
    return redirect("/data-tools?error=All+Google+Calendar+credential+fields+except+timezone+are+required");
  }

  try {
    await saveStoredGoogleCalendarSettings(
      env,
      {
        ...currentSettings,
        clientId,
        clientSecret,
        refreshToken,
        calendarId,
        timeZone: timeZone || undefined,
      },
      new Date().toISOString(),
    );
  } catch (error) {
    logError("calendar.oauth_settings_save_failed", error);
    return redirect("/data-tools?error=Failed+to+save+encrypted+Google+Calendar+settings");
  }

  return redirect("/data-tools?notice=Encrypted+Google+Calendar+settings+saved");
}

export async function handleSaveGoogleCalendarIcalSettings(request: Request, env: Env): Promise<Response> {
  const formData = await readFormData(request);
  const rawSubmittedIcalUrl = normalizeString(formData.get("iCalUrl"));
  const submittedIcalUrl = rawSubmittedIcalUrl ? normalizeGoogleCalendarIcalUrl(rawSubmittedIcalUrl) : null;
  const timeZone = normalizeString(formData.get("timeZone"));
  const currentSettings = await getStoredGoogleCalendarSettingsPayload(env);
  if (rawSubmittedIcalUrl && !submittedIcalUrl) {
    return redirect("/data-tools?error=Enter+a+valid+Google+Calendar+Secret+address+in+iCal+format");
  }
  const iCalUrl = submittedIcalUrl || currentSettings.iCalUrl;

  if (!iCalUrl) {
    return redirect("/data-tools?error=Google+Calendar+iCal+URL+is+required");
  }

  try {
    await saveStoredGoogleCalendarSettings(
      env,
      {
        ...currentSettings,
        iCalUrl,
        timeZone: timeZone || undefined,
      },
      new Date().toISOString(),
    );
  } catch (error) {
    logError("calendar.ical_settings_save_failed", error);
    return redirect("/data-tools?error=Failed+to+save+encrypted+Google+Calendar+iCal+settings");
  }

  return redirect("/data-tools?notice=Encrypted+Google+Calendar+iCal+settings+saved");
}

export async function handleClearGoogleCalendarOAuthSettings(env: Env): Promise<Response> {
  try {
    const currentSettings = await getStoredGoogleCalendarSettingsPayload(env);
    const nextSettings: StoredGoogleCalendarSettings = {
      ...currentSettings,
      clientId: undefined,
      clientSecret: undefined,
      refreshToken: undefined,
      calendarId: undefined,
    };
    await saveStoredGoogleCalendarSettings(env, nextSettings, new Date().toISOString());
  } catch (error) {
    logError("calendar.oauth_settings_clear_failed", error);
    return redirect("/data-tools?error=Failed+to+clear+stored+Google+Calendar+credentials");
  }

  return redirect("/data-tools?notice=Stored+Google+Calendar+credentials+cleared");
}

export async function handleClearGoogleCalendarIcalSettings(env: Env): Promise<Response> {
  try {
    const currentSettings = await getStoredGoogleCalendarSettingsPayload(env);
    const nextSettings: StoredGoogleCalendarSettings = {
      ...currentSettings,
      iCalUrl: undefined,
    };
    await saveStoredGoogleCalendarSettings(env, nextSettings, new Date().toISOString());
  } catch (error) {
    logError("calendar.ical_settings_clear_failed", error);
    return redirect("/data-tools?error=Failed+to+clear+stored+Google+Calendar+iCal+settings");
  }

  return redirect("/data-tools?notice=Stored+Google+Calendar+iCal+settings+cleared");
}

export async function handleClearGoogleCalendarSettings(env: Env): Promise<Response> {
  try {
    await clearStoredGoogleCalendarSettings(env);
  } catch (error) {
    logError("calendar.settings_clear_failed", error);
    return redirect("/data-tools?error=Failed+to+clear+stored+Google+Calendar+settings");
  }

  return redirect("/data-tools?notice=Stored+Google+Calendar+settings+cleared");
}
