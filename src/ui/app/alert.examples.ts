import { raw, renderEscapedHTMLisp } from "../../htmlisp";
import type { UIExampleSection } from "../examples";
import { renderButton } from "../foundation";
import { ALERT_CLASS_MAP, ALERT_TOAST_ERROR, ALERT_TOAST_SUCCESS } from "../styles";

export function getAlertExamplesSection(): UIExampleSection {
  return {
    id: "alerts",
    scope: "app",
    title: "Alerts & Flash Messages",
    description: "Inline notices and dashboard toasts share the same semantic success and error palette, but use different density and emphasis.",
    whenToUse: "Use inline alerts for page-level feedback near the content flow, and toast treatments for transient dashboard events.",
    avoidFor: "Avoid stacking too many alerts at once or using toast styling for information that users need to reread later.",
    contentHtml: renderEscapedHTMLisp(
      `<div class="mt-panel-sm grid gap-panel-sm lg:grid-cols-2">
        <div class="space-y-stack-xs">
          <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-app-text-muted dark:text-app-text-muted-dark">Inline alerts</p>
          <p role="status" &class="successAlertClass">Backup completed successfully.</p>
          <p role="alert" &class="errorAlertClass">Import failed because the selected file is not valid JSON.</p>
        </div>
        <div class="space-y-stack-xs">
          <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-app-text-muted dark:text-app-text-muted-dark">Dashboard toasts</p>
          <div class="flex max-w-sm flex-col gap-stack-xs">
            <div role="status" aria-live="polite" &class="successToastClass">
              <p class="min-w-0 flex-1">Schedule synced from Google Calendar.</p>
              <fragment &children="dismissButtonHtml"></fragment>
            </div>
            <div role="alert" aria-live="assertive" &class="errorToastClass">
              <p class="min-w-0 flex-1">Could not send invitation because the student email is missing.</p>
              <fragment &children="dismissButtonHtml"></fragment>
            </div>
          </div>
        </div>
      </div>`,
      {
        successAlertClass: ALERT_CLASS_MAP.success,
        errorAlertClass: ALERT_CLASS_MAP.error,
        successToastClass: ALERT_TOAST_SUCCESS,
        errorToastClass: ALERT_TOAST_ERROR,
        dismissButtonHtml: raw(renderButton({
          label: "Dismiss",
          type: "button",
          variant: "inline",
          className: "shrink-0",
        })),
      },
    ),
  };
}
