import { SURFACE_CARD_SM } from "../../ui";
import { type HtmlispComponents } from "../../htmlisp";
import { renderView } from "../shared.htmlisp";
import type { Metrics } from "../types";

interface PreparedMetric {
  label: string;
  metricValue: string;
  detail: string;
  href: string;
}

export function renderMetricCards(metrics: Metrics): string {
  const preparedMetrics: PreparedMetric[] = [
    {
      label: "Students tracked",
      metricValue: String(metrics.total),
      detail: "All active and archived thesis records.",
      href: "/",
    },
    {
      label: "Meetings not booked",
      metricValue: String(metrics.noMeeting),
      detail: "Students still missing a scheduled next step.",
      href: "/?status=not_booked",
    },
    {
      label: "Past MSc target",
      metricValue: String(metrics.pastTarget),
      detail: "Master's theses that have moved past the target window.",
      href: "/?degree=msc&sort=target&dir=asc",
    },
    {
      label: "Submitted",
      metricValue: String(metrics.submitted),
      detail: "Students already at the final phase.",
      href: "/?phase=submitted",
    },
  ];

  const components: HtmlispComponents = {
    MetricCard: `<a &href="href" &class="cardClass">
    <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-app-text-muted dark:text-app-text-muted-dark" &children="label"></p>
    <div class="mt-2 flex items-end justify-between gap-stack-xs">
      <p class="text-2xl font-semibold leading-none sm:text-[1.8rem]" &children="metricValue"></p>
      <p &class="detailClass" &children="detail"></p>
    </div>
  </a>`,
  };

  return renderView(
    `<div class="grid grid-cols-1 gap-badge-y sm:grid-cols-2 xl:grid-cols-4">
      <fragment &foreach="metrics as metric">
        <MetricCard
          &cardClass="cardClass"
          &href="metric.href"
          &label="metric.label"
          &metricValue="metric.metricValue"
          &detailClass="detailClass"
          &detail="metric.detail"
        ></MetricCard>
      </fragment>
    </div>`,
    {
      metrics: preparedMetrics,
      cardClass: `${SURFACE_CARD_SM} block p-panel-sm transition hover:-translate-y-px hover:border-app-line-strong hover:shadow-elevated dark:hover:border-app-line-dark-strong`,
      detailClass: "max-w-[10rem] text-right text-[11px] leading-5 text-app-text-soft dark:text-app-text-soft-dark",
    },
    components,
  );
}
