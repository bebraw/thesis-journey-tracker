import { escapeHtml } from "../../formatting";
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
    `<div &class="(get props pageWrap)">
      <noop &children="(get props headerHtml)"></noop>
      <noop &children="(get props flashHtml)"></noop>
      <noop &children="(get props controlsCard)"></noop>
      <noop &children="(get props mainCard)"></noop>
      <noop &children="(get props selectedSlotCard)"></noop>
    </div>
    <noop &children="(get props themeToggleScript)"></noop>`,
    {
      pageWrap: escapeHtml(PAGE_WRAP),
      headerHtml: renderAuthedPageHeader(
        "Google Calendar Scheduling",
        "See existing Google Calendar events, find open slots, and send student meeting invitations.",
        renderPageHeaderNavigation("schedule", viewer, showStyleGuide),
        viewer,
      ),
      flashHtml: renderFlashMessages(notice, error),
      controlsCard: renderScheduleControlsCard(data),
      mainCard: !configured ? renderScheduleSetupCard() : syncFailed ? renderScheduleSyncFailureCard() : renderScheduleCalendarCard(data),
      selectedSlotCard: configured && !syncFailed ? renderSelectedSlotCard(data) : "",
      themeToggleScript: THEME_TOGGLE_SCRIPT,
    },
  );

  return renderDocument("Thesis Journey Tracker - Schedule", bodyContent);
}
