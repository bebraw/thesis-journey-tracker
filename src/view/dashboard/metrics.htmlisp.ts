import { SURFACE_CARD_SM } from "../../ui";
import { type HtmlispComponents } from "../../htmlisp";
import { escapeHtml } from "../../formatting";
import { renderView } from "../shared.htmlisp";
import type { Metrics } from "../types";

interface PreparedMetric {
  label: string;
  metricValue: string;
  detail: string;
  href: string;
  ctaText: string;
}

export function renderMetricCards(metrics: Metrics): string {
  const preparedMetrics: PreparedMetric[] = [
    {
      label: "Students tracked",
      metricValue: String(metrics.total),
      detail: "All active and archived thesis records.",
      href: "/",
      ctaText: "View all students",
    },
    {
      label: "Meetings not booked",
      metricValue: String(metrics.noMeeting),
      detail: "Students still missing a scheduled next step.",
      href: "/?status=not_booked",
      ctaText: "Review students",
    },
    {
      label: "Past MSc target",
      metricValue: String(metrics.pastTarget),
      detail: "Master's theses that have moved past the target window.",
      href: "/?degree=msc&sort=target&dir=asc",
      ctaText: "Review timeline",
    },
    {
      label: "Submitted",
      metricValue: String(metrics.submitted),
      detail: "Students already at the final phase.",
      href: "/?phase=submitted",
      ctaText: "Open submitted",
    },
  ];
  const components: HtmlispComponents = {
    MetricCard: `<a &href="(get props href)" &class="(get props cardClass)">
    <div class="flex items-baseline justify-between gap-badge-y">
      <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-app-text-muted dark:text-app-text-muted-dark" &children="(get props label)"></p>
      <p class="text-xs font-semibold text-app-brand dark:text-app-brand-ring" &children="(get props ctaText)"></p>
    </div>
    <div class="mt-2 flex items-end justify-between gap-stack-xs">
      <p class="text-2xl font-semibold leading-none sm:text-[1.8rem]" &children="(get props metricValue)"></p>
      <p &class="(get props detailClass)" &children="(get props detail)"></p>
    </div>
  </a>`,
  };

  return renderView(
    `<div class="grid grid-cols-1 gap-badge-y sm:grid-cols-2 xl:grid-cols-4">
      <noop &foreach="(get props metrics)">
        <MetricCard
          &cardClass="(get props cardClass)"
          &href="(get props href)"
          &label="(get props label)"
          &metricValue="(get props metricValue)"
          &detailClass="(get props detailClass)"
          &detail="(get props detail)"
          &ctaText="(get props ctaText)"
        ></MetricCard>
      </noop>
    </div>`,
    {
      metrics: preparedMetrics,
      cardClass: escapeHtml(`${SURFACE_CARD_SM} block p-panel-sm transition hover:-translate-y-px hover:border-app-line-strong hover:shadow-elevated dark:hover:border-app-line-dark-strong`),
      detailClass: escapeHtml("max-w-[10rem] text-right text-[11px] leading-5 text-app-text-soft dark:text-app-text-soft-dark"),
    },
    components,
  );
}
