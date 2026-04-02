import {
  EMPTY_STATE_CARD,
  FIELD_CONTROL_SM,
  FORM_LABEL,
  MEETING_STATUS_BADGE_CLASS_MAP,
  MUTED_TEXT_XS,
  PAGE_WRAP,
  STATUS_BADGE,
  SUBTLE_TEXT,
  TOGGLE_BUTTON_PANEL,
  TOGGLE_GROUP_SEGMENTED,
  renderBadge,
  renderButton,
  renderCard,
  renderCompactCard,
  renderDisclosure,
  renderInsetCard,
  renderInputField,
  renderMetadataList,
  renderSectionHeader,
  renderSelectField,
  renderToggleGroup,
  renderTextareaField,
  type SelectOption,
} from "../ui";
import { raw } from "../htmlisp";
import { renderAuthedPageDocument, renderView } from "./shared.htmlisp";
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
      <p &class="subtleText" &children="description"></p>
      <div class="mt-panel-sm flex flex-wrap gap-stack-xs">
        <fragment &children="primaryButton"></fragment>
        <fragment &children="neutralButton"></fragment>
        <fragment &children="inlineButton"></fragment>
      </div>
      <div class="mt-panel-sm grid gap-stack-xs sm:grid-cols-2">
        <fragment &children="primaryBlockButton"></fragment>
        <fragment &children="successBlockButton"></fragment>
        <fragment &children="dangerBlockButton"></fragment>
      </div>`,
      {
        subtleText: `mt-1 ${SUBTLE_TEXT}`,
        description: "Primary actions, supporting actions, and destructive actions all come from the same helper.",
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
  );

  const badgesCard = renderCard(
    renderView(
      `<h2 class="text-lg font-semibold">Badges</h2>
      <p &class="subtleText" &children="description"></p>
      <div class="mt-panel-sm flex flex-wrap gap-stack-xs">
        <fragment &children="degreeBadge"></fragment>
        <fragment &children="mockBadge"></fragment>
        <fragment &children="countBadge"></fragment>
        <span &class="scheduledBadgeClass">Scheduled</span>
        <span &class="overdueBadgeClass">Overdue</span>
      </div>`,
      {
        subtleText: `mt-1 ${SUBTLE_TEXT}`,
        description: "Badges keep metadata visually consistent across tables, cards, and logs.",
        degreeBadge: raw(renderBadge({ label: "MSc" })),
        mockBadge: raw(renderBadge({ label: "Mock", variant: "mock" })),
        countBadge: raw(renderBadge({ label: "12", variant: "count" })),
        scheduledBadgeClass: `${STATUS_BADGE} ${MEETING_STATUS_BADGE_CLASS_MAP.scheduled}`,
        overdueBadgeClass: `${STATUS_BADGE} ${MEETING_STATUS_BADGE_CLASS_MAP.overdue}`,
      },
    ),
  );

  const formFieldsCard = renderCard(
    renderView(
      `<h2 class="text-lg font-semibold">Form Fields</h2>
      <p &class="subtleText" &children="description"></p>
      <form class="mt-panel-sm grid grid-cols-1 gap-stack-xs sm:grid-cols-2">
        <fragment &children="studentNameField"></fragment>
        <fragment &children="degreeField"></fragment>
        <fragment &children="topicField"></fragment>
        <fragment &children="notesField"></fragment>
      </form>`,
      {
        subtleText: `mt-1 ${SUBTLE_TEXT}`,
        description:
          "Inputs, selects, and textareas are rendered from small wrapper functions so labels and spacing stay aligned.",
        studentNameField: raw(renderInputField({
          label: "Student name",
          value: "Ada Lovelace",
          className: FIELD_CONTROL_SM,
        })),
        degreeField: raw(renderSelectField({
          label: "Degree type",
          options: sampleDegreeOptions,
          value: "msc",
          className: FIELD_CONTROL_SM,
        })),
        topicField: raw(renderInputField({
          label: "Thesis topic",
          value: "Supervision dashboard usability",
          className: FIELD_CONTROL_SM,
          wrapperClassName: `${FORM_LABEL} sm:col-span-2`,
        })),
        notesField: raw(renderTextareaField({
          label: "Advisor notes",
          value: "This textarea uses the same label and border patterns as the forms in the app.",
          className: FIELD_CONTROL_SM,
          wrapperClassName: `${FORM_LABEL} sm:col-span-2`,
        })),
      },
    ),
  );

  const surfacesCard = renderCard(
    renderView(
      `<h2 class="text-lg font-semibold">Surfaces</h2>
      <p &class="subtleText" &children="description"></p>
      <div class="mt-panel-sm grid gap-panel-sm">
        <fragment &children="compactCard"></fragment>
        <fragment &children="standardCard"></fragment>
      </div>`,
      {
        subtleText: `mt-1 ${SUBTLE_TEXT}`,
        description: "Cards help sections feel consistent while still allowing different densities.",
        compactCard: raw(renderCompactCard(
          renderView(
            `<h3 class="text-sm font-semibold">Compact Card</h3>
            <p &class="mutedTextXs" &children="description"></p>`,
            {
              mutedTextXs: `mt-1 ${MUTED_TEXT_XS}`,
              description: "Used for metrics and lane columns.",
            },
          ),
        )),
        standardCard: raw(renderCard(
          renderView(
            `<h3 class="text-sm font-semibold">Standard Card</h3>
            <p &class="subtleText" &children="description"></p>`,
            {
              subtleText: `mt-1 ${SUBTLE_TEXT}`,
              description: "Used for larger panels like the student editor and form pages.",
            },
          ),
          "p-panel-sm",
        )),
      },
    ),
  );

  const patternsCard = renderCard(
    renderView(
      `<h2 class="text-lg font-semibold">Application Patterns</h2>
      <p &class="subtleText" &children="description"></p>
      <div class="mt-panel-sm grid gap-panel-sm">
        <fragment &children="insetCard"></fragment>
        <div class="space-y-stack-xs">
          <fragment &children="sectionHeader"></fragment>
          <p &class="emptyStateClass">Use the shared empty-state treatment when a section has no content yet.</p>
        </div>
        <div class="space-y-stack-xs">
          <fragment &children="segmentedToggleHtml"></fragment>
          <fragment &children="panelToggleHtml"></fragment>
        </div>
        <fragment &children="metadataListHtml"></fragment>
        <fragment &children="disclosureHtml"></fragment>
      </div>`,
      {
        subtleText: `mt-1 ${SUBTLE_TEXT}`,
        description: "These higher-level patterns are the preferred building blocks for dashboard sections and tool panels.",
        insetCard: raw(renderInsetCard(
          renderView(
            `<fragment &children="sectionHeader"></fragment>
            <p class="mt-stack-xs text-sm text-app-text-soft dark:text-app-text-soft-dark">
              Inset cards sit inside larger surfaces to separate tools, filters, or secondary workflows.
            </p>`,
            {
              sectionHeader: raw(renderSectionHeader({
                title: "Inset Card",
                meta: "Secondary surface",
              })),
            },
          ),
        )),
        sectionHeader: raw(renderSectionHeader({
          title: "Section Header",
          meta: "Use concise metadata labels",
        })),
        segmentedToggleHtml: raw(renderToggleGroup({
          className: TOGGLE_GROUP_SEGMENTED,
          items: [
            { label: "List", pressed: true },
            { label: "Phases" },
          ],
        })),
        panelToggleHtml: raw(renderToggleGroup({
          className: "flex flex-wrap gap-badge-y",
          buttonClassName: TOGGLE_BUTTON_PANEL,
          items: [
            { label: "Edit" },
            { label: "History", meta: "12 entries", pressed: true },
          ],
        })),
        metadataListHtml: raw(renderMetadataList({
          items: [
            { label: "Target submission", value: "2026-06-30" },
            { label: "Next meeting", value: "Not booked" },
            { label: "Saved logs", value: "12" },
            { label: "Status", value: "Meeting soon" },
          ],
        })),
        emptyStateClass: EMPTY_STATE_CARD,
        disclosureHtml: raw(renderDisclosure({
          summary: "Disclosure pattern",
          content:
            '<p class="text-sm text-app-text-muted dark:text-app-text-muted-dark">Use disclosures for help text and secondary explanations that should stay available without dominating the page.</p>',
        })),
      },
    ),
  );

  return renderAuthedPageDocument({
    documentTitle: "Thesis Journey Tracker - Style Guide",
    headerTitle: "Style Guide",
    headerDescription: "Reusable UI patterns for buttons, badges, fields, and surfaces.",
    currentPage: "style-guide",
    viewer,
    pageWrapClass: PAGE_WRAP,
    showStyleGuide: true,
    flashKind: "none",
    sections: [
      `<section class="grid grid-cols-1 gap-stack xl:grid-cols-2">
        ${buttonsCard}
        ${badgesCard}
      </section>`,
      `<section class="grid grid-cols-1 gap-stack xl:grid-cols-2">
        ${formFieldsCard}
        ${surfacesCard}
      </section>`,
      `<section>${patternsCard}</section>`,
    ],
  });
}
