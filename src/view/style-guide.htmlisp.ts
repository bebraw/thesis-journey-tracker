import {
  FIELD_CONTROL_SM,
  FORM_LABEL,
  MEETING_STATUS_BADGE_CLASS_MAP,
  MUTED_TEXT_XS,
  PAGE_WRAP,
  STATUS_BADGE,
  SUBTLE_TEXT,
  renderBadge,
  renderButton,
  renderCard,
  renderCompactCard,
  renderInputField,
  renderSelectField,
  renderTextareaField,
  type SelectOption,
} from "../ui";
import { escapeHtml } from "../formatting";
import { THEME_TOGGLE_SCRIPT, renderAuthedPageHeader, renderDocument, renderView } from "./shared.htmlisp";
import { DEGREE_TYPES } from "../students";
import type { ViewerContext } from "./types";

export function renderStyleGuidePage(viewer: ViewerContext): string {
  const sampleDegreeOptions: SelectOption[] = DEGREE_TYPES.map((degree) => ({
    label: degree.label,
    value: degree.id,
  }));

  const buttonsCard = renderCard(
    renderView(
      `<h2 class="text-lg font-semibold">Buttons</h2>
      <p &class="(get props subtleText)" &children="(get props description)"></p>
      <div class="mt-panel-sm flex flex-wrap gap-stack-xs">
        <noop &children="(get props primaryButton)"></noop>
        <noop &children="(get props neutralButton)"></noop>
        <noop &children="(get props inlineButton)"></noop>
      </div>
      <div class="mt-panel-sm grid gap-stack-xs sm:grid-cols-2">
        <noop &children="(get props primaryBlockButton)"></noop>
        <noop &children="(get props successBlockButton)"></noop>
        <noop &children="(get props dangerBlockButton)"></noop>
      </div>`,
      {
        subtleText: escapeHtml(`mt-1 ${SUBTLE_TEXT}`),
        description: escapeHtml("Primary actions, supporting actions, and destructive actions all come from the same helper."),
        primaryButton: renderButton({
          label: "Primary",
          href: "#",
          variant: "primary",
        }),
        neutralButton: renderButton({
          label: "Neutral",
          href: "#",
          variant: "neutral",
        }),
        inlineButton: renderButton({
          label: "Inline",
          href: "#",
          variant: "inline",
        }),
        primaryBlockButton: renderButton({
          label: "Primary Block",
          type: "button",
          variant: "primaryBlock",
        }),
        successBlockButton: renderButton({
          label: "Success Block",
          type: "button",
          variant: "successBlock",
        }),
        dangerBlockButton: renderButton({
          label: "Danger Block",
          type: "button",
          variant: "dangerBlock",
        }),
      },
    ),
  );

  const badgesCard = renderCard(
    renderView(
      `<h2 class="text-lg font-semibold">Badges</h2>
      <p &class="(get props subtleText)" &children="(get props description)"></p>
      <div class="mt-panel-sm flex flex-wrap gap-stack-xs">
        <noop &children="(get props degreeBadge)"></noop>
        <noop &children="(get props mockBadge)"></noop>
        <noop &children="(get props countBadge)"></noop>
        <span &class="(get props scheduledBadgeClass)">Scheduled</span>
        <span &class="(get props overdueBadgeClass)">Overdue</span>
      </div>`,
      {
        subtleText: escapeHtml(`mt-1 ${SUBTLE_TEXT}`),
        description: escapeHtml("Badges keep metadata visually consistent across tables, cards, and logs."),
        degreeBadge: renderBadge({ label: "MSc" }),
        mockBadge: renderBadge({ label: "Mock", variant: "mock" }),
        countBadge: renderBadge({ label: "12", variant: "count" }),
        scheduledBadgeClass: escapeHtml(`${STATUS_BADGE} ${MEETING_STATUS_BADGE_CLASS_MAP.scheduled}`),
        overdueBadgeClass: escapeHtml(`${STATUS_BADGE} ${MEETING_STATUS_BADGE_CLASS_MAP.overdue}`),
      },
    ),
  );

  const formFieldsCard = renderCard(
    renderView(
      `<h2 class="text-lg font-semibold">Form Fields</h2>
      <p &class="(get props subtleText)" &children="(get props description)"></p>
      <form class="mt-panel-sm grid grid-cols-1 gap-stack-xs sm:grid-cols-2">
        <noop &children="(get props studentNameField)"></noop>
        <noop &children="(get props degreeField)"></noop>
        <noop &children="(get props topicField)"></noop>
        <noop &children="(get props notesField)"></noop>
      </form>`,
      {
        subtleText: escapeHtml(`mt-1 ${SUBTLE_TEXT}`),
        description: escapeHtml(
          "Inputs, selects, and textareas are rendered from small wrapper functions so labels and spacing stay aligned.",
        ),
        studentNameField: renderInputField({
          label: "Student name",
          value: "Ada Lovelace",
          className: FIELD_CONTROL_SM,
        }),
        degreeField: renderSelectField({
          label: "Degree type",
          options: sampleDegreeOptions,
          value: "msc",
          className: FIELD_CONTROL_SM,
        }),
        topicField: renderInputField({
          label: "Thesis topic",
          value: "Supervision dashboard usability",
          className: FIELD_CONTROL_SM,
          wrapperClassName: `${FORM_LABEL} sm:col-span-2`,
        }),
        notesField: renderTextareaField({
          label: "Advisor notes",
          value: "This textarea uses the same label and border patterns as the forms in the app.",
          className: FIELD_CONTROL_SM,
          wrapperClassName: `${FORM_LABEL} sm:col-span-2`,
        }),
      },
    ),
  );

  const surfacesCard = renderCard(
    renderView(
      `<h2 class="text-lg font-semibold">Surfaces</h2>
      <p &class="(get props subtleText)" &children="(get props description)"></p>
      <div class="mt-panel-sm grid gap-panel-sm">
        <noop &children="(get props compactCard)"></noop>
        <noop &children="(get props standardCard)"></noop>
      </div>`,
      {
        subtleText: escapeHtml(`mt-1 ${SUBTLE_TEXT}`),
        description: escapeHtml("Cards help sections feel consistent while still allowing different densities."),
        compactCard: renderCompactCard(
          renderView(
            `<h3 class="text-sm font-semibold">Compact Card</h3>
            <p &class="(get props mutedTextXs)" &children="(get props description)"></p>`,
            {
              mutedTextXs: escapeHtml(`mt-1 ${MUTED_TEXT_XS}`),
              description: escapeHtml("Used for metrics and lane columns."),
            },
          ),
        ),
        standardCard: renderCard(
          renderView(
            `<h3 class="text-sm font-semibold">Standard Card</h3>
            <p &class="(get props subtleText)" &children="(get props description)"></p>`,
            {
              subtleText: escapeHtml(`mt-1 ${SUBTLE_TEXT}`),
              description: escapeHtml("Used for larger panels like the student editor and form pages."),
            },
          ),
          "p-panel-sm",
        ),
      },
    ),
  );

  const bodyContent = renderView(
    `<div &class="(get props pageWrap)">
      <noop &children="(get props headerHtml)"></noop>
      <section class="grid grid-cols-1 gap-stack xl:grid-cols-2">
        <noop &children="(get props buttonsCard)"></noop>
        <noop &children="(get props badgesCard)"></noop>
      </section>
      <section class="grid grid-cols-1 gap-stack xl:grid-cols-2">
        <noop &children="(get props formFieldsCard)"></noop>
        <noop &children="(get props surfacesCard)"></noop>
      </section>
    </div>
    <noop &children="(get props themeToggleScript)"></noop>`,
    {
      pageWrap: escapeHtml(PAGE_WRAP),
      headerHtml: renderAuthedPageHeader(
        "Style Guide",
        "Reusable UI patterns for buttons, badges, fields, and surfaces.",
        `${renderButton({
          label: "Dashboard",
          href: "/",
          variant: "neutral",
        })}${renderButton({
          label: "Data tools",
          href: "/data-tools",
          variant: "neutral",
        })}${renderButton({
          label: "Add student",
          href: "/students/new",
          variant: "primary",
        })}`,
        viewer,
      ),
      buttonsCard,
      badgesCard,
      formFieldsCard,
      surfacesCard,
      themeToggleScript: THEME_TOGGLE_SCRIPT,
    },
  );

  return renderDocument("Thesis Journey Tracker - Style Guide", bodyContent);
}
