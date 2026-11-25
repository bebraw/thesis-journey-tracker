import type { SessionUser } from "../auth";
import type { D1Database } from "../db-core";
import { requireD1MutationSuccess, requireD1ReturnedRow } from "../db-core";

export interface AgentTokenSummary {
  id: string;
  name: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

export async function hashAgentToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function authenticateAgent(request: Request, db: D1Database): Promise<SessionUser | null> {
  const authorization = request.headers.get("authorization") || "";
  if (!/^Bearer tjt_[a-f0-9]{64}$/.test(authorization)) return null;
  const user = await db
    .prepare(
      `SELECT u.id, u.name, u.role, u.session_version AS sessionVersion, u.is_admin, u.can_supervise
    FROM agent_tokens t JOIN app_users u ON u.id = t.user_id
    WHERE t.token_hash = ? AND t.revoked_at IS NULL AND t.expires_at > ? AND u.disabled_at IS NULL`,
    )
    .bind(await hashAgentToken(authorization.slice(7)), new Date().toISOString())
    .first<Pick<SessionUser, "id" | "name" | "role" | "sessionVersion"> & { is_admin: number; can_supervise: number }>();
  if (!user) return null;
  const { is_admin, can_supervise, ...identity } = user;
  return { ...identity, isAdmin: is_admin === 1, canSupervise: can_supervise === 1 };
}

export async function listAgentTokens(db: D1Database, userId: number): Promise<AgentTokenSummary[]> {
  return (
    await db
      .prepare("SELECT id, name, expires_at, revoked_at, created_at FROM agent_tokens WHERE user_id = ? ORDER BY created_at DESC")
      .bind(userId)
      .all<AgentTokenSummary>()
  ).results;
}

export async function createAgentToken(db: D1Database, user: SessionUser, name: string, days: number): Promise<string> {
  if (!name.trim() || name.length > 100 || ![30, 90, 365].includes(days)) throw new Error("Choose a token name and a valid expiry.");
  const active = (await listAgentTokens(db, user.id)).filter((token) => !token.revoked_at && token.expires_at > new Date().toISOString());
  if (active.length >= 20) throw new Error("Revoke an existing token before creating another.");
  const secret = `tjt_${Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  const result = await db
    .prepare(
      `INSERT INTO agent_tokens (id, user_id, name, token_hash, expires_at)
              SELECT ?, id, ?, ?, ? FROM app_users WHERE id = ? AND disabled_at IS NULL AND session_version = ? RETURNING id`,
    )
    .bind(
      crypto.randomUUID(),
      name.trim(),
      await hashAgentToken(secret),
      new Date(Date.now() + days * 86_400_000).toISOString(),
      user.id,
      user.sessionVersion,
    )
    .run();
  requireD1ReturnedRow(result, "Creating agent token");
  return secret;
}

export async function revokeAgentToken(db: D1Database, userId: number, tokenId: string): Promise<void> {
  const result = await db
    .prepare("UPDATE agent_tokens SET revoked_at = ? WHERE id = ? AND user_id = ?")
    .bind(new Date().toISOString(), tokenId, userId)
    .run();
  requireD1MutationSuccess(result, "Revoking agent token");
}
