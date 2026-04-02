import { raw, renderEscapedHTMLisp } from "../../htmlisp";
import type { UIExampleSection } from "../examples";
import { renderFieldShell } from "./field-shell.htmlisp";

export function getFieldShellExamplesSection(): UIExampleSection {
  return {
    title: "Field Shell",
    description: "Use the shared field shell when a control needs the standard label and spacing treatment without being a plain input element.",
    contentHtml: renderEscapedHTMLisp(
      `<div class="mt-panel-sm grid gap-stack-xs sm:grid-cols-2">
        <fragment &children="readonlySummaryField"></fragment>
        <fragment &children="customActionsField"></fragment>
      </div>`,
      {
        readonlySummaryField: raw(renderFieldShell(
          "Readonly summary",
          `<div class="mt-1 rounded-control border border-app-line bg-app-surface-soft/70 px-control-x py-control-y text-sm text-app-text-soft dark:border-app-line-dark dark:bg-app-surface-soft-dark/40 dark:text-app-text-soft-dark">
            No meeting booked yet. Use this wrapper for readonly values, token pickers, or embedded helper controls.
          </div>`,
        )),
        customActionsField: raw(renderFieldShell(
          "Inline actions",
          `<div class="mt-1 flex flex-wrap gap-badge-y">
            <button type="button" class="rounded-control border border-app-field bg-app-surface px-badge-pill-x py-badge-pill-y text-xs font-medium text-app-text shadow-sm dark:border-app-field-dark dark:bg-app-surface-dark dark:text-app-text-dark">Today</button>
            <button type="button" class="rounded-control border border-app-field bg-app-surface px-badge-pill-x py-badge-pill-y text-xs font-medium text-app-text shadow-sm dark:border-app-field-dark dark:bg-app-surface-dark dark:text-app-text-dark">+1 week</button>
            <button type="button" class="rounded-control border border-app-field bg-app-surface px-badge-pill-x py-badge-pill-y text-xs font-medium text-app-text shadow-sm dark:border-app-field-dark dark:bg-app-surface-dark dark:text-app-text-dark">Clear</button>
          </div>`,
        )),
      },
    ),
  };
}
