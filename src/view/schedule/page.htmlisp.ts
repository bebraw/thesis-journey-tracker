import { PAGE_WRAP } from "../../ui/app";
import {
  renderAuthedPageDocument,
} from "../shared.htmlisp";
import type { SchedulePageData } from "../types";
import { renderScheduleCalendarCard } from "./calendar-card.htmlisp";
import { renderScheduleControlsCard } from "./controls-card.htmlisp";
import { renderSelectedSlotCard } from "./selected-slot-card.htmlisp";
import { renderScheduleSetupCard, renderScheduleSyncFailureCard } from "./status-cards.htmlisp";

export function renderSchedulePage(data: SchedulePageData): string {
  const { configured, error, notice, showStyleGuide, syncFailed, viewer } = data;

  return renderAuthedPageDocument({
    documentTitle: "Thesis Journey Tracker - Schedule",
    headerTitle: "Google Calendar Scheduling",
    headerDescription: "See existing Google Calendar events, find open slots, and send student meeting invitations.",
    currentPage: "schedule",
    viewer,
    pageWrapClass: PAGE_WRAP,
    notice,
    error,
    showStyleGuide,
    sections: [
      renderScheduleControlsCard(data),
      !configured ? renderScheduleSetupCard() : syncFailed ? renderScheduleSyncFailureCard() : renderScheduleCalendarCard(data),
      configured && !syncFailed ? renderSelectedSlotCard(data) : "",
    ],
  });
}
