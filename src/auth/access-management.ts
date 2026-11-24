import type { D1Database } from "../db-core";
import type { AccessRole, SessionUser } from "./types";

export interface AccountChoice {
  id: number;
  name: string;
}

export interface ManagedAccount extends AccountChoice {
  role: AccessRole;
  is_admin: number;
  can_supervise: number;
  disabled_at: string | null;
  session_version: number;
}

export interface ManagedThesis extends AccountChoice {
  archived_at: string | null;
  supervisor_id: number | null;
  supervisor_name: string | null;
}

const admin = `EXISTS (SELECT 1 FROM app_users actor
  WHERE actor.id = ?1 AND actor.session_version = ?2 AND actor.disabled_at IS NULL AND actor.is_admin = 1)`;

function managesThesis(studentId: string): string {
  return `EXISTS (SELECT 1 FROM app_users actor
    WHERE actor.id = ?1 AND actor.session_version = ?2 AND actor.disabled_at IS NULL AND (
      actor.is_admin = 1 OR (actor.can_supervise = 1 AND actor.role = 'editor' AND EXISTS (SELECT 1 FROM thesis_assignments lead
        WHERE lead.student_id = ${studentId} AND lead.assignment_role = 'supervisor' AND lead.user_id = actor.id))))`;
}

export async function listManagedAccounts(db: D1Database, user: SessionUser): Promise<ManagedAccount[]> {
  return (
    await db
      .prepare(
        `SELECT id, name, role, is_admin, can_supervise, disabled_at, session_version
    FROM app_users WHERE ${admin} ORDER BY name, id`,
      )
      .bind(user.id, user.sessionVersion)
      .all<ManagedAccount>()
  ).results;
}

export async function listManagedTheses(db: D1Database, user: SessionUser): Promise<ManagedThesis[]> {
  return (
    await db
      .prepare(
        `SELECT s.id, s.name, s.archived_at, lead.user_id AS supervisor_id, u.name AS supervisor_name
    FROM students s LEFT JOIN thesis_assignments lead ON lead.student_id = s.id AND lead.assignment_role = 'supervisor'
    LEFT JOIN app_users u ON u.id = lead.user_id
    WHERE ${managesThesis("s.id")} ORDER BY (s.archived_at IS NOT NULL), s.name, s.id`,
      )
      .bind(user.id, user.sessionVersion)
      .all<ManagedThesis>()
  ).results;
}

export async function getAdvisorChoices(db: D1Database, user: SessionUser, studentId: number) {
  const rows = (
    await db
      .prepare(
        `SELECT u.id, u.name, assignment.assignment_role
    FROM app_users u LEFT JOIN thesis_assignments assignment ON assignment.user_id = u.id AND assignment.student_id = ?3
    WHERE u.disabled_at IS NULL AND ${managesThesis("?3")} ORDER BY u.name, u.id`,
      )
      .bind(user.id, user.sessionVersion, studentId)
      .all<AccountChoice & { assignment_role: string | null }>()
  ).results;
  return {
    assigned: rows.filter((row) => row.assignment_role === "advisor"),
    available: rows.filter((row) => row.assignment_role === null),
  };
}

export interface AccountRights {
  name: string;
  role: AccessRole;
  isAdmin: boolean;
  canSupervise: boolean;
}

export async function createManagedAccount(db: D1Database, actor: SessionUser, rights: AccountRights, hash: string): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT INTO app_users (name, role, is_admin, can_supervise, password_hash)
    SELECT ?3, ?4, ?5, ?6, ?7 WHERE ${admin} ON CONFLICT(name) DO NOTHING RETURNING id`,
    )
    .bind(actor.id, actor.sessionVersion, rights.name, rights.role, Number(rights.isAdmin), Number(rights.canSupervise), hash)
    .run();
  return Boolean(result.results?.length);
}

const lastAdminGuard = `(is_admin = 0 OR disabled_at IS NOT NULL OR EXISTS (
  SELECT 1 FROM app_users other WHERE other.id <> ?3 AND other.is_admin = 1 AND other.disabled_at IS NULL))`;
const hasNoTheses = `NOT EXISTS (SELECT 1 FROM thesis_assignments WHERE user_id = ?3 AND assignment_role = 'supervisor')`;

export async function updateManagedAccount(
  db: D1Database,
  actor: SessionUser,
  accountId: number,
  version: number,
  rights: AccountRights,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE app_users SET name = ?5, role = ?6, is_admin = ?7, can_supervise = ?8,
    session_version = session_version + 1 WHERE id = ?3 AND session_version = ?4 AND ${admin}
    AND (?7 = 1 OR ${lastAdminGuard}) AND ((?8 = 1 AND ?6 = 'editor') OR ${hasNoTheses})
    AND NOT EXISTS (SELECT 1 FROM app_users other WHERE other.name = ?5 AND other.id <> ?3) RETURNING id`,
    )
    .bind(actor.id, actor.sessionVersion, accountId, version, rights.name, rights.role, Number(rights.isAdmin), Number(rights.canSupervise))
    .run();
  return Boolean(result.results?.length);
}

