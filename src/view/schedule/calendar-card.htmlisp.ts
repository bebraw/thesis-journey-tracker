import { escapeHtml } from "../../formatting";
import { EMPTY_DASHED_CARD, MUTED_TEXT, SUBTLE_TEXT, SURFACE_CARD_SM, TEXT_LINK, renderCard } from "../../ui";
import type { SchedulePageData } from "../types";
import { renderView } from "../shared.htmlisp";

export function renderScheduleCalendarCard(data: SchedulePageData): string {
  const { days, timeZone, weekLabel } = data;

  return renderCard(
    renderView(
      `<div class="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 class="text-lg font-semibold">Calendar Week</h2>
          <p &class="(get props subtleText)" &children="(get props weekText)"></p>
        </div>
        <p &class="(get props metaText)" &children="(get props timezoneText)"></p>
      </div>
      <div class="mt-panel-sm grid grid-cols-1 gap-panel-sm lg:grid-cols-5">
        <noop &foreach="(get props days)">
          <section &class="(get props dayCardClass)">
            <div class="flex items-center justify-between gap-stack-xs">
              <h3 class="text-sm font-semibold" &children="(get props label)"></h3>
              <span class="text-xs text-app-text-muted dark:text-app-text-muted-dark">
                <span &children="(get props slotCountText)"></span>
              </span>
            </div>
            <div class="mt-stack-xs space-y-stack-xs">
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-app-text-muted dark:text-app-text-muted-dark">Existing events</p>
                <div class="mt-badge-y space-y-badge-y" &visibleIf="(get props hasEvents)">
                  <noop &foreach="(get props events)">
                    <article class="rounded-control border border-app-line bg-app-surface-soft px-control-x py-badge-pill-y text-xs dark:border-app-line-dark dark:bg-app-surface-soft-dark/60">
                      <p class="font-semibold" &children="(get props summary)"></p>
                      <p class="mt-1 text-app-text-soft dark:text-app-text-soft-dark" &children="(get props timeText)"></p>
                      <p class="mt-1 text-app-text-muted dark:text-app-text-muted-dark" &visibleIf="(get props descriptionVisible)" &children="(get props description)"></p>
                      <a
                        &visibleIf="(get props linkVisible)"
                        &href="(get props htmlLink)"
                        target="_blank"
                        rel="noreferrer"
                        &class="(get props linkClass)"
                      >Open in Google Calendar</a>
                    </article>
                  </noop>
                </div>
                <p &visibleIf="(get props showNoEvents)" &class="(get props emptyStateClass)">No existing Google Calendar events in this day.</p>
              </div>
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-app-text-muted dark:text-app-text-muted-dark">Available slots</p>
                <div class="mt-badge-y flex flex-wrap gap-badge-y" &visibleIf="(get props hasSlots)">
                  <noop &foreach="(get props slots)">
                    <a
                      &href="(get props href)"
                      &class="(get props slotClass)"
                      &aria-current="(get props currentAttr)"
                      &children="(get props label)"
                    ></a>
                  </noop>
                </div>
                <p &visibleIf="(get props showNoSlots)" &class="(get props emptyStateClass)">No one-hour slots remain in the default workday.</p>
              </div>
            </div>
          </section>
        </noop>
      </div>`,
      {
        subtleText: escapeHtml(SUBTLE_TEXT),
        metaText: escapeHtml(MUTED_TEXT),
        weekText: escapeHtml(weekLabel),
        timezoneText: escapeHtml(`Google Calendar timezone: ${timeZone}`),
        dayCardClass: escapeHtml(SURFACE_CARD_SM),
        emptyStateClass: escapeHtml(EMPTY_DASHED_CARD),
        linkClass: escapeHtml(`mt-1 inline-flex ${TEXT_LINK}`),
        days: days.map((day) => ({
          label: escapeHtml(day.label),
          slotCountText: escapeHtml(`${day.slots.length} open`),
          hasEvents: day.hasEvents,
          showNoEvents: !day.hasEvents,
          events: day.events.map((event) => ({
            summary: escapeHtml(event.summary),
            timeText: escapeHtml(event.timeText),
            descriptionVisible: Boolean(event.description),
            description: escapeHtml(event.description || ""),
            linkVisible: Boolean(event.htmlLink),
            htmlLink: escapeHtml(event.htmlLink || ""),
          })),
          hasSlots: day.hasSlots,
          showNoSlots: !day.hasSlots,
          slots: day.slots.map((slot) => ({
            href: escapeHtml(slot.href),
            label: escapeHtml(slot.label),
            slotClass: escapeHtml(
              `${slot.selected ? "bg-app-brand text-white hover:bg-app-brand-strong" : "border border-app-field bg-app-surface text-app-text hover:bg-app-surface-soft dark:border-app-field-dark dark:bg-app-surface-dark dark:text-app-text-dark dark:hover:bg-app-surface-soft-dark"} inline-flex rounded-control px-badge-pill-x py-badge-pill-y text-xs font-medium`,
            ),
            currentAttr: slot.selected ? "step" : null,
          })),
        })),
      },
    ),
  );
}
