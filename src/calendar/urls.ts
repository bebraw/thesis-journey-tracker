const GOOGLE_CALENDAR_HOST = "calendar.google.com";
const GOOGLE_EVENT_HOSTS = new Set([GOOGLE_CALENDAR_HOST, "www.google.com"]);
const MAX_CALENDAR_URL_LENGTH = 2_048;
const MAX_CALENDAR_ID_LENGTH = 512;
const PRIVATE_FEED_SEGMENT = /^private-[a-z0-9_-]{4,512}$/i;

export function normalizeGoogleCalendarIcalUrl(value: string | null | undefined): string | null {
  const rawValue = (value || "").trim();
  if (!rawValue || rawValue.length > MAX_CALENDAR_URL_LENGTH) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(rawValue);
  } catch {
    return null;
  }

  if (
    url.protocol !== "https:" ||
    url.hostname.toLowerCase() !== GOOGLE_CALENDAR_HOST ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    return null;
  }

  const segments = url.pathname.split("/");
  if (segments.length !== 6 || segments[0] !== "" || segments[1] !== "calendar" || segments[2] !== "ical" || segments[5] !== "basic.ics") {
    return null;
  }

  const calendarId = decodePathSegment(segments[3]);
  const privateFeed = decodePathSegment(segments[4]);
  if (
    !calendarId ||
    calendarId.length > MAX_CALENDAR_ID_LENGTH ||
    /[\x00-\x20/\\?#]/.test(calendarId) ||
    !privateFeed ||
    !PRIVATE_FEED_SEGMENT.test(privateFeed)
  ) {
    return null;
  }

  return `https://${GOOGLE_CALENDAR_HOST}/calendar/ical/${encodeURIComponent(calendarId)}/${encodeURIComponent(privateFeed)}/basic.ics`;
}

export function normalizeGoogleCalendarEventLink(value: string | null | undefined): string | null {
  const rawValue = (value || "").trim();
  if (!rawValue || rawValue.length > MAX_CALENDAR_URL_LENGTH) {
    return null;
  }

  try {
    const url = new URL(rawValue);
    if (
      url.protocol !== "https:" ||
      !GOOGLE_EVENT_HOSTS.has(url.hostname.toLowerCase()) ||
      url.port ||
      url.username ||
      url.password ||
      url.pathname !== "/calendar/event"
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function decodePathSegment(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
