import type { Env } from "../app-env";
import type { SessionUser } from "../auth";
import { parseUsername, renameOwnAccount } from "../auth/username";
import { LOGIN_FORM_BODY_LIMIT_BYTES, readFormData } from "../http/request-body";
import { htmlResponse, redirect } from "../http/response";
import { renderAccountPage } from "../view/account.htmlisp";
import { redirectWithSession } from "./auth";

export async function handleAccount(request: Request, env: Env, user: SessionUser, expiresAt: number): Promise<Response> {
  if (request.method === "GET") {
    const query = new URL(request.url).searchParams;
    return htmlResponse(renderAccountPage(user, query.get("notice"), query.get("error")));
  }
  const form = await readFormData(request, { maxBytes: LOGIN_FORM_BODY_LIMIT_BYTES });
  const name = parseUsername(form.get("name"));
  if (!name) return redirect("/account?error=Enter+a+single-line+username+of+1+to+100+characters.");
  const original = form.get("originalName");
  const version = typeof original === "string" ? await renameOwnAccount(env.DB, user, original, name) : null;
  if (version === null) return redirect("/account?error=Username+unavailable+or+account+changed.+Refresh+and+try+again.");
  if (version === user.sessionVersion) return redirect("/account?notice=Username+unchanged.");
  return redirectWithSession(request, env, "/account?notice=Username+updated.", { userId: user.id, sessionVersion: version }, expiresAt);
}
