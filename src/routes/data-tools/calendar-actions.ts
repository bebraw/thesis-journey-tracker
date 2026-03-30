import type { Env } from "../../app-env";
import {
  clearStoredGoogleCalendarSettings,
  getStoredGoogleCalendarSettingsPayload,
  saveStoredGoogleCalendarSettings,
  type StoredGoogleCalendarSettings,
} from "../../calendar";
import { normalizeString } from "../../forms/normalize";
import { redirect } from "../../http/response";

export async function handleSaveGoogleCalendarSettings(request: Request, env: Env): Promise<Response> {
  const formData = await request.formData();
  const clientId = normalizeString(formData.get("clientId"));
  const clientSecret = normalizeString(formData.get("clientSecret"));
  const refreshToken = normalizeString(formData.get("refreshToken"));
  const calendarId = normalizeString(formData.get("calendarId"));
  const timeZone = normalizeString(formData.get("timeZone"));

  if (!clientId || !clientSecret || !refreshToken || !calendarId) {
    return redirect("/data-tools?error=All+Google+Calendar+credential+fields+except+timezone+are+required");
  }

  try {
    await saveStoredGoogleCalendarSettings(
      env,
      {
        ...(await getStoredGoogleCalendarSettingsPayload(env)),
        clientId,
        clientSecret,
        refreshToken,
        calendarId,
        timeZone: timeZone || undefined,
      },
      new Date().toISOString(),
    );
  } catch (error) {
    console.error("Failed to save Google Calendar settings", error);
    return redirect("/data-tools?error=Failed+to+save+encrypted+Google+Calendar+settings");
  }

  return redirect("/data-tools?notice=Encrypted+Google+Calendar+settings+saved");
}

export async function handleSaveGoogleCalendarIcalSettings(request: Request, env: Env): Promise<Response> {
  const formData = await request.formData();
  const iCalUrl = normalizeString(formData.get("iCalUrl"));
  const timeZone = normalizeString(formData.get("timeZone"));

  if (!iCalUrl) {
    return redirect("/data-tools?error=Google+Calendar+iCal+URL+is+required");
  }

  try {
    await saveStoredGoogleCalendarSettings(
      env,
      {
        ...(await getStoredGoogleCalendarSettingsPayload(env)),
        iCalUrl,
        timeZone: timeZone || undefined,
      },
      new Date().toISOString(),
    );
  } catch (error) {
    console.error("Failed to save Google Calendar iCal settings", error);
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
    console.error("Failed to clear Google Calendar OAuth settings", error);
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
    console.error("Failed to clear Google Calendar iCal settings", error);
    return redirect("/data-tools?error=Failed+to+clear+stored+Google+Calendar+iCal+settings");
  }

  return redirect("/data-tools?notice=Stored+Google+Calendar+iCal+settings+cleared");
}

export async function handleClearGoogleCalendarSettings(env: Env): Promise<Response> {
  try {
    await clearStoredGoogleCalendarSettings(env);
  } catch (error) {
    console.error("Failed to clear Google Calendar settings", error);
    return redirect("/data-tools?error=Failed+to+clear+stored+Google+Calendar+settings");
  }

  return redirect("/data-tools?notice=Stored+Google+Calendar+settings+cleared");
}
