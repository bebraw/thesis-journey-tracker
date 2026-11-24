import {
  buildSessionCookie,
  clearSessionCookie,
  signSessionUntil,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  type AuthState,
  type SessionIdentity,
  type SessionUser,
  verifyLoginCredentials,
} from "../auth";
import type { Env } from "../app-env";
import { LOGIN_FORM_BODY_LIMIT_BYTES, readFormData } from "../http/request-body";
import { htmlResponse, redirect } from "../http/response";
import { renderLoginPage } from "../views";

export async function handleLoginRequest(
  request: Request,
  env: Env,
  authState: AuthState,
  sessionUser: SessionUser | null,
): Promise<Response> {
  if (request.method === "GET") {
    if (sessionUser) {
      return redirect("/");
    }
    const url = new URL(request.url);
    const errorState = url.searchParams.get("error") === "rate_limit" ? "rate_limit" : url.searchParams.get("error") ? "invalid" : null;
    return htmlResponse(renderLoginPage(errorState, authState.users.length > 1));
  }

  const formData = await readFormData(request, { maxBytes: LOGIN_FORM_BODY_LIMIT_BYTES });
  const enteredName = (formData.get("name") || "").toString().trim();
  const password = (formData.get("password") || "").toString();
  const loginResult = await verifyLoginCredentials(env, request, authState, enteredName, password);

  if (loginResult.status === "rate_limited") {
    return redirect("/login?error=rate_limit");
  }

  if (loginResult.status === "invalid") {
    return redirect("/login?error=1");
  }

  if (loginResult.status !== "authenticated") {
    return redirect("/login?error=1");
  }

  return redirectWithSession(request, env, "/", {
    userId: loginResult.user.id,
    sessionVersion: loginResult.user.sessionVersion,
  });
}

export async function redirectWithSession(
  request: Request,
  env: Env,
  path: string,
  identity: SessionIdentity,
  expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000,
): Promise<Response> {
  const token = await signSessionUntil(env.SESSION_SECRET || "", expiresAt, identity);
  return redirect(path, {
    "Set-Cookie": buildSessionCookie(token, request.url, {
      cookieName: SESSION_COOKIE,
      ttlSeconds: Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)),
    }),
  });
}

export function handleLogout(requestUrl: string): Response {
  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    clearSessionCookie(requestUrl, {
      cookieName: SESSION_COOKIE,
      ttlSeconds: SESSION_TTL_SECONDS,
    }),
  );
  return redirect("/login", headers);
}

export function readonlyRedirect(pathname: string): Response {
  const separator = pathname.includes("?") ? "&" : "?";
  return redirect(`${pathname}${separator}error=Read-only+access`);
}
