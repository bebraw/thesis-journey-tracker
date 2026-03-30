export interface GoogleCalendarConfigInput {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  calendarId?: string;
  timeZone?: string;
}

export interface GoogleCalendarConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  calendarId: string;
  timeZone: string;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description: string | null;
  htmlLink: string | null;
  startDateTime: string | null;
  startDate: string | null;
  endDateTime: string | null;
  endDate: string | null;
  attendeeEmails: string[];
}

export interface CreateGoogleCalendarEventInput {
  eventId?: string;
  summary: string;
  description?: string | null;
  startLocal: string;
  endLocal: string;
  attendeeEmails: string[];
}

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleEventsResponse {
  items?: Array<{
    id?: string;
    summary?: string;
    description?: string;
    htmlLink?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    attendees?: Array<{ email?: string }>;
  }>;
  error?: {
    code?: number;
    message?: string;
    errors?: Array<{
      message?: string;
      reason?: string;
    }>;
  };
}

type GoogleCalendarApiEvent = NonNullable<GoogleEventsResponse["items"]>[number];

export class GoogleCalendarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleCalendarError";
  }
}

export function resolveGoogleCalendarConfig(input: GoogleCalendarConfigInput): GoogleCalendarConfig | null {
  if (!input.clientId || !input.clientSecret || !input.refreshToken || !input.calendarId) {
    return null;
  }

  return {
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    refreshToken: input.refreshToken,
    calendarId: input.calendarId,
    timeZone: input.timeZone || "Europe/Helsinki",
  };
}

export async function listGoogleCalendarEvents(
  config: GoogleCalendarConfig,
  options: { timeMinIso: string; timeMaxIso: string },
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleCalendarEvent[]> {
  const accessToken = await getGoogleAccessToken(config, fetchImpl);
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events`);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("timeMin", options.timeMinIso);
  url.searchParams.set("timeMax", options.timeMaxIso);
  url.searchParams.set("timeZone", config.timeZone);

  const response = await fetchImpl(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new GoogleCalendarError(await buildGoogleApiErrorMessage("Google Calendar event list failed", response));
  }

  const payload = (await response.json()) as GoogleEventsResponse;
  return (payload.items || []).map((item) => ({
    id: item.id || "",
    summary: item.summary || "Untitled event",
    description: item.description || null,
    htmlLink: item.htmlLink || null,
    startDateTime: item.start?.dateTime || null,
    startDate: item.start?.date || null,
    endDateTime: item.end?.dateTime || null,
    endDate: item.end?.date || null,
    attendeeEmails: (item.attendees || []).flatMap((attendee) => (attendee.email ? [attendee.email] : [])),
  }));
}

export async function createGoogleCalendarEvent(
  config: GoogleCalendarConfig,
  input: CreateGoogleCalendarEventInput,
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleCalendarEvent> {
  const accessToken = await getGoogleAccessToken(config, fetchImpl);
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events`);
  url.searchParams.set("sendUpdates", "all");

  const response = await fetchImpl(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      id: input.eventId || undefined,
      summary: input.summary,
      description: input.description || undefined,
      start: {
        dateTime: input.startLocal,
        timeZone: config.timeZone,
      },
      end: {
        dateTime: input.endLocal,
        timeZone: config.timeZone,
      },
      attendees: input.attendeeEmails.map((email) => ({ email })),
    }),
  });

  if (!response.ok) {
    if (response.status === 409 && input.eventId) {
      return await getGoogleCalendarEvent(config, input.eventId, accessToken, fetchImpl);
    }

    throw new GoogleCalendarError(await buildGoogleApiErrorMessage("Google Calendar event creation failed", response));
  }

  const item = (await response.json()) as GoogleCalendarApiEvent;
  return mapGoogleCalendarApiEvent(item, input);
}

async function getGoogleCalendarEvent(
  config: GoogleCalendarConfig,
  eventId: string,
  accessToken: string,
  fetchImpl: typeof fetch,
): Promise<GoogleCalendarEvent> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events/${encodeURIComponent(eventId)}`;
  const response = await fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new GoogleCalendarError(await buildGoogleApiErrorMessage("Google Calendar event lookup failed", response));
  }

  const item = (await response.json()) as GoogleCalendarApiEvent;
  return mapGoogleCalendarApiEvent(item, {
    eventId,
    summary: "Untitled event",
    description: null,
    startLocal: "",
    endLocal: "",
    attendeeEmails: [],
  });
}

function mapGoogleCalendarApiEvent(item: GoogleCalendarApiEvent | undefined, input: CreateGoogleCalendarEventInput): GoogleCalendarEvent {
  return {
    id: item?.id || input.eventId || "",
    summary: item?.summary || input.summary,
    description: item?.description || input.description || null,
    htmlLink: item?.htmlLink || null,
    startDateTime: item?.start?.dateTime || null,
    startDate: item?.start?.date || null,
    endDateTime: item?.end?.dateTime || null,
    endDate: item?.end?.date || null,
    attendeeEmails: (item?.attendees || []).flatMap((attendee: { email?: string }) => (attendee.email ? [attendee.email] : [])),
  };
}

async function getGoogleAccessToken(config: GoogleCalendarConfig, fetchImpl: typeof fetch): Promise<string> {
  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new GoogleCalendarError(await buildGoogleApiErrorMessage("Google OAuth token refresh failed", response));
  }

  const payload = (await response.json()) as GoogleTokenResponse;
  if (!payload.access_token) {
    throw new GoogleCalendarError("Google OAuth token refresh did not return an access token.");
  }

  return payload.access_token;
}

async function buildGoogleApiErrorMessage(prefix: string, response: Response): Promise<string> {
  const detail = await extractGoogleApiErrorDetail(response);
  return detail ? `${prefix} with status ${response.status}: ${detail}` : `${prefix} with status ${response.status}.`;
}

async function extractGoogleApiErrorDetail(response: Response): Promise<string | null> {
  const bodyText = await response.text();
  if (!bodyText.trim()) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return bodyText.trim();
  }

  if (!parsed || typeof parsed !== "object") {
    return bodyText.trim();
  }

  const payload = parsed as GoogleTokenResponse & GoogleEventsResponse;
  const errorValue = payload.error;
  if (typeof errorValue === "string") {
    const description = typeof payload.error_description === "string" ? payload.error_description.trim() : "";
    return description ? `${errorValue}: ${description}` : errorValue;
  }

  if (errorValue && typeof errorValue === "object") {
    const structuredError = errorValue as {
      message?: string;
      errors?: Array<{ message?: string; reason?: string }>;
    };
    const message = typeof structuredError.message === "string" ? structuredError.message.trim() : "";
    const firstReason =
      Array.isArray(structuredError.errors) && structuredError.errors.length > 0 && typeof structuredError.errors[0]?.reason === "string"
        ? structuredError.errors[0].reason.trim()
        : "";

    if (firstReason && message) {
      return `${firstReason}: ${message}`;
    }
    if (message) {
      return message;
    }
    if (firstReason) {
      return firstReason;
    }
  }

  return bodyText.trim();
}
