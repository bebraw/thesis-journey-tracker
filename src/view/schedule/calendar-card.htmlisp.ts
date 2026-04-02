import { EMPTY_DASHED_CARD, MUTED_TEXT, SOFT_SURFACE_CARD, SUBTLE_TEXT, SURFACE_CARD_SM, TEXT_LINK, renderCard, renderSectionHeader } from "../../ui";
import type { SchedulePageData } from "../types";
import { raw } from "../../htmlisp";
import { renderView } from "../shared.htmlisp";

export function renderScheduleCalendarCard(data: SchedulePageData): string {
  const { days, timeZone, weekLabel } = data;

  return renderCard(
    renderView(
      `<div class="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 class="text-lg font-semibold">Calendar Week</h2>
          <p &class="subtleText" &children="weekText"></p>
        </div>
        <p &class="metaText" &children="timezoneText"></p>
      </div>
      <div class="mt-panel-sm grid grid-cols-1 gap-panel-sm lg:grid-cols-5">
        <fragment &foreach="days as day">
          <section &class="day.cardClass">
            <fragment &children="day.headerHtml"></fragment>
            <div class="mt-stack-xs space-y-stack-xs">
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-app-text-muted dark:text-app-text-muted-dark">Existing events</p>
                <div class="mt-badge-y space-y-badge-y" &visibleIf="day.hasEvents">
                  <fragment &foreach="day.events as event">
                    <article &class="eventCardClass">
                      <p class="font-semibold" &children="event.summary"></p>
                      <p class="mt-1 text-app-text-soft dark:text-app-text-soft-dark" &children="event.timeText"></p>
                      <p class="mt-1 text-app-text-muted dark:text-app-text-muted-dark" &visibleIf="event.descriptionVisible" &children="event.description"></p>
                      <a
                        &visibleIf="event.linkVisible"
                        &href="event.htmlLink"
                        target="_blank"
                        rel="noreferrer"
                        &class="linkClass"
                      >Open in Google Calendar</a>
                    </article>
                  </fragment>
                </div>
                <p &visibleIf="day.showNoEvents" &class="emptyStateClass">No existing Google Calendar events in this day.</p>
              </div>
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-app-text-muted dark:text-app-text-muted-dark">Available slots</p>
                <div class="mt-badge-y flex flex-wrap gap-badge-y" &visibleIf="day.hasSlots">
                  <fragment &foreach="day.slots as slot">
                    <a
                      &href="slot.href"
                      &class="slot.slotClass"
                      &aria-current="slot.currentAttr"
                      &children="slot.label"
                    ></a>
                  </fragment>
                </div>
                <p &visibleIf="day.showNoSlots" &class="emptyStateClass">No one-hour slots remain in the default workday.</p>
              </div>
            </div>
          </section>
        </fragment>
      </div>`,
      {
        subtleText: SUBTLE_TEXT,
        metaText: MUTED_TEXT,
        weekText: weekLabel,
        timezoneText: `Google Calendar timezone: ${timeZone}`,
        emptyStateClass: EMPTY_DASHED_CARD,
        linkClass: `mt-1 inline-flex ${TEXT_LINK}`,
        days: days.map((day) => ({
          label: day.label,
          slotCountText: `${day.slots.length} open`,
          headerHtml: raw(renderSectionHeader({
            title: day.label,
            meta: `${day.slots.length} open`,
            headingLevel: 3,
            headingClassName: "text-sm font-semibold",
            className: "items-center",
          })),
          cardClass: SURFACE_CARD_SM,
          hasEvents: day.hasEvents,
          showNoEvents: !day.hasEvents,
          events: day.events.map((event) => ({
            summary: event.summary,
            timeText: event.timeText,
            descriptionVisible: Boolean(event.description),
            description: event.description || "",
            linkVisible: Boolean(event.htmlLink),
            htmlLink: event.htmlLink || "",
          })),
          hasSlots: day.hasSlots,
          showNoSlots: !day.hasSlots,
          slots: day.slots.map((slot) => ({
            href: slot.href,
            label: slot.label,
            slotClass:
              `${slot.selected ? "bg-app-brand text-white hover:bg-app-brand-strong" : "border border-app-field bg-app-surface text-app-text hover:bg-app-surface-soft dark:border-app-field-dark dark:bg-app-surface-dark dark:text-app-text-dark dark:hover:bg-app-surface-soft-dark"} inline-flex rounded-control px-badge-pill-x py-badge-pill-y text-xs font-medium`,
            currentAttr: slot.selected ? "step" : null,
          })),
        })),
        eventCardClass: `${SOFT_SURFACE_CARD} px-control-x py-badge-pill-y text-xs dark:bg-app-surface-soft-dark/60`,
      },
    ),
  );
}
