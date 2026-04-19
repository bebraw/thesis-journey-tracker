import { raw } from "../../htmlisp";
import {
  FIELD_CONTROL_SM,
  MUTED_TEXT,
  MUTED_TEXT_XS,
  renderButton,
  renderCard,
  renderInputField,
  renderInsetCard,
  renderSectionHeader,
} from "../../ui";
import { PHASES } from "../../students";
import { renderView } from "../shared.htmlisp";
import type { DataToolsPageData } from "../types";

interface PreparedLaneSlot {
  phaseNumber: string;
  phaseLabel: string;
  labelFieldName: string;
  labelValue: string;
}

function prepareLaneSlots(data: DataToolsPageData): PreparedLaneSlot[] {
  return PHASES.map((phase, index) => {
    const lane = data.dashboardLanes.find((item) => item.phaseId === phase.id);

    return {
      phaseNumber: String(index + 1),
      phaseLabel: phase.label,
      labelFieldName: `laneLabel${index}`,
      labelValue: lane?.label || phase.label,
    };
  });
}

function renderLaneSlot(slot: PreparedLaneSlot): string {
  return renderInsetCard(
    renderView(
      `<fragment &children="headerHtml"></fragment>
      <div class="mt-panel-sm">
        <fragment &children="labelFieldHtml"></fragment>
      </div>`,
      {
        headerHtml: raw(renderSectionHeader({
          title: `${slot.phaseNumber}. ${slot.phaseLabel}`,
          headingLevel: 3,
          headingClassName: "text-sm font-semibold",
        })),
        labelFieldHtml: raw(renderInputField({
          label: "Lane label",
          name: slot.labelFieldName,
          value: slot.labelValue,
          className: FIELD_CONTROL_SM,
        })),
      },
    ),
  );
}

export function renderDashboardLaneConfigCard(data: DataToolsPageData): string {
  const currentLayoutItems = PHASES.map((phase, index) => {
    const lane = data.dashboardLanes.find((item) => item.phaseId === phase.id);
    const phaseText = `${index + 1}. ${phase.label}`;
    return lane && lane.label !== phase.label ? `${phaseText} -> ${lane.label}` : phaseText;
  });
  const laneSlotsHtml = prepareLaneSlots(data).map(renderLaneSlot).join("");

  return renderCard(
    renderView(
      `<h2 class="text-lg font-semibold">Dashboard Lane Layout</h2>
      <p &class="descriptionClass">
        Configure the dashboard labels for each thesis phase. This layout is shared across the whole application for now.
      </p>
      <div class="mt-panel-sm space-y-badge-y text-sm">
        <p &class="metaText" &children="sourceText"></p>
        <p &visibleIf="updatedAtVisible" &class="metaText" &children="updatedAtText"></p>
      </div>
      <fragment &children="currentLayoutHtml"></fragment>
      <form action="/actions/save-dashboard-lane-settings" method="post" class="mt-panel-sm space-y-panel-sm">
        <div class="grid grid-cols-1 gap-panel-sm xl:grid-cols-2">
          <fragment &children="laneSlotsHtml"></fragment>
        </div>
        <fragment &children="saveButtonHtml"></fragment>
      </form>
      <form action="/actions/reset-dashboard-lane-settings" method="post" class="mt-badge-y w-full sm:w-auto">
        <fragment &children="resetButtonHtml"></fragment>
      </form>
      <p &class="footnoteClass">
        Resetting restores the original phase labels shown in the default dashboard board.
      </p>`,
      {
        descriptionClass: MUTED_TEXT,
        metaText: MUTED_TEXT_XS,
        footnoteClass: `mt-panel-sm ${MUTED_TEXT_XS}`,
        sourceText: data.usingDefaultDashboardLanes ? "Current layout: default app lanes." : "Current layout: saved custom app lanes.",
        updatedAtVisible: Boolean(data.storedDashboardLanesUpdatedAt),
        updatedAtText: data.storedDashboardLanesUpdatedAt ? `Last updated: ${data.storedDashboardLanesUpdatedAt}` : "",
        currentLayoutHtml: raw(
          renderInsetCard(
            renderView(
              `<fragment &children="headerHtml"></fragment>
              <ul class="mt-badge-y space-y-badge-y text-sm">
                <fragment &foreach="currentLayoutItems as item">
                  <li class="rounded-control bg-app-surface px-control-x py-badge-pill-y dark:bg-app-surface-dark" &children="item"></li>
                </fragment>
              </ul>`,
              {
                headerHtml: raw(renderSectionHeader({
                  title: "Current board layout",
                  meta: "The dashboard phase view uses these labels for each fixed thesis phase.",
                  headingLevel: 3,
                  headingClassName: "text-sm font-semibold",
                })),
                currentLayoutItems,
              },
            ),
            "mt-panel-sm",
          ),
        ),
        laneSlotsHtml: raw(laneSlotsHtml),
        saveButtonHtml: raw(renderButton({
          label: "Save lane labels",
          type: "submit",
          variant: "primary",
          className: "w-full sm:w-auto",
        })),
        resetButtonHtml: raw(renderButton({
          label: "Reset to defaults",
          type: "submit",
          variant: "neutral",
          className: "w-full sm:w-auto",
        })),
      },
    ),
  );
}
