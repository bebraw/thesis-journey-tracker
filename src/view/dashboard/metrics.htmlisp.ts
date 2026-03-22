import { MUTED_TEXT, SURFACE_CARD_SM } from "../../ui";
import { type HtmlispComponents } from "../../htmlisp";
import { escapeHtml } from "../../utils";
import { renderView } from "../shared.htmlisp";
import type { Metrics } from "../types";

interface PreparedMetric {
  label: string;
  metricValue: string;
}

export function renderMetricCards(metrics: Metrics): string {
  const preparedMetrics: PreparedMetric[] = [
    { label: "Students tracked", metricValue: String(metrics.total) },
    { label: "Meetings not booked", metricValue: String(metrics.noMeeting) },
    { label: "Past six-month target", metricValue: String(metrics.pastTarget) },
    { label: "Submitted", metricValue: String(metrics.submitted) },
  ];
  const components: HtmlispComponents = {
    MetricCard: `<article &class="(get props cardClass)">
    <p &class="(get props labelClass)" &children="(get props label)"></p>
    <p class="mt-1 text-2xl font-semibold" &children="(get props metricValue)"></p>
  </article>`,
  };

  return renderView(
    '<section class="grid grid-cols-1 gap-panel-sm sm:grid-cols-2 xl:grid-cols-4"><noop &foreach="(get props metrics)"><MetricCard &cardClass="(get props cardClass)" &labelClass="(get props labelClass)" &label="(get props label)" &metricValue="(get props metricValue)"></MetricCard></noop></section>',
    {
      metrics: preparedMetrics,
      cardClass: escapeHtml(SURFACE_CARD_SM),
      labelClass: escapeHtml(MUTED_TEXT),
    },
    components,
  );
}
