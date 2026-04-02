import { raw, renderEscapedHTMLisp } from "../../htmlisp";
import type { UIExampleSection } from "../examples";
import {
  DANGER_PANEL_COMPACT,
  DANGER_TEXT_SM,
  DANGER_TITLE_SM,
  EMPTY_STATE_CARD,
  TOGGLE_BUTTON_PANEL,
  TOGGLE_GROUP_SEGMENTED,
} from "../styles";
import { renderDangerPanel } from "./danger-panel.htmlisp";
import { renderDisclosure } from "./disclosure.htmlisp";
import { renderInsetCard } from "./card.htmlisp";
import { renderMetadataList } from "./metadata-list.htmlisp";
import { renderSectionHeader } from "./section-header.htmlisp";
import { renderToggleGroup } from "./toggle-group.htmlisp";

export function getPatternExamplesSection(): UIExampleSection {
  return {
    title: "Application Patterns",
    description: "These higher-level patterns are the preferred building blocks for dashboard sections and tool panels.",
    contentHtml: renderEscapedHTMLisp(
      `<div class="mt-panel-sm grid gap-panel-sm">
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
        <fragment &children="dangerPanelHtml"></fragment>
        <fragment &children="disclosureHtml"></fragment>
      </div>`,
      {
        insetCard: raw(renderInsetCard(
          renderEscapedHTMLisp(
            `<div>
              <fragment &children="sectionHeader"></fragment>
              <p class="mt-stack-xs text-sm text-app-text-soft dark:text-app-text-soft-dark">
                Inset cards sit inside larger surfaces to separate tools, filters, or secondary workflows.
              </p>
            </div>`,
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
        emptyStateClass: EMPTY_STATE_CARD,
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
        dangerPanelHtml: raw(renderDangerPanel({
          title: "Compact Danger Panel",
          text: "Use the compact danger treatment for destructive secondary actions inside larger cards.",
          className: DANGER_PANEL_COMPACT,
          titleClassName: DANGER_TITLE_SM,
          textClassName: DANGER_TEXT_SM,
        })),
        disclosureHtml: raw(renderDisclosure({
          summary: "Disclosure pattern",
          content:
            '<p class="text-sm text-app-text-muted dark:text-app-text-muted-dark">Use disclosures for help text and secondary explanations that should stay available without dominating the page.</p>',
        })),
      },
    ),
  };
}
