import type { Env } from "../app-env";
import type { SessionUser } from "../auth";
import { createAgentToken, listAgentTokens, revokeAgentToken } from "../agent/tokens";
import { readFormData } from "../http/request-body";
import { htmlResponse, redirect } from "../http/response";
import { renderAgentAccessPage } from "../view/agent-access.htmlisp";

export async function handleAgentAccess(request: Request, env: Env, user: SessionUser): Promise<Response> {
  let token: string | null = null;
  let error: string | null = null;
  if (request.method === "POST") {
    const form = await readFormData(request);
    if (form.get("action") === "revoke") {
      await revokeAgentToken(env.DB, user.id, String(form.get("tokenId") || ""));
      return redirect("/agent-access?notice=Token+revoked");
    }
    const name = String(form.get("name") || "").trim();
    const days = Number(form.get("days"));
    if (!name || name.length > 100 || ![30, 90, 365].includes(days)) error = "Enter a token name and choose an expiry.";
    else token = await createAgentToken(env.DB, user, name, days);
  }
  const response = htmlResponse(
    renderAgentAccessPage(user, await listAgentTokens(env.DB, user.id), new URL(request.url).origin, token, error),
  );
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Cache-Control", "no-store");
  return response;
}
