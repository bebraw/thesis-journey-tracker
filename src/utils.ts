import type { DegreeId, PhaseId, Student } from "./db";
import type { DegreeDefinition, PhaseDefinition } from "./reference-data";

export interface SessionConfig {
  cookieName: string;
  ttlSeconds: number;
}

export function shouldIncludeTestData(envValue?: string): boolean {
  const value = envValue?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export function htmlResponse(html: string): Response {
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function htmlFragmentResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function cssResponse(css: string): Response {
  return new Response(css, {
    headers: {
      "content-type": "text/css; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}

export function iconResponse(icon: ArrayBuffer): Response {
  return new Response(icon, {
    headers: {
      "content-type": "image/x-icon",
      "cache-control": "public, max-age=604800",
    },
  });
}

export function normalizeString(
  value: FormDataEntryValue | string | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

export function normalizeDate(
  value: FormDataEntryValue | string | null | undefined,
  allowNull = false,
): string | null | undefined {
  if (value === null || value === undefined || value === "") {
    return allowNull ? null : null;
  }
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return allowNull ? undefined : null;
  }
  return text;
}

export function normalizeDateTime(
  value: FormDataEntryValue | string | null | undefined,
  allowNull = false,
): string | null | undefined {
  if (value === null || value === undefined || value === "") {
    return allowNull ? null : null;
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return allowNull ? undefined : null;
  }
  return date.toISOString();
}

export function normalizePhase(
  value: FormDataEntryValue | string | null | undefined,
  phases: readonly PhaseDefinition[],
): PhaseId | null {
  const text = normalizeString(value);
  if (!text) {
    return null;
  }
  return phases.some((phase) => phase.id === text) ? (text as PhaseId) : null;
}

export function normalizeDegree(
  value: FormDataEntryValue | string | null | undefined,
  degrees: readonly DegreeDefinition[],
): DegreeId | null {
  const text = normalizeString(value);
  if (!text) {
    return null;
  }
  return degrees.some((degree) => degree.id === text)
    ? (text as DegreeId)
    : null;
}

export function addSixMonths(dateText: string | null): string | null {
  if (!dateText) {
    return null;
  }
  const date = new Date(`${dateText}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  date.setUTCMonth(date.getUTCMonth() + 6);
  return date.toISOString().slice(0, 10);
}

export function formatDateTime(isoValue: string): string {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return isoValue;
  }
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function toDateTimeLocalInput(isoValue: string | null): string {
  if (!isoValue) {
    return "";
  }
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 16);
}

export function getPhaseLabel(
  phaseId: PhaseId,
  phases: readonly PhaseDefinition[],
): string {
  const phase = phases.find((item) => item.id === phaseId);
  return phase ? phase.label : phaseId;
}

export function getDegreeLabel(
  degreeId: DegreeId,
  degrees: readonly DegreeDefinition[],
): string {
  const degree = degrees.find((item) => item.id === degreeId);
  return degree ? degree.label : degreeId;
}

export function meetingStatusText(student: Student): string {
  if (!student.nextMeetingAt) {
    return "Not booked";
  }
  const nextMeeting = new Date(student.nextMeetingAt);
  const now = new Date();
  if (nextMeeting < now) {
    return "Overdue";
  }
  if (nextMeeting.getTime() - now.getTime() <= 14 * 24 * 60 * 60 * 1000) {
    return "Within 2 weeks";
  }
  return "Scheduled";
}

export function meetingStatusId(student: Student): string {
  if (!student.nextMeetingAt) {
    return "not_booked";
  }
  const nextMeeting = new Date(student.nextMeetingAt);
  const now = new Date();
  if (nextMeeting < now) {
    return "overdue";
  }
  if (nextMeeting.getTime() - now.getTime() <= 14 * 24 * 60 * 60 * 1000) {
    return "within_2_weeks";
  }
  return "scheduled";
}

export function escapeHtml(value: string | number): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function escapeJsString(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll("\r", "\\r")
    .replaceAll("\n", "\\n");
}

export function redirect(
  pathname: string,
  extraHeaders: HeadersInit = {},
): Response {
  const headers = new Headers({ Location: pathname, ...extraHeaders });
  return new Response(null, { status: 302, headers });
}

export function buildSessionCookie(
  token: string,
  requestUrl: string,
  session: SessionConfig,
): string {
  const securePart =
    new URL(requestUrl).protocol === "https:" ? " Secure;" : "";
  return `${session.cookieName}=${token}; HttpOnly;${securePart} Path=/; SameSite=Strict; Max-Age=${session.ttlSeconds}`;
}

export function clearSessionCookie(
  requestUrl: string,
  session: SessionConfig,
): string {
  const securePart =
    new URL(requestUrl).protocol === "https:" ? " Secure;" : "";
  return `${session.cookieName}=; HttpOnly;${securePart} Path=/; SameSite=Strict; Max-Age=0`;
}

export async function createSessionToken(
  secret: string,
  ttlSeconds: number,
): Promise<string> {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const payload = String(expiresAt);
  const signature = await hmacSign(payload, secret);
  return `${payload}.${signature}`;
}

export async function isAuthenticated(
  request: Request,
  secret: string,
  cookieName: string,
): Promise<boolean> {
  const cookieHeader = request.headers.get("cookie") || "";
  const token = readCookie(cookieHeader, cookieName);
  if (!token) {
    return false;
  }

  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return false;
  }

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return false;
  }

  const expectedSignature = await hmacSign(payload, secret);
  return timingSafeEqual(signature, expectedSignature);
}

function readCookie(cookieHeader: string, name: string): string | null {
  const items = cookieHeader.split(";");
  for (const item of items) {
    const [key, ...valueParts] = item.trim().split("=");
    if (key === name) {
      return valueParts.join("=");
    }
  }
  return null;
}

async function hmacSign(value: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );
  return bufferToBase64Url(signatureBuffer);
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
