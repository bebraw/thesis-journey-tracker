import type { SessionIdentity } from "./types";

export const SESSION_COOKIE = "thesis_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 4;
const EXPIRED_COOKIE_DATE = "Thu, 01 Jan 1970 00:00:00 GMT";

export interface SessionConfig {
  cookieName: string;
  ttlSeconds: number;
}

export function buildSessionCookie(token: string, requestUrl: string, session: SessionConfig): string {
  const securePart = new URL(requestUrl).protocol === "https:" ? " Secure;" : "";
  return `${session.cookieName}=${token}; HttpOnly;${securePart} Path=/; SameSite=Strict; Max-Age=${session.ttlSeconds}`;
}

export function clearSessionCookie(requestUrl: string, session: SessionConfig): string {
  const securePart = new URL(requestUrl).protocol === "https:" ? " Secure;" : "";
  return `${session.cookieName}=; HttpOnly;${securePart} Path=/; SameSite=Strict; Expires=${EXPIRED_COOKIE_DATE}; Max-Age=0`;
}

export async function createSessionToken(secret: string, ttlSeconds: number, identity: SessionIdentity): Promise<string> {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const payload = buildSessionPayload(expiresAt, identity);
  const signature = await hmacSign(payload, secret);
  return `${payload}.${signature}`;
}

export async function isAuthenticated(request: Request, secret: string, cookieName: string): Promise<boolean> {
  return Boolean(await getSessionIdentity(request, secret, cookieName));
}

export async function getSessionIdentity(request: Request, secret: string, cookieName: string): Promise<SessionIdentity | null> {
  const cookieHeader = request.headers.get("cookie") || "";
  const token = readCookie(cookieHeader, cookieName);
  if (!token) {
    return null;
  }

  const dotIndex = token.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === token.length - 1) {
    return null;
  }

  const payload = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);
  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = await hmacSign(payload, secret);
  if (!timingSafeEqual(signature, expectedSignature)) {
    return null;
  }

  return parseSessionPayload(payload);
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
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);

  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bufferToBase64Url(signatureBuffer);
}

function buildSessionPayload(expiresAt: number, identity: SessionIdentity): string {
  return `v2:${expiresAt}:${identity.userId}:${identity.sessionVersion}`;
}

function parseSessionPayload(payload: string): SessionIdentity | null {
  const [version, expiresAtText, userIdText, sessionVersionText] = payload.split(":");
  const expiresAt = Number(expiresAtText);
  const userId = Number(userIdText);
  const sessionVersion = Number(sessionVersionText);

  if (
    version !== "v2" ||
    !Number.isFinite(expiresAt) ||
    Date.now() > expiresAt ||
    !Number.isSafeInteger(userId) ||
    userId <= 0 ||
    !Number.isSafeInteger(sessionVersion) ||
    sessionVersion <= 0
  ) {
    return null;
  }

  return {
    userId,
    sessionVersion,
  };
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
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
