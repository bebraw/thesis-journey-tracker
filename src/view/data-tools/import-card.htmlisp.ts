import { raw } from "../../htmlisp";
import {
  DANGER_PANEL,
  DANGER_TEXT,
  DANGER_TITLE,
  FIELD_CONTROL_SM,
  FORM_LABEL,
  MUTED_TEXT,
  SUBTLE_TEXT,
  renderButton,
  renderCard,
} from "../../ui";
import { renderView } from "../shared.htmlisp";

export function renderImportCard(replaceImportEnabled: boolean): string {
  return renderCard(
    renderView(
      `<h2 class="text-lg font-semibold">Import backup</h2>
      <p &class="subtleText" &children="description"></p>
      <form action="/actions/import-json" method="post" enctype="multipart/form-data" class="mt-panel-sm space-y-stack-xs">
        <label &class="formLabelClass">
          <span>JSON file</span>
          <input
            type="file"
            name="importFile"
            accept="application/json,.json"
            required="required"
            &class="fieldClass"
          />
        </label>
        <label &class="formLabelClass">
          <span>Import mode</span>
          <select name="mode" &class="fieldClass">
            <option value="append">Append imported students and logs</option>
            <fragment &children="replaceOptionHtml"></fragment>
          </select>
        </label>
        <fragment &children="replacementControlsHtml"></fragment>
        <fragment &children="replacementStateHtml"></fragment>
        <fragment &children="submitButton"></fragment>
      </form>`,
      {
        subtleText: `mt-1 ${SUBTLE_TEXT}`,
        description:
          replaceImportEnabled
            ? "Import a JSON file previously exported from Thesis Journey Tracker. Append mode is the safe default, while replacement mode is meant for deliberate full restores."
            : "Import a JSON file previously exported from Thesis Journey Tracker. Append mode is the safe default for bringing records into an existing dataset.",
        formLabelClass: FORM_LABEL,
        fieldClass: `mt-1 ${FIELD_CONTROL_SM}`,
        replaceOptionHtml: raw(replaceImportEnabled ? '<option value="replace">Replace all current students and logs</option>' : ""),
        replacementControlsHtml: raw(
          replaceImportEnabled
            ? `<label class="flex items-start gap-badge-x rounded-control border border-app-line p-control-y text-sm dark:border-app-line-dark">
                <input type="checkbox" name="confirmReplace" value="yes" class="mt-1 h-4 w-4 rounded-sm border-app-field text-app-brand focus:ring-app-brand dark:border-app-field-dark" />
                <span>Allow replacement mode to delete the current dataset before importing.</span>
              </label>
              <div class="${DANGER_PANEL}">
                <h3 class="${DANGER_TITLE}">Replacement warning</h3>
                <p class="${DANGER_TEXT}">
                  Replacement mode is intended for deliberate recovery work. The import now runs as a single batch so a failed restore leaves existing data untouched.
                </p>
              </div>`
            : "",
        ),
        replacementStateHtml: raw(
          replaceImportEnabled
            ? ""
            : `<div class="rounded-control border border-app-line p-control-y px-control-x text-sm ${MUTED_TEXT} dark:border-app-line-dark">
                Full replacement restore is disabled in this environment. Re-enable it only when you are intentionally performing a recovery restore.
              </div>`,
        ),
        submitButton: raw(renderButton({
          label: "Import JSON file",
          type: "submit",
          variant: "primaryBlock",
        })),
      },
    ),
  );
}
