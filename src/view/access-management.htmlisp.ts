import type { SessionUser } from "../auth";
import type { AccountChoice, ManagedAccount, ManagedThesis } from "../auth/access-management";
import { raw } from "../htmlisp";
import {
  PAGE_WRAP_NARROW,
  renderButton,
  renderCard,
  renderDisclosure,
  renderInputField,
  renderSectionHeader,
  renderSelectField,
} from "../ui";
import { renderAuthedPageDocument, renderView } from "./shared.htmlisp";

function hidden(name: string, value: string | number): string {
  return renderView('<input type="hidden" &name="name" &value="value" />', { name, value: String(value) });
}

function post(
  action: string,
  fields: string,
  label: string,
  identifiers: Record<string, number> = {},
  variant: "neutral" | "dangerBlock" = "neutral",
): string {
  const ids = Object.entries(identifiers)
    .map(([name, value]) => hidden(name, value))
    .join("");
  return renderView(
    `<form method="post" action="/access" &aria-label="label" class="grid gap-3">
      <fragment &children="fields"></fragment><div &children="button"></div>
    </form>`,
    {
      label,
      fields: raw(hidden("action", action) + ids + fields),
      button: raw(renderButton({ label, type: "submit", variant })),
    },
  );
}

function checkbox(name: string, label: string, value: string, checked = false): string {
  return renderView(
    `<label class="flex items-center gap-2 text-sm"><input type="checkbox" &name="name" &value="value" &checked="checked" />
    <span &children="label"></span></label>`,
    { name, label, value, checked },
  );
}

function text(message: string): string {
  return renderView('<p class="text-sm text-app-text-soft dark:text-app-text-soft-dark" &children="message"></p>', { message });
}

function accountSelect(label: string, accounts: AccountChoice[]): string {
  return renderSelectField({
    label,
    name: "accountId",
    value: "",
    attrs: { required: true },
    options: [
      { value: "", label: "Select an account" },
      ...accounts.map((account) => ({ value: String(account.id), label: account.name })),
    ],
  });
}

function passwordField(label: string): string {
  return renderInputField({
    label,
    name: "password",
    type: "password",
    required: true,
    attrs: { minlength: "15", autocomplete: "new-password" },
  });
}

function accountFields(account?: ManagedAccount): string {
  const name = renderInputField({
    name: "name",
    label: "Account name",
    required: true,
    value: account?.name || "",
    attrs: { pattern: ".{1,100}", title: "Use 1 to 100 characters.", autocomplete: "off" },
  });
  const access = renderSelectField({
    name: "role",
    label: "Thesis access",
    value: account?.can_supervise && account.role === "editor" ? "supervisor" : account?.role || "readonly",
    options: [
      { value: "readonly", label: "Advisor · read only" },
      { value: "editor", label: "Advisor · read and edit" },
      { value: "supervisor", label: "Supervisor · read and edit" },
    ],
  });
  return name + access + checkbox("isAdmin", "Administrator", "yes", account?.is_admin === 1);
}

function accountSection(accounts: ManagedAccount[]): string {
  const create = renderDisclosure({
    summary: "Create an account",
    content: post(
      "create-account",
      accountFields() + passwordField("Password") + text("Use a password of at least 15 characters."),
      "Create account",
    ),
  });
  const entries = accounts.map((account) => {
    const identifiers = { accountId: account.id, version: account.session_version };
    const status = account.disabled_at ? "Disabled" : account.is_admin ? "Administrator" : account.can_supervise ? "Supervisor" : "Advisor";
    const forms = [
      post("update-account", accountFields(account), "Save account", identifiers),
      renderDisclosure({
        summary: "Reset password",
        content: post(
          "reset-password",
          passwordField("New password") + text("Resetting the password signs this account out and revokes its agent tokens."),
          "Reset password",
          identifiers,
        ),
      }),
      account.disabled_at
        ? post("enable-account", "", "Enable account", identifiers)
        : renderDisclosure({
            summary: "Disable account",
            content: post(
              "disable-account",
              text(
                "Disabling this account signs it out, removes advisor assignments, and revokes agent tokens. Transfer any supervised theses first.",
              ),
              "Disable account",
              identifiers,
            ),
          }),
    ];
    if (account.disabled_at) {
      forms.push(
        renderDisclosure({
          summary: "Delete account",
          content: post(
            "delete-account",
            text(`Permanently delete the login and agent tokens for ${account.name}? Theses and their history will be kept.`),
            "Permanently delete account",
            identifiers,
            "dangerBlock",
          ),
        }),
      );
    }
    return renderDisclosure({ summary: `${account.name} · ${status}`, content: forms.join(""), contentClassName: "space-y-4" });
  });
  return renderCard(renderSectionHeader({ title: "Accounts" }) + create + entries.join(""), "space-y-3");
}

