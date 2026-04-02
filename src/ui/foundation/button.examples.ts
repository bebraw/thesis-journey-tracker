import { raw, renderEscapedHTMLisp } from "../../htmlisp";
import type { UIExampleSection } from "../examples";
import { renderButton } from "./button.htmlisp";

export function getButtonExamplesSection(): UIExampleSection {
  return {
    id: "buttons",
    scope: "foundation",
    title: "Buttons",
    description: "Primary actions, supporting actions, and destructive actions all come from the same helper.",
    whenToUse: "Use these for explicit actions with clear hierarchy: neutral for secondary tasks, primary for the main action, and block variants for form submissions.",
    avoidFor: "Avoid using button variants as navigation chrome or status labels. Use badges or app-shell navigation patterns instead.",
    contentHtml: renderEscapedHTMLisp(
      `<div>
        <div class="mt-panel-sm flex flex-wrap gap-stack-xs">
          <fragment &children="primaryButton"></fragment>
          <fragment &children="neutralButton"></fragment>
          <fragment &children="inlineButton"></fragment>
        </div>
        <div class="mt-panel-sm grid gap-stack-xs sm:grid-cols-2">
          <fragment &children="primaryBlockButton"></fragment>
          <fragment &children="successBlockButton"></fragment>
          <fragment &children="dangerBlockButton"></fragment>
        </div>
      </div>`,
      {
        primaryButton: raw(renderButton({
          label: "Primary",
          href: "#",
          variant: "primary",
        })),
        neutralButton: raw(renderButton({
          label: "Neutral",
          href: "#",
          variant: "neutral",
        })),
        inlineButton: raw(renderButton({
          label: "Inline",
          href: "#",
          variant: "inline",
        })),
        primaryBlockButton: raw(renderButton({
          label: "Primary Block",
          type: "button",
          variant: "primaryBlock",
        })),
        successBlockButton: raw(renderButton({
          label: "Success Block",
          type: "button",
          variant: "successBlock",
        })),
        dangerBlockButton: raw(renderButton({
          label: "Danger Block",
          type: "button",
          variant: "dangerBlock",
        })),
      },
    ),
  };
}
