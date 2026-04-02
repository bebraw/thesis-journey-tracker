import { raw } from "../../htmlisp";
import {
  DANGER_PANEL_COMPACT,
  DANGER_TEXT_SM,
  DANGER_TITLE_SM,
  FIELD_CONTROL_SM,
  MUTED_TEXT,
  SUBTLE_TEXT,
  renderButton,
  renderCard,
  renderDangerPanel,
  renderInputField,
  renderSelectField,
} from "../../ui";
import { renderView } from "../shared.htmlisp";

export function renderImportCard(replaceImportEnabled: boolean): string {
  const fileFieldHtml = renderInputField({
    label: "JSON file",
    name: "importFile",
    type: "file",
    required: true,
    className: FIELD_CONTROL_SM,
    attrs: {
      accept: "application/json,.json",
    },
  });
  const modeFieldHtml = renderSelectField({
    label: "Import mode",
    name: "mode",
    className: FIELD_CONTROL_SM,
    options: [
      { label: "Append imported students and logs", value: "append" },
      ...(replaceImportEnabled ? [{ label: "Replace all current students and logs", value: "replace" }] : []),
    ],
  });

  return renderCard(
    renderView(
      `<h2 class="text-lg font-semibold">Import backup</h2>
      <p &class="subtleText" &children="description"></p>
      <form action="/actions/import-json" method="post" enctype="multipart/form-data" class="mt-panel-sm space-y-stack-xs">
        <fragment &children="fileFieldHtml"></fragment>
        <fragment &children="modeFieldHtml"></fragment>
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
        fileFieldHtml: raw(fileFieldHtml),
        modeFieldHtml: raw(modeFieldHtml),
        replacementControlsHtml: raw(
          replaceImportEnabled
            ? `<label class="flex items-start gap-badge-x rounded-control border border-app-line p-control-y text-sm dark:border-app-line-dark">
                <input type="checkbox" name="confirmReplace" value="yes" class="mt-1 h-4 w-4 rounded-sm border-app-field text-app-brand focus:ring-app-brand dark:border-app-field-dark" />
                <span>Allow replacement mode to delete the current dataset before importing.</span>
              </label>
              ${renderDangerPanel({
                title: "Replacement warning",
                text: "Replacement mode is intended for deliberate recovery work. The import now runs as a single batch so a failed restore leaves existing data untouched.",
                className: DANGER_PANEL_COMPACT,
                titleClassName: DANGER_TITLE_SM,
                textClassName: DANGER_TEXT_SM,
              })}`
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