export async function changeAccountStatus(
  db: D1Database,
  actor: SessionUser,
  accountId: number,
  version: number,
  enable: boolean,
): Promise<boolean> {
  const condition = enable ? "disabled_at IS NOT NULL" : `disabled_at IS NULL AND ${lastAdminGuard} AND ${hasNoTheses}`;
  const result = await db
    .prepare(
      `UPDATE app_users SET disabled_at = ?5, session_version = session_version + 1
    WHERE id = ?3 AND session_version = ?4 AND ${admin} AND ${condition} RETURNING id`,
    )
    .bind(actor.id, actor.sessionVersion, accountId, version, enable ? null : new Date().toISOString())
    .run();
  return Boolean(result.results?.length);
}

export async function resetManagedPassword(
  db: D1Database,
  actor: SessionUser,
  accountId: number,
  version: number,
  hash: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE app_users SET password_hash = ?5, session_version = session_version + 1
    WHERE id = ?3 AND session_version = ?4 AND ${admin} RETURNING id`,
    )
    .bind(actor.id, actor.sessionVersion, accountId, version, hash)
    .run();
  return Boolean(result.results?.length);
}

export async function deleteManagedAccount(db: D1Database, actor: SessionUser, accountId: number, version: number): Promise<boolean> {
  const eligible = `id = ?3 AND session_version = ?4 AND disabled_at IS NOT NULL AND ${admin} AND ${hasNoTheses}`;
  const args = [actor.id, actor.sessionVersion, accountId, version] as const;
  const results = await db.batch([
    db
      .prepare(
        `DELETE FROM thesis_assignments WHERE user_id = ?3 AND assignment_role = 'advisor'
      AND EXISTS (SELECT 1 FROM app_users WHERE ${eligible})`,
      )
      .bind(...args),
    db.prepare(`DELETE FROM app_users WHERE ${eligible} RETURNING id`).bind(...args),
  ]);
  return Boolean(results[1]?.results?.length);
}

export async function changeAdvisor(
  db: D1Database,
  actor: SessionUser,
  studentId: number,
  advisorId: number,
  add: boolean,
): Promise<boolean> {
  const allowed = managesThesis("?3");
  const sql = add
    ? `INSERT INTO thesis_assignments (student_id, user_id, assignment_role)
       SELECT ?3, id, 'advisor' FROM app_users WHERE id = ?4 AND disabled_at IS NULL AND ${allowed}
       AND EXISTS (SELECT 1 FROM thesis_assignments WHERE student_id = ?3 AND assignment_role = 'supervisor')
       ON CONFLICT(student_id, user_id) DO NOTHING RETURNING user_id`
    : `DELETE FROM thesis_assignments WHERE student_id = ?3 AND user_id = ?4 AND assignment_role = 'advisor'
       AND ${allowed} RETURNING user_id`;
  const result = await db.prepare(sql).bind(actor.id, actor.sessionVersion, studentId, advisorId).run();
  return Boolean(result.results?.length);
}

export async function assignUnownedTheses(
  db: D1Database,
  actor: SessionUser,
  supervisorId: number,
  studentIds: number[],
): Promise<boolean> {
  if (studentIds.length === 0) return false;
  const result = await db
    .prepare(
      `WITH eligible AS (
      SELECT s.id FROM students s JOIN json_each(?4) chosen ON chosen.value = s.id WHERE NOT EXISTS (
        SELECT 1 FROM thesis_assignments a WHERE a.student_id = s.id AND a.assignment_role = 'supervisor'))
    INSERT INTO thesis_assignments (student_id, user_id, assignment_role)
    SELECT id, ?3, 'supervisor' FROM eligible WHERE (SELECT COUNT(*) FROM eligible) = json_array_length(?4)
    AND ${admin} AND EXISTS (SELECT 1 FROM app_users WHERE id = ?3 AND can_supervise = 1 AND role = 'editor' AND disabled_at IS NULL)
    RETURNING student_id`,
    )
    .bind(actor.id, actor.sessionVersion, supervisorId, JSON.stringify(studentIds))
    .run();
  return result.results?.length === studentIds.length;
}

export async function transferSupervision(
  db: D1Database,
  actor: SessionUser,
  studentId: number,
  currentLead: number,
  nextLead: number,
): Promise<boolean> {
  if (currentLead === nextLead) return false;
  const allowed = `${admin} AND EXISTS (SELECT 1 FROM app_users WHERE id = ?5 AND can_supervise = 1 AND role = 'editor' AND disabled_at IS NULL)`;
  const expectedLead = "student_id = ?3 AND user_id = ?4 AND assignment_role = 'supervisor'";
  const args = [actor.id, actor.sessionVersion, studentId, currentLead, nextLead] as const;
  // A current advisor can become the lead. Both steps see the same ownership in the D1 batch.
  const results = await db.batch([
    db
      .prepare(
        `DELETE FROM thesis_assignments WHERE student_id = ?3 AND user_id = ?5 AND assignment_role = 'advisor'
      AND EXISTS (SELECT 1 FROM thesis_assignments WHERE ${expectedLead}) AND ${allowed}`,
      )
      .bind(...args),
    db.prepare(`UPDATE thesis_assignments SET user_id = ?5 WHERE ${expectedLead} AND ${allowed} RETURNING student_id`).bind(...args),
  ]);
  return Boolean(results[1]?.results?.length);
}
