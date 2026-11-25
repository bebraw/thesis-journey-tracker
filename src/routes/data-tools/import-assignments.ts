import type { SessionUser } from "../../auth";
import { backupInstallationQuery } from "../../backup/data";
import type { ExportedAssignment, ImportedStudentBundle } from "../../data-transfer/types";
import type { D1Database } from "../../db-core";
import { htmlResponse } from "../../http/response";
import { renderAccountMapping, type BackupAccountChoice } from "../../view/data-tools/account-mapping.htmlisp";

interface ImportAccount {
  id: number;
  name: string;
  backup_name: string;
  supervisor: number;
}

export type ResolvedBundle = Omit<ImportedStudentBundle, "assignments"> & { assignments: ExportedAssignment[] };

interface AssignmentReview {
  installationId: string | null;
  form: FormData;
  file: File;
  mode: "append" | "replace";
  actor: SessionUser;
}

export async function resolveImportAssignments(
  db: D1Database,
  data: ImportedStudentBundle[],
  review: AssignmentReview,
): Promise<ResolvedBundle[] | string | Response> {
  const rows = await db
    .prepare(
      `SELECT id, name, COALESCE(backup_name, name) AS backup_name,
    (role = 'editor' AND can_supervise = 1) AS supervisor FROM app_users WHERE disabled_at IS NULL
      AND EXISTS (SELECT 1 FROM student_import_administrators WHERE user_id = ? AND session_version = ?)
      ORDER BY name, id`,
    )
    .bind(review.actor.id, review.actor.sessionVersion)
    .all<ImportAccount>();
  if (rows.results.length === 0) return new Response("Administrator access required", { status: 403 });
  const accounts = new Map(rows.results.map((account) => [account.id, account]));
  const localIdentity = await db.prepare(backupInstallationQuery).first<{ installation_id: string }>();
  if (!localIdentity) throw new Error("Missing backup installation ID.");
  let mapping: Map<number, ImportAccount> | null = null;
  const sources = collectBackupAccounts(data);
  if (review.installationId !== localIdentity.installation_id && sources.length > 0) {
    const choices = await reviewAccountMapping(review, sources, accounts);
    if (!(choices instanceof Map)) return choices;
    mapping = choices;
  } else if (review.form.has("mappingDigest")) {
    return fileChanged;
  }

  const legacyOwner = accounts.get(Number(review.form.get("legacySupervisor")));
  const bundles: ResolvedBundle[] = [];
  for (const bundle of data) {
    let team = bundle.assignments;
    if (team === null) {
      if (!legacyOwner?.supervisor) return "Select an active supervisor for theses in a version 1 backup.";
      team = [{ userId: legacyOwner.id, name: legacyOwner.backup_name, role: "supervisor" }];
    }
    const assignments: ExportedAssignment[] = [];
    const assigned = new Set<number>();
    for (const assignment of team) {
      const account = (mapping ?? accounts).get(assignment.userId);
      if (!account || (!mapping && account.backup_name !== assignment.name) || (assignment.role === "supervisor" && !account.supervisor)) {
        return `Thesis ${bundles.length + 1} references an unavailable ${assignment.role} account. Check the account ID, exact backup name, and permissions before importing.`;
      }
      if (assigned.has(account.id)) return `Choose different local accounts for the members of thesis ${bundles.length + 1}.`;
      assigned.add(account.id);
      assignments.push({ userId: account.id, name: account.backup_name, role: assignment.role });
    }
    bundles.push({ ...bundle, assignments });
  }
  return bundles;
}

function collectBackupAccounts(data: ImportedStudentBundle[]): BackupAccountChoice[] {
  const exportedAccounts = new Map<number, BackupAccountChoice>();
  for (const bundle of data) {
    for (const assignment of bundle.assignments ?? []) {
      const known = exportedAccounts.get(assignment.userId);
      exportedAccounts.set(assignment.userId, {
        id: assignment.userId,
        name: assignment.name,
        supervises: known?.supervises === true || assignment.role === "supervisor",
      });
    }
  }
  return [...exportedAccounts.values()];
}

const fileChanged = "The selected file changed. Start the import again to review the correct backup.";

async function reviewAccountMapping(
  review: AssignmentReview,
  sources: BackupAccountChoice[],
  accounts: Map<number, ImportAccount>,
): Promise<Map<number, ImportAccount> | Response | string> {
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await review.file.arrayBuffer())), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const submittedDigest = review.form.get("mappingDigest");
  if (submittedDigest !== null && submittedDigest !== digest) return fileChanged;
  if (submittedDigest === digest) {
    const mapping = new Map<number, ImportAccount>();
    for (const source of sources) {
      const local = accounts.get(Number(review.form.get(`map-${source.id}`)));
      if (!local || (source.supervises && !local.supervisor)) break;
      mapping.set(source.id, local);
    }
    if (mapping.size === sources.length) return mapping;
  }
  const localChoices = [...accounts.values()].map((account) => ({
    id: account.id,
    name: account.name,
    supervises: Boolean(account.supervisor),
  }));
  return htmlResponse(
    renderAccountMapping(
      review.actor,
      sources,
      localChoices,
      { name: review.file.name, digest, legacy: review.installationId === null },
      review.mode,
      submittedDigest === null ? null : "Choose an eligible local account for every backup account.",
    ),
  );
}
