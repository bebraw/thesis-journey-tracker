import {
  DANGER_PANEL,
  DANGER_TEXT,
  DANGER_TITLE,
  FIELD_CONTROL_SM,
  FORM_LABEL,
  MUTED_TEXT,
  PAGE_WRAP_NARROW,
  SUBTLE_TEXT,
  renderButton,
  renderCard,
} from "../ui";
import { escapeHtml } from "../utils";
import { THEME_TOGGLE_SCRIPT, renderAuthedPageHeader, renderDocument, renderFlashMessages, renderView } from "./shared.htmlisp";
import type { DataToolsPageData } from "./types";

export function renderDataToolsPage(data: DataToolsPageData): string {
  const { viewer, notice, error, studentCount, logCount, replaceImportEnabled } = data;

  const exportCard = renderCard(
    renderView(
      `<h2 class="text-lg font-semibold">Export backup</h2>
      <p &class="(get props subtleText)" &children="(get props description)"></p>
      <p &class="(get props metaText)" &children="(get props currentDataText)"></p>
      <div class="mt-panel-sm flex flex-wrap gap-stack-xs">
        <noop &children="(get props exportButton)"></noop>
        <noop &children="(get props professorReportButton)"></noop>
      </div>`,
      {
        subtleText: escapeHtml(`mt-1 ${SUBTLE_TEXT}`),
        metaText: escapeHtml(`mt-panel-sm ${MUTED_TEXT}`),
        description: escapeHtml("Download all students and meeting logs as a JSON backup file."),
        currentDataText: escapeHtml(`Current data: ${studentCount} students and ${logCount} meeting logs.`),
        exportButton: renderButton({
          label: "Download JSON export",
          href: "/actions/export-json",
          variant: "primary",
        }),
        professorReportButton: renderButton({
          label: "Download email-ready report",
          href: "/actions/export-professor-report",
          variant: "neutral",
        }),
      },
    ),
  );

  const importCard = renderCard(
    renderView(
      `<h2 class="text-lg font-semibold">Import backup</h2>
      <p &class="(get props subtleText)" &children="(get props description)"></p>
      <form action="/actions/import-json" method="post" enctype="multipart/form-data" class="mt-panel-sm space-y-stack-xs">
        <label &class="(get props formLabelClass)">
          <span>JSON file</span>
          <input
            type="file"
            name="importFile"
            accept="application/json,.json"
            required="required"
            &class="(get props fieldClass)"
          />
        </label>
        <label &class="(get props formLabelClass)">
          <span>Import mode</span>
          <select name="mode" &class="(get props fieldClass)">
            <option value="append">Append imported students and logs</option>
            <noop &children="(get props replaceOptionHtml)"></noop>
          </select>
        </label>
        <noop &children="(get props replacementControlsHtml)"></noop>
        <noop &children="(get props replacementStateHtml)"></noop>
        <noop &children="(get props submitButton)"></noop>
      </form>`,
      {
        subtleText: escapeHtml(`mt-1 ${SUBTLE_TEXT}`),
        description: escapeHtml(
          replaceImportEnabled
            ? "Import a JSON file previously exported from Thesis Journey Tracker. Append mode is the safe default, while replacement mode is meant for deliberate full restores."
            : "Import a JSON file previously exported from Thesis Journey Tracker. Append mode is the safe default for bringing records into an existing dataset.",
        ),
        formLabelClass: escapeHtml(FORM_LABEL),
        fieldClass: escapeHtml(`mt-1 ${FIELD_CONTROL_SM}`),
        replaceOptionHtml: replaceImportEnabled ? '<option value="replace">Replace all current students and logs</option>' : "",
        replacementControlsHtml: replaceImportEnabled
          ? `<label class="flex items-start gap-badge-x rounded-control border border-app-line p-control-y text-sm dark:border-app-line-dark">
              <input type="checkbox" name="confirmReplace" value="yes" class="mt-1 h-4 w-4 rounded border-app-field text-app-brand focus:ring-app-brand dark:border-app-field-dark" />
              <span>Allow replacement mode to delete the current dataset before importing.</span>
            </label>
            <div class="${escapeHtml(DANGER_PANEL)}">
              <h3 class="${escapeHtml(DANGER_TITLE)}">Replacement warning</h3>
              <p class="${escapeHtml(DANGER_TEXT)}">
                Replacement mode is intended for deliberate recovery work. The import now runs as a single batch so a failed restore leaves existing data untouched.
              </p>
            </div>`
          : "",
        replacementStateHtml: replaceImportEnabled
          ? ""
          : `<div class="${escapeHtml(`rounded-control border border-app-line p-control-y px-control-x text-sm ${MUTED_TEXT} dark:border-app-line-dark`)}">
              Full replacement restore is disabled in this environment. Re-enable it only when you are intentionally performing a recovery restore.
            </div>`,
        submitButton: renderButton({
          label: "Import JSON file",
          type: "submit",
          variant: "primaryBlock",
        }),
      },
    ),
  );

  const bodyContent = renderView(
    `<div &class="(get props pageWrap)">
      <noop &children="(get props headerHtml)"></noop>
      <noop &children="(get props flashHtml)"></noop>
      <div class="grid grid-cols-1 gap-stack">
        <noop &children="(get props exportCard)"></noop>
        <noop &children="(get props importCard)"></noop>
      </div>
    </div>
    <noop &children="(get props themeToggleScript)"></noop>`,
    {
      pageWrap: escapeHtml(PAGE_WRAP_NARROW),
      headerHtml: renderAuthedPageHeader(
        "Data Tools",
        "Back up or restore the thesis tracking dataset as JSON.",
        `${renderButton({
          label: "Dashboard",
          href: "/",
          variant: "neutral",
        })}${renderButton({
          label: "Add student",
          href: "/students/new",
          variant: "primary",
        })}`,
        viewer,
      ),
      flashHtml: renderFlashMessages(notice, error),
      exportCard,
      importCard,
      themeToggleScript: THEME_TOGGLE_SCRIPT,
    },
  );

  return renderDocument("Thesis Journey Tracker - Data Tools", bodyContent);
}
