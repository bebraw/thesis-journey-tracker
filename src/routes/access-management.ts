import type { Env } from "../app-env";
import { hashPassword, isAccessRole, type SessionUser } from "../auth";
import {
  assignUnownedTheses,
  changeAccountStatus,
  changeAdvisor,
  createManagedAccount,
  deleteManagedAccount,
  getAdvisorChoices,
  listManagedAccounts,
  listManagedTheses,
  resetManagedPassword,
  transferSupervision,
  updateManagedAccount,
  type AccountRights,
} from "../auth/access-management";
import { readFormData } from "../http/request-body";
import { parseUsername } from "../auth/username";
import { htmlResponse, redirect } from "../http/response";
import { renderAccessManagement } from "../view/access-management.htmlisp";

function id(value: FormDataEntryValue | null): number {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return 0;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : 0;
}

function feedback(ok: boolean, success: string, failure: string, studentId = 0): Response {
  const query = new URLSearchParams({ [ok ? "notice" : "error"]: ok ? success : failure });
  if (studentId) query.set("studentId", String(studentId));
  return redirect(`/access?${query}`);
}

function forbidden(): Response {
  return new Response("Access denied", { status: 403, headers: { "Cache-Control": "no-store" } });
}

function readRights(form: FormData): AccountRights | null {
  const name = parseUsername(form.get("name"));
  const selection = form.get("role");
  const canSupervise = selection === "supervisor";
  const role = canSupervise ? "editor" : selection;
  if (!name || !isAccessRole(role)) return null;
  return { name, role, isAdmin: form.get("isAdmin") === "yes", canSupervise };
}

async function newPasswordHash(form: FormData): Promise<string | null> {
  const password = form.get("password");
  if (
    typeof password !== "string" ||
    [...password].length < 15 ||
    new TextEncoder().encode(password).byteLength > 1024 ||
    /[\0\r\n]/.test(password)
  ) {
    return null;
  }
  return await hashPassword(password);
}

async function handleAccessChange(request: Request, env: Env, user: SessionUser): Promise<Response> {
  const form = await readFormData(request);
  const action = form.get("action");
  const accountId = id(form.get("accountId"));
  const studentId = id(form.get("studentId"));
  const version = id(form.get("version"));
  if (action === "add-advisor" || action === "remove-advisor") {
    const add = action === "add-advisor";
    const ok = Boolean(studentId && accountId) && (await changeAdvisor(env.DB, user, studentId, accountId, add));
    return feedback(
      ok,
      add ? "Advisor added." : "Advisor removed.",
      "The advisor assignment is unavailable. Refresh the team and try again.",
      studentId,
    );
  }
  if (!user.isAdmin) return forbidden();
  if (action === "assign-unowned") {
    const ids = [...new Set(form.getAll("studentId").map(id))];
    const ok = accountId > 0 && ids.length > 0 && !ids.includes(0) && (await assignUnownedTheses(env.DB, user, accountId, ids));
    return feedback(
      ok,
      "Supervisor assigned to the selected theses.",
      "Select unassigned theses and an active supervisor. Refresh the list if ownership changed.",
    );
  }
  if (action === "transfer") {
    const previousLead = id(form.get("previousLead"));
    const ok =
      Boolean(accountId && studentId && previousLead) && (await transferSupervision(env.DB, user, studentId, previousLead, accountId));
    return feedback(ok, "Supervision transferred.", "The supervisor or thesis changed. Refresh the team and try again.", studentId);
  }
  if (action === "create-account" || action === "update-account") {
    const rights = readRights(form);
    if (!rights) return feedback(false, "", "Enter an account name of up to 100 characters and select thesis access.");
    if (action === "update-account") {
      const ok = Boolean(accountId && version) && (await updateManagedAccount(env.DB, user, accountId, version, rights));
      return feedback(
        ok,
        "Account updated.",
        "Update unavailable. Use a unique name, keep an active administrator, and transfer supervised theses before removing supervision rights. Refresh for the latest account.",
      );
    }
    const hash = await newPasswordHash(form);
    if (!hash) return feedback(false, "", "Use a single-line password of at least 15 characters and at most 1024 UTF-8 bytes.");
    return feedback(
      await createManagedAccount(env.DB, user, rights, hash),
      "Account created.",
      "Account unavailable. Choose a unique account name.",
    );
  }
  if (action === "reset-password" && accountId && version) {
    const hash = await newPasswordHash(form);
    if (!hash) return feedback(false, "", "Use a single-line password of at least 15 characters and at most 1024 UTF-8 bytes.");
    return feedback(
      await resetManagedPassword(env.DB, user, accountId, version, hash),
      "Password reset. Existing sessions and agent tokens have been revoked.",
      "Refresh the account and try again.",
    );
  }
  if ((action === "disable-account" || action === "enable-account") && accountId && version) {
    const enable = action === "enable-account";
    const ok = await changeAccountStatus(env.DB, user, accountId, version, enable);
    return feedback(
      ok,
      enable ? "Account enabled." : "Account disabled. Advisor assignments and agent access have been removed.",
      "Change unavailable. Keep an active administrator and transfer all supervised theses before disabling their account. Refresh for the latest account.",
    );
  }
  if (action === "delete-account" && accountId && version) {
    return feedback(
      await deleteManagedAccount(env.DB, user, accountId, version),
      "Account permanently deleted.",
      "Deletion unavailable. Transfer all supervised theses, disable the account, and refresh its details.",
    );
  }
  return feedback(false, "", "Choose an available access action.");
}

export async function handleAccessManagement(request: Request, env: Env, user: SessionUser): Promise<Response> {
  if (!user.isAdmin && !(user.canSupervise && user.role === "editor")) return forbidden();
  if (request.method === "POST") return await handleAccessChange(request, env, user);
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, POST" } });
  const url = new URL(request.url);
  const [theses, accounts] = await Promise.all([listManagedTheses(env.DB, user), user.isAdmin ? listManagedAccounts(env.DB, user) : []]);
  const thesis = theses.find((entry) => entry.id === id(url.searchParams.get("studentId"))) || null;
  if (url.searchParams.has("studentId") && !thesis)
    return new Response("Thesis unavailable", { status: 404, headers: { "Cache-Control": "no-store" } });
  const advisors = thesis?.supervisor_id ? await getAdvisorChoices(env.DB, user, thesis.id) : { assigned: [], available: [] };
  return htmlResponse(
    renderAccessManagement(user, theses, thesis, accounts, advisors, url.searchParams.get("notice"), url.searchParams.get("error")),
  );
}
