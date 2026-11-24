import { raw } from "../../htmlisp";
import { FIELD_CONTROL_SM, PAGE_WRAP_NARROW, SUBTLE_TEXT, renderButton, renderCard, renderInputField, renderSelectField } from "../../ui";
import { renderAuthedPageDocument, renderView } from "../shared.htmlisp";
import type { ViewerContext } from "../types";

export interface BackupAccountChoice {
  id: number;
  name: string;
  supervises: boolean;
}

export function renderAccountMapping(
  viewer: ViewerContext,
  source: BackupAccountChoice[],
  local: BackupAccountChoice[],
  file: { name: string; digest: string; legacy: boolean },
  mode: "append" | "replace",
  error: string | null,
): string {
  const rows = source.map((sourceAccount) =>
    renderSelectField({
      label: `${sourceAccount.name} (backup ID ${sourceAccount.id}, ${sourceAccount.supervises ? "supervisor" : "advisor"})`,
      name: `map-${sourceAccount.id}`,
      attrs: { required: true },
      className: FIELD_CONTROL_SM,
      options: [
        { label: "Choose a local account", value: "" },
        ...local
          .filter((account) => !sourceAccount.supervises || account.supervises)
          .map((account) => ({ label: `${account.name} (ID ${account.id})`, value: String(account.id) })),
      ],
    }),
  );
  const form = renderView(
    `<form method="post" action="/actions/import-json" enctype="multipart/form-data" class="space-y-stack">
       <p &class="subtleText" &children="reason"></p>
       <input type="hidden" name="mappingDigest" &value="digest" />
       <input type="hidden" name="mode" &value="mode" />
       <input type="hidden" name="confirmReplace" &value="confirmReplace" />
       <div class="grid gap-stack-xs sm:grid-cols-2"><fragment &children="rows"></fragment></div>
       <fragment &children="fileField"></fragment>
       <p &class="subtleText" &children="effect"></p>
       <div class="flex flex-wrap gap-stack-xs"><fragment &children="submit"></fragment><fragment &children="cancel"></fragment></div>
     </form>`,
    {
      subtleText: SUBTLE_TEXT,
      reason: file.legacy
        ? "Version 2 backups do not identify their installation. Choose the local person who should receive each account’s thesis assignments."
        : "This backup comes from another installation. Choose the local person who should receive each account’s thesis assignments.",
      digest: file.digest,
      mode,
      confirmReplace: mode === "replace" ? "yes" : "",
      rows: raw(rows.join("")),
      fileField: raw(
        renderInputField({
          label: `Select ${file.name} again to confirm the same backup`,
          name: "importFile",
          type: "file",
          required: true,
          className: FIELD_CONTROL_SM,
          attrs: { accept: "application/json,.json" },
        }),
      ),
      effect:
        mode === "replace"
          ? "Confirming replaces all current student records and assignments."
          : "Confirming adds the students and grants these assignments.",
      submit: raw(
        renderButton({
          label: mode === "replace" ? "Confirm and replace students" : "Confirm and import",
          variant: "primary",
          type: "submit",
        }),
      ),
      cancel: raw(renderButton({ label: "Cancel", href: "/data-tools", variant: "neutral" })),
    },
  );
  return renderAuthedPageDocument({
    documentTitle: "Match backup accounts - Thesis Journey Tracker",
    headerTitle: "Match backup accounts",
    headerDescription: "Choose the local accounts for this import.",
    currentPage: "data-tools",
    pageWrapClass: PAGE_WRAP_NARROW,
    viewer,
    sections: [renderCard(form)],
    error,
  });
}
