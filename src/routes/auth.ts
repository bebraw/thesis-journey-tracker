import {
  buildSessionCookie,
  clearSessionCookie,
  createSessionToken,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  type AuthState,
  type SessionUser,
  verifyLoginCredentials,
} from "../auth";
import type { Env } from "../app-env";
import { htmlResponse, redirect } from "../http/response";
import { renderLoginPage } from "../views";

export async function handleLoginRequest(request: Request, env: Env, authState: AuthState, sessionUser: SessionUser | null): Promise<Response> {
  if (request.method === "GET") {
    if (sessionUser) {
      return redirect("/");
    }
    const url = new URL(request.url);
    const errorState =
      url.searchParams.get("error") === "rate_limit"
        ? "rate_limit"
        : url.searchParams.get("error") === "password_reset"
          ? "password_reset"
          : url.searchParams.get("error")
            ? "invalid"
            : null;
    return htmlResponse(renderLoginPage(errorState, authState.users.length > 1));
  }

  const formData = await request.formData();
  const enteredName = (formData.get("name") || "").toString().trim();
  const password = (formData.get("password") || "").toString();
  const loginResult = await verifyLoginCredentials(env, request, authState, enteredName, password);

  if (loginResult.status === "rate_limited") {
    return redirect("/login?error=rate_limit");
  }

  if (loginResult.status === "password_reset") {
    return redirect("/login?error=password_reset");
  }

  if (loginResult.status === "invalid") {
    return redirect("/login?error=1");
  }

  if (loginResult.status !== "authenticated") {
    return redirect("/login?error=1");
  }

  const token = await createSessionToken(env.SESSION_SECRET || "", SESSION_TTL_SECONDS, loginResult.user);
  return redirect("/", {
    "Set-Cookie": buildSessionCookie(token, request.url, {
      cookieName: SESSION_COOKIE,
      ttlSeconds: SESSION_TTL_SECONDS,
    }),
  });
}

export function handleLogout(requestUrl: string, clearBookmarkCookie: string): Response {
  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    clearSessionCookie(requestUrl, {
      cookieName: SESSION_COOKIE,
      ttlSeconds: SESSION_TTL_SECONDS,
    }),
  );
  headers.append("Set-Cookie", clearBookmarkCookie);
  return redirect("/login", headers);
}

export function readonlyRedirect(pathname: string): Response {
  const separator = pathname.includes("?") ? "&" : "?";
  return redirect(`${pathname}${separator}error=Read-only+access`);
}
