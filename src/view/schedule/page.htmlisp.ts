import { raw } from "../../htmlisp";
import { PAGE_WRAP } from "../../ui";
import {
  renderAuthedPageHeader,
  renderDocument,
  renderFlashMessages,
  renderPageHeaderNavigation,
  renderView,
  THEME_TOGGLE_SCRIPT,
} from "../shared.htmlisp";
import type { SchedulePageData } from "../types";
import { renderScheduleCalendarCard } from "./calendar-card.htmlisp";
import { renderScheduleControlsCard } from "./controls-card.htmlisp";
import { renderSelectedSlotCard } from "./selected-slot-card.htmlisp";
import { renderScheduleSetupCard, renderScheduleSyncFailureCard } from "./status-cards.htmlisp";

export function renderSchedulePage(data: SchedulePageData): string {
  const { configured, error, notice, showStyleGuide, syncFailed, viewer } = data;

  const bodyContent = renderView(
    `<div &class="pageWrap">
      <fragment &children="headerHtml"></fragment>
      <fragment &children="flashHtml"></fragment>
      <fragment &children="controlsCard"></fragment>
      <fragment &children="mainCard"></fragment>
      <fragment &children="selectedSlotCard"></fragment>
    </div>
    <fragment &children="themeToggleScript"></fragment>`,
    {
      pageWrap: PAGE_WRAP,
      headerHtml: raw(renderAuthedPageHeader(
        "Google Calendar Scheduling",
        "See existing Google Calendar events, find open slots, and send student meeting invitations.",
        renderPageHeaderNavigation("schedule", viewer, showStyleGuide),
        viewer,
      )),
      flashHtml: raw(renderFlashMessages(notice, error)),
      controlsCard: raw(renderScheduleControlsCard(data)),
      mainCard: raw(!configured ? renderScheduleSetupCard() : syncFailed ? renderScheduleSyncFailureCard() : renderScheduleCalendarCard(data)),
      selectedSlotCard: configured && !syncFailed ? raw(renderSelectedSlotCard(data)) : raw(""),
      themeToggleScript: raw(THEME_TOGGLE_SCRIPT),
    },
  );

  return renderDocument("Thesis Journey Tracker - Schedule", bodyContent);
}
