import { PAGE_WRAP_NARROW } from "../../ui/app";
import type { DataToolsPageData } from "../types";
import {
  renderAuthedPageDocument,
} from "../shared.htmlisp";
import { renderGoogleCalendarCard } from "./calendar-card.htmlisp";
import { renderExportCard } from "./export-card.htmlisp";
import { renderImportCard } from "./import-card.htmlisp";

export function renderDataToolsPage(data: DataToolsPageData): string {
  const { viewer, notice, error, studentCount, logCount, replaceImportEnabled } = data;

  return renderAuthedPageDocument({
    documentTitle: "Thesis Journey Tracker - Data Tools",
    headerTitle: "Data Tools",
    headerDescription: "Back up or restore the thesis tracking dataset as JSON.",
    currentPage: "data-tools",
    viewer,
    pageWrapClass: PAGE_WRAP_NARROW,
    notice,
    error,
    sections: [
      `<div class="grid grid-cols-1 gap-stack">
        ${renderGoogleCalendarCard(data)}
        ${renderExportCard(studentCount, logCount)}
        ${renderImportCard(replaceImportEnabled)}
      </div>`,
    ],
  });
}
