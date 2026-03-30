import { escapeHtml } from "../../formatting";
import { PAGE_WRAP_NARROW } from "../../ui";
import type { DataToolsPageData } from "../types";
import {
  THEME_TOGGLE_SCRIPT,
  renderAuthedPageHeader,
  renderDocument,
  renderFlashMessages,
  renderPageHeaderNavigation,
  renderView,
} from "../shared.htmlisp";
import { renderGoogleCalendarCard } from "./calendar-card.htmlisp";
import { renderExportCard } from "./export-card.htmlisp";
import { renderImportCard } from "./import-card.htmlisp";

export function renderDataToolsPage(data: DataToolsPageData): string {
  const { viewer, notice, error, studentCount, logCount, replaceImportEnabled } = data;

  const bodyContent = renderView(
    `<div &class="(get props pageWrap)">
      <noop &children="(get props headerHtml)"></noop>
      <noop &children="(get props flashHtml)"></noop>
      <div class="grid grid-cols-1 gap-stack">
        <noop &children="(get props googleCalendarCard)"></noop>
        <noop &children="(get props exportCard)"></noop>
        <noop &children="(get props importCard)"></noop>
      </div>
    </div>
    <noop &children="(get props themeToggleScript)"></noop>`,
    {
      pageWrap: escapeHtml(PAGE_WRAP_NARROW),
      headerHtml: renderAuthedPageHeader(
        "Data Tools",
        "Back up or restore the thesis tracking dataset as JSON.",
        renderPageHeaderNavigation("data-tools", viewer),
        viewer,
      ),
      flashHtml: renderFlashMessages(notice, error),
      googleCalendarCard: renderGoogleCalendarCard(data),
      exportCard: renderExportCard(studentCount, logCount),
      importCard: renderImportCard(replaceImportEnabled),
      themeToggleScript: THEME_TOGGLE_SCRIPT,
    },
  );

  return renderDocument("Thesis Journey Tracker - Data Tools", bodyContent);
}
