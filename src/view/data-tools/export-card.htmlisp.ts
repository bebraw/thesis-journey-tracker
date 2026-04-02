import { raw } from "../../htmlisp";
import { MUTED_TEXT, SUBTLE_TEXT, renderButton, renderCard } from "../../ui";
import { renderView } from "../shared.htmlisp";

export function renderExportCard(studentCount: number, logCount: number): string {
  return renderCard(
    renderView(
      `<h2 class="text-lg font-semibold">Export backup</h2>
      <p &class="subtleText" &children="description"></p>
      <p &class="metaText" &children="currentDataText"></p>
      <div class="mt-panel-sm flex flex-wrap gap-stack-xs">
        <fragment &children="exportButton"></fragment>
        <fragment &children="professorReportButton"></fragment>
      </div>`,
      {
        subtleText: `mt-1 ${SUBTLE_TEXT}`,
        metaText: `mt-panel-sm ${MUTED_TEXT}`,
        description: "Download all students and meeting logs as a JSON backup file.",
        currentDataText: `Current data: ${studentCount} students and ${logCount} meeting logs.`,
        exportButton: raw(renderButton({
          label: "Download JSON export",
          href: "/actions/export-json",
          variant: "primary",
        })),
        professorReportButton: raw(renderButton({
          label: "Download email-ready report",
          href: "/actions/export-professor-report",
          variant: "neutral",
        })),
      },
    ),
  );
}
