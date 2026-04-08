import { PAGE_WRAP } from "../../ui/app";
import { renderEmptySelectedPanel, renderSelectedStudentPanel } from "../students";
import {
  renderAuthedPageDocument,
} from "../shared.htmlisp";
import type { DashboardPageData } from "../types";
import { renderDashboardScriptTag } from "./interaction-script";
import { renderMetricCards } from "./metrics.htmlisp";
import { renderPhaseLanes } from "./phase-lanes.htmlisp";
import { renderStudentsTable } from "./students-table.htmlisp";

export function renderDashboardPage(data: DashboardPageData): string {
  const { viewer, students, selectedStudent, logs, phaseAudit, filters, notice, error, metrics, timeZone, showStyleGuide } = data;
  const canEdit = viewer.role === "editor";
  const selectedPanel = selectedStudent
    ? renderSelectedStudentPanel(selectedStudent, logs, phaseAudit, { canEdit, filters, timeZone })
    : renderEmptySelectedPanel(
        canEdit
          ? "Select a student from the table to edit details and view/add supervision logs."
          : "Select a student from the table to view details, supervision logs, and phase history.",
      );

  return renderAuthedPageDocument({
    documentTitle: "Thesis Journey Tracker",
    headerTitle: "Thesis Journey Tracker",
    headerDescription: canEdit
      ? "A clean overview for tracking thesis progress, supervision follow-ups, and the students who need attention next."
      : "Read-only access for reviewing student progress, meetings, and supervision history without changing records.",
    currentPage: "dashboard",
    viewer,
    pageWrapClass: PAGE_WRAP,
    notice,
    error,
    flashKind: "toast",
    showStyleGuide,
    sections: [
      renderStudentsTable(
        students,
        selectedStudent,
        filters,
        renderMetricCards(metrics),
        renderPhaseLanes(students, selectedStudent, filters, { embedded: true }),
        selectedPanel,
        renderEmptySelectedPanel(
          canEdit
            ? "Select a student from the table to edit details and view/add supervision logs."
            : "Select a student from the table to view details, supervision logs, and phase history.",
        ),
        { canEdit, timeZone },
      ),
    ],
    scripts: [renderDashboardScriptTag()],
  });
}