function thesisLabel(thesis: ManagedThesis): string {
  return `${thesis.name} · #${thesis.id}${thesis.archived_at ? " · archived" : ""}`;
}

function unassignedTheses(theses: ManagedThesis[], supervisors: ManagedAccount[]): string {
  const unassigned = theses.filter((item) => !item.supervisor_id);
  if (!unassigned.length) return "";
  const checks = unassigned.map((entry) => checkbox("studentId", thesisLabel(entry), String(entry.id))).join("");
  const fields = renderView(
    '<fieldset class="space-y-2"><legend class="mb-2 text-sm font-medium">Theses to assign</legend><fragment &children="checks"></fragment></fieldset>',
    { checks: raw(checks) },
  );
  const content = supervisors.length
    ? post("assign-unowned", fields + accountSelect("Supervisor", supervisors), "Assign selected theses")
    : text("Give an account supervisor access before assigning these theses.");
  return renderCard(renderDisclosure({ summary: `Unassigned theses (${unassigned.length})`, content }), "space-y-3");
}

function teamSection(
  theses: ManagedThesis[],
  thesis: ManagedThesis | null,
  supervisors: ManagedAccount[],
  isAdmin: boolean,
  advisors: { assigned: AccountChoice[]; available: AccountChoice[] },
): string {
  const heading = renderSectionHeader({ title: "Thesis teams" });
  if (!theses.length) return renderCard(heading + text("No theses available to manage."), "space-y-3");
  const chooser = renderView(
    `<form method="get" action="/access" class="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
    <fragment &children="select"></fragment><fragment &children="open"></fragment></form>`,
    {
      select: raw(
        renderSelectField({
          label: "Thesis",
          name: "studentId",
          value: thesis ? String(thesis.id) : "",
          attrs: { required: true },
          options: [
            { value: "", label: "Select a thesis" },
            ...theses.map((entry) => ({ value: String(entry.id), label: thesisLabel(entry) })),
          ],
        }),
      ),
      open: raw(renderButton({ label: "Open team", type: "submit", variant: "neutral" })),
    },
  );
  const sections = [heading, chooser];
  if (thesis) {
    sections.push(renderSectionHeader({ title: thesis.name, meta: thesis.archived_at ? "Archived thesis" : "", headingLevel: 3 }));
    sections.push(text(thesis.supervisor_name ? `Supervisor · ${thesis.supervisor_name}` : "Awaiting a supervisor."));
    if (thesis.supervisor_id) {
      const remove = advisors.assigned
        .map((advisor) => post("remove-advisor", "", `Remove ${advisor.name}`, { studentId: thesis.id, accountId: advisor.id }))
        .join("");
      sections.push(renderSectionHeader({ title: "Advisors", headingLevel: 4 }));
      sections.push(remove || text("No advisors assigned."));
      if (advisors.available.length)
        sections.push(post("add-advisor", accountSelect("Advisor to add", advisors.available), "Add advisor", { studentId: thesis.id }));
    }
    if (isAdmin) {
      const others = supervisors.filter((account) => account.id !== thesis.supervisor_id);
      if (others.length) {
        sections.push(
          renderDisclosure({
            summary: thesis.supervisor_id ? "Transfer supervision" : "Assign a supervisor",
            content: thesis.supervisor_id
              ? post(
                  "transfer",
                  accountSelect("New supervisor", others) +
                    text("The previous supervisor loses access through this assignment. Other advisors stay assigned."),
                  "Transfer supervision",
                  { studentId: thesis.id, previousLead: thesis.supervisor_id },
                )
              : post("assign-unowned", accountSelect("Supervisor", others), "Assign supervisor", { studentId: thesis.id }),
          }),
        );
      }
    }
  }
  return renderCard(sections.join(""), "space-y-4");
}

export function renderAccessManagement(
  user: SessionUser,
  theses: ManagedThesis[],
  thesis: ManagedThesis | null,
  accounts: ManagedAccount[],
  advisors: { assigned: AccountChoice[]; available: AccountChoice[] },
  notice: string | null,
  error: string | null,
): string {
  const supervisors = accounts.filter((account) => account.can_supervise === 1 && account.role === "editor" && !account.disabled_at);
  const sections = [teamSection(theses, thesis, supervisors, user.isAdmin === true, advisors)];
  if (user.isAdmin) sections.push(unassignedTheses(theses, supervisors), accountSection(accounts));
  return renderAuthedPageDocument({
    documentTitle: "Access – Thesis Journey Tracker",
    headerTitle: "Access",
    headerDescription: "Manage thesis assignments and account rights.",
    currentPage: "access",
    viewer: user,
    pageWrapClass: PAGE_WRAP_NARROW,
    sections,
    notice,
    error,
  });
}
