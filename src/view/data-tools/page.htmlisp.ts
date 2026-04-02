import { raw } from "../../htmlisp";
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
    `<div &class="pageWrap">
      <fragment &children="headerHtml"></fragment>
      <fragment &children="flashHtml"></fragment>
      <div class="grid grid-cols-1 gap-stack">
        <fragment &children="googleCalendarCard"></fragment>
        <fragment &children="exportCard"></fragment>
        <fragment &children="importCard"></fragment>
      </div>
    </div>
    <fragment &children="themeToggleScript"></fragment>`,
    {
      pageWrap: PAGE_WRAP_NARROW,
      headerHtml: raw(renderAuthedPageHeader(
        "Data Tools",
        "Back up or restore the thesis tracking dataset as JSON.",
        renderPageHeaderNavigation("data-tools", viewer),
        viewer,
      )),
      flashHtml: raw(renderFlashMessages(notice, error)),
      googleCalendarCard: raw(renderGoogleCalendarCard(data)),
      exportCard: raw(renderExportCard(studentCount, logCount)),
      importCard: raw(renderImportCard(replaceImportEnabled)),
      themeToggleScript: raw(THEME_TOGGLE_SCRIPT),
    },
  );

  return renderDocument("Thesis Journey Tracker - Data Tools", bodyContent);
}
