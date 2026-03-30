import { escapeHtml } from "../../formatting";
import { MUTED_TEXT, SUBTLE_TEXT, renderButton, renderCard } from "../../ui";
import { renderView } from "../shared.htmlisp";

export function renderExportCard(studentCount: number, logCount: number): string {
  return renderCard(
    renderView(
      `<h2 class="text-lg font-semibold">Export backup</h2>
      <p &class="(get props subtleText)" &children="(get props description)"></p>
      <p &class="(get props metaText)" &children="(get props currentDataText)"></p>
      <div class="mt-panel-sm flex flex-wrap gap-stack-xs">
        <noop &children="(get props exportButton)"></noop>
        <noop &children="(get props professorReportButton)"></noop>
      </div>`,
      {
        subtleText: escapeHtml(`mt-1 ${SUBTLE_TEXT}`),
        metaText: escapeHtml(`mt-panel-sm ${MUTED_TEXT}`),
        description: escapeHtml("Download all students and meeting logs as a JSON backup file."),
        currentDataText: escapeHtml(`Current data: ${studentCount} students and ${logCount} meeting logs.`),
        exportButton: renderButton({
          label: "Download JSON export",
          href: "/actions/export-json",
          variant: "primary",
        }),
        professorReportButton: renderButton({
          label: "Download email-ready report",
          href: "/actions/export-professor-report",
          variant: "neutral",
        }),
      },
    ),
  );
}
