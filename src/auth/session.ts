import type { SessionUser } from "./types";

export const SESSION_COOKIE = "thesis_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

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
  return `${session.cookieName}=; HttpOnly;${securePart} Path=/; SameSite=Strict; Max-Age=0`;
}

export async function createSessionToken(secret: string, ttlSeconds: number, user: SessionUser): Promise<string> {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const payload = buildSessionPayload(expiresAt, user);
  const signature = await hmacSign(payload, secret);
  return `${payload}.${signature}`;
}

export async function isAuthenticated(request: Request, secret: string, cookieName: string): Promise<boolean> {
  return Boolean(await getSessionUser(request, secret, cookieName));
}

export async function getSessionUser(request: Request, secret: string, cookieName: string): Promise<SessionUser | null> {
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

function buildSessionPayload(expiresAt: number, user: SessionUser): string {
  const encoder = new TextEncoder();
  const nameBytes = encoder.encode(user.name);
  return `${expiresAt}:${user.role}:${bytesToBase64Url(nameBytes)}`;
}

function parseSessionPayload(payload: string): SessionUser | null {
  const [expiresAtText, role, encodedName] = payload.split(":");
  const expiresAt = Number(expiresAtText);

  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return null;
  }

  if ((role !== "editor" && role !== "readonly") || !encodedName) {
    return null;
  }

  const name = decodeBase64UrlToString(encodedName);
  if (!name) {
    return null;
  }

  return {
    name,
    role,
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

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64UrlToString(value: string): string | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    return new TextDecoder().decode(Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)));
  } catch {
    return null;
  }
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
